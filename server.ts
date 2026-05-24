import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mime from "mime";

dotenv.config();

function getFirebaseConfig() {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    console.error("Gagal membaca firebase-applet-config.json:", err);
    return {};
  }
}

async function getFirebaseAdmin() {
  const admin = (await import("firebase-admin")).default;
  if (!admin.apps.length) {
    const firebaseConfig = getFirebaseConfig();
    const opt: any = {
      projectId: firebaseConfig.projectId
    };

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        opt.credential = admin.credential.cert(sa);
        console.log("Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT JSON env.");
      } catch (e: any) {
        console.error("Gagal parse FIREBASE_SERVICE_ACCOUNT:", e);
      }
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        opt.credential = admin.credential.cert({
          projectId: firebaseConfig.projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        console.log("Firebase Admin initialized using FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.");
      } catch (e: any) {
        console.error("Gagal initialize individual private key:", e);
      }
    } else {
      try {
        opt.credential = admin.credential.applicationDefault();
        console.log("Firebase Admin initialized using ADC.");
      } catch (e: any) {
        throw new Error(
          "Firebase Admin credentials tidak ditemukan. " +
          "Silakan atur salah satu variabel lingkungan berikut pada setup hosting (Vercel) Anda: " +
          "1. FIREBASE_SERVICE_ACCOUNT (berisi konten JSON Key Akun Layanan Firebase) " +
          "Atau: FIREBASE_PRIVATE_KEY & FIREBASE_CLIENT_EMAIL."
        );
      }
    }

    admin.initializeApp(opt);
  }
  return admin;
}

export const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Initialize Gemini
const getAiClient = (apiKeys: string | string[]) => {
  let keys: string[] = [];
  
  if (Array.isArray(apiKeys)) {
    keys = apiKeys.filter(k => k && typeof k === 'string' && k.trim() !== "");
  } else if (apiKeys && typeof apiKeys === 'string' && apiKeys.trim() !== "") {
    keys = [apiKeys];
  }
  
  // If no valid keys provided by user, fallback to system GEMINI_API_KEY
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys = [process.env.GEMINI_API_KEY];
  }

  const activeKey = keys.length > 0 ? keys[0] : "DUMMY_KEY";

  return {
    client: new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    }),
    allKeys: keys
  };
};

// Helper: Try generative content with multiple keys
async function withRotation(apiKeys: string | string[], fn: (client: any) => Promise<any>) {
  const { allKeys } = getAiClient(apiKeys);
  
  if (allKeys.length === 0) {
    throw new Error("No valid Gemini API keys available. Please set one in Settings.");
  }

  let lastError: any = null;

  // Try each key
  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    try {
      const client = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      return await fn(client);
    } catch (err: any) {
      lastError = err;
      
      const errorMessage = err.message || "";
      const status = typeof err.status === 'number' ? err.status : (err.error?.code || err.code);
      
      // Detected Quota Exhausted or Invalid Key
      const isQuotaError = status === 429 || errorMessage.toLowerCase().includes("quota");
      const isInvalidKey = status === 400 || status === 403 || errorMessage.toLowerCase().includes("key not found") || errorMessage.toLowerCase().includes("invalid api key");
      const isNetworkError = errorMessage.toLowerCase().includes("fetch") || errorMessage.toLowerCase().includes("network");

      if (isQuotaError || isInvalidKey || isNetworkError) {
        console.warn(`Key ${i + 1}/${allKeys.length} failed [Status: ${status}]. Error: ${errorMessage.substring(0, 50)}... Trying next.`);
        if (i < allKeys.length - 1) {
          continue; // Try next key
        }
      }
      
      // If we are here, it's either the last key or a non-recoverable error
      throw err;
    }
  }

  throw lastError || new Error("All provided API keys failed.");
}

// --- Audio Conversion Utils (from Gemini Docs) ---

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function createWavHeader(dataLength: number, options: WavConversionOptions) {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);                      // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
  buffer.write('WAVE', 8);                      // Format
  buffer.write('fmt ', 12);                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);        // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
  buffer.writeUInt32LE(byteRate, 28);           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
  buffer.write('data', 36);                     // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size

  return buffer;
}

function parseMimeType(mimeType: string) {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const [_, format] = fileType.split('/');

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options as WavConversionOptions;
}

function convertToWav(rawData: string, mimeType: string) {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(rawData.length, options);
  const buffer = Buffer.from(rawData, 'base64');
  return Buffer.concat([wavHeader, buffer]);
}

// --------------------------------------------------

app.use(express.json({ limit: '10mb' }));

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API: Check API Key Status
app.post("/api/check-key", async (req, res) => {
  const { apiKey } = req.body;
  try {
    if (!apiKey || apiKey.trim() === "") {
      return res.json({ status: "error", message: "API Key is empty" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [{ role: "user", parts: [{ text: "hi" }] }]
    });

    if (result.candidates) {
      res.json({ status: "active" });
    } else {
      res.json({ status: "error", message: "Empty response from Gemini" });
    }
  } catch (err: any) {
    const msg = err.message || "";
    const status = err.status || (err.error?.code);
    
    if (status === 429 || msg.toLowerCase().includes("quota")) {
      res.json({ status: "exhausted", message: "Quota reached" });
    } else if (status === 400 || status === 403 || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("key")) {
      res.json({ status: "invalid", message: "Invalid API Key" });
    } else {
      res.json({ status: "error", message: msg });
    }
  }
});

// API: Generate TTS
app.post("/api/generate-tts", async (req, res) => {
  const { prompt, voiceName, temperature, apiKey } = req.body;

  try {
    const response = await withRotation(apiKey, async (ai) => {
      // Structure aligned with official docs
      return await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        config: {
          temperature: temperature || 1,
          responseModalities: ["audio"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Aoede",
              },
            },
          },
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
    });

    // Handle candidates properly
    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.inlineData) {
      const { data, mimeType } = part.inlineData;
      let finalBuffer: Buffer;

      if (mimeType && mimeType.includes("audio/L")) {
        // Convert raw PCM to WAV using documentation logic
        finalBuffer = convertToWav(data, mimeType);
      } else {
        // Regular base64 (already has header or supported by browser)
        finalBuffer = Buffer.from(data, "base64");
      }

      res.json({
        audioBase64: finalBuffer.toString("base64"),
      });
    } else {
      console.error("No audio part in response", JSON.stringify(response, null, 2));
      res.status(500).json({ error: "No audio data returned from Gemini." });
    }
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during TTS generation." });
  }
});

// API: Analyze Image
app.post("/api/analyze-image", async (req, res) => {
  const { base64, mimeType, apiKey } = req.body;

  try {
    const result = await withRotation(apiKey, async (ai) => {
      return await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          parts: [
            { text: "You are a professional narrative scriptwriter. Analyze this image and write a natural, engaging Indonesian voice-over transcript (approx 30-50 words) that describes the content, mood, or story of this image. ONLY return the transcript text, no other comments." },
            { inlineData: { data: base64, mimeType } }
          ]
        }]
      });
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text });
  } catch (error: any) {
    console.error("Gemini Vision Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during image analysis." });
  }
});

// API: Transcribe Audio/Video
app.post("/api/transcribe", async (req, res) => {
  const { base64, mimeType, apiKey } = req.body;

  try {
    const result = await withRotation(apiKey, async (ai) => {
      return await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [
            { text: "Transkripsikan audio atau video ini secara akurat ke dalam teks Bahasa Indonesia. Jangan tambahkan komentar pembuka atau penutup, berikan hanya hasil transkripsinya saja." },
            { inlineData: { data: base64, mimeType } }
          ]
        }]
      });
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ text });
  } catch (error: any) {
    console.error("Gemini Transcription Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during transcription." });
  }
});

// API: Validate License (Dual-Lock API)
app.post("/api/license/validate", async (req, res) => {
  const authHeader = req.headers.authorization;
  const reqApiKey = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
  
  // Verify API Key with SRFACTORY_API_KEY
  const adminApiKey = process.env.SRFACTORY_API_KEY || "SRFactory-SecureKey-2026";
  if (!reqApiKey || reqApiKey !== adminApiKey) {
    return res.status(401).json({
      valid: false,
      message: "Otorisasi gagal. API Key Admin tidak valid atau tidak disertakan."
    });
  }

  const { licenseKey, buyerEmail, email, requestDomain, domain, productName } = req.body;
  const targetKey = (licenseKey || "").trim();
  const targetEmail = (buyerEmail || email || "").trim().toLowerCase();

  if (!targetKey) {
    return res.status(400).json({
      valid: false,
      message: "Parameter 'licenseKey' wajib disertakan."
    });
  }

  try {
    const admin = await getFirebaseAdmin();
    const serverDb = admin.firestore();

    // Query license in Firestore using admin
    const snapshot = await serverDb.collection("licenses").where("licenseKey", "==", targetKey).get();

    if (snapshot.empty) {
      return res.status(404).json({
        valid: false,
        message: "Lisensi tidak ditemukan. Silakan periksa kembali kunci lisensi Anda."
      });
    }

    const licenseDoc = snapshot.docs[0];
    const licenseData = licenseDoc.data();

    // Verify status
    if (licenseData.active === false) {
      return res.status(403).json({
        valid: false,
        message: "Akses ditolak. Lisensi ini berstatus tidak aktif atau telah dinonaktifkan."
      });
    }

    // Verify lock email (buyerEmail)
    if (targetEmail) {
      const registeredEmail = (licenseData.email || "").toLowerCase();
      if (registeredEmail && targetEmail !== registeredEmail) {
        return res.status(403).json({
          valid: false,
          message: `Akses ditolak. Email '${targetEmail}' tidak cocok dengan email pembeli terdaftar.`
        });
      }
    }

    // Verify lock domain
    const orgHeader = req.headers.origin || req.headers.referer || "";
    let domainFromHeader = "";
    if (orgHeader) {
      try {
        if (orgHeader.startsWith("http")) {
          const urlObj = new URL(orgHeader);
          domainFromHeader = urlObj.hostname;
        } else {
          domainFromHeader = orgHeader;
        }
      } catch (e) {
        domainFromHeader = orgHeader.replace(/https?:\/\//, "").split("/")[0].split(":")[0];
      }
    }
    const clientDomain = (requestDomain || domain || domainFromHeader || "").trim();

    if (licenseData.whitelistedDomains) {
      let allowed: string[] = [];
      if (Array.isArray(licenseData.whitelistedDomains)) {
        allowed = licenseData.whitelistedDomains;
      } else if (typeof licenseData.whitelistedDomains === "string") {
        allowed = licenseData.whitelistedDomains.split(",").map((d: string) => d.trim());
      }

      if (allowed.length > 0 && clientDomain) {
        const isDomainAllowed = allowed.some((d: string) => {
          const cleanD = d.toLowerCase();
          const cleanClient = clientDomain.toLowerCase();
          return cleanClient === cleanD || cleanClient.endsWith("." + cleanD);
        });

        if (!isDomainAllowed) {
          return res.status(403).json({
            valid: false,
            message: `Akses ditolak. Domain '${clientDomain}' tidak terdaftar dalam whitelist.`
          });
        }
      }
    }

    // Success response
    return res.json({
      valid: true,
      message: "Lisensi aktif dan berhasil terverifikasi!",
      license: {
        licenseKey: licenseData.licenseKey,
        email: licenseData.email,
        plan: licenseData.plan || "Pro",
        activatedAt: licenseData.activatedAt,
        whitelistedDomains: licenseData.whitelistedDomains || null
      }
    });

  } catch (err: any) {
    console.error("Error in validate-license API:", err);
    return res.status(500).json({
      valid: false,
      message: `Terjadi kesalahan internal pada server lisensi: ${err.message}`
    });
  }
});

// API: Client Verification of License Key (No Admin Key needed, proxies secure validation for local React webapp)
app.post("/api/license/client-verify", async (req, res) => {
  const { licenseKey, email } = req.body;
  const targetKey = (licenseKey || "").trim();
  const targetEmail = (email || "").trim().toLowerCase();

  if (!targetKey || !targetEmail) {
    return res.status(400).json({
      valid: false,
      message: "Kunci Lisensi dan Email wajib disertakan."
    });
  }

  // Real Integration with external SRFactory Licensing Server if configured
  const extApiUrl = process.env.SRFACTORY_API_URL;
  const extApiKey = process.env.SRFACTORY_API_KEY;

  if (extApiUrl) {
    try {
      console.log(`Connecting to external licensing API: ${extApiUrl}`);
      const fallbackHostName = req.get("host") || req.hostname || "localhost";
      const requestDomain = req.headers.referer ? new URL(req.headers.referer).hostname : fallbackHostName;
      
      const payload = {
        licenseKey: targetKey,
        buyerEmail: targetEmail,
        requestDomain: requestDomain
      };

      const extResponse = await fetch(extApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${extApiKey}`
        },
        body: JSON.stringify(payload)
      });

      const resData: any = await extResponse.json();

      if (extResponse.ok && resData.valid) {
        // --- Write (Sync) to local Firestore ---
        try {
          const admin = await getFirebaseAdmin();
          const serverDb = admin.firestore();
          
          await serverDb.collection("licenses").doc(targetEmail).set({
            email: targetEmail,
            licenseKey: targetKey,
            plan: resData.license?.plan || "Pro",
            active: true,
            activatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Hapus permintaan lisensi yang ada karena sudah aktif sekarang secara otomatis
          await serverDb.collection("license_requests").doc(targetEmail).delete().catch(() => {});
        } catch (dbErr: any) {
          console.error("Gagal menyinkronkan lisensi ke Firestore lokal:", dbErr);
        }

        return res.json({
          valid: true,
          message: resData.message || "Lisensi berhasil diverifikasi!",
          license: {
            licenseKey: resData.license?.licenseKey || targetKey,
            email: resData.license?.email || targetEmail,
            plan: resData.license?.plan || "Pro",
            activatedAt: resData.license?.activatedAt || new Date().toISOString()
          }
        });
      } else {
        return res.status(extResponse.status).json({
          valid: false,
          message: resData.message || "Verifikasi gagal: kunci lisensi tidak valid atau diblokir."
        });
      }
    } catch (fetchErr: any) {
      console.error("Gagal terhubung ke API Lisensi Eksternal, melakukan fallback ke Firestore lokal...", fetchErr);
    }
  }

  // Fallback to Local Firestore
  try {
    const admin = await getFirebaseAdmin();
    const serverDb = admin.firestore();

    // Query licenses
    const snapshot = await serverDb.collection("licenses").where("licenseKey", "==", targetKey).get();

    if (snapshot.empty) {
      return res.status(404).json({
        valid: false,
        message: "Lisensi tidak ditemukan. Silakan periksa kembali kunci lisensi Anda."
      });
    }

    const licenseDoc = snapshot.docs[0];
    const licenseData = licenseDoc.data();

    if (licenseData.active === false) {
      return res.status(403).json({
        valid: false,
        message: "Lisensi ini tidak aktif."
      });
    }

    const registeredEmail = (licenseData.email || "").toLowerCase();
    if (registeredEmail && targetEmail !== registeredEmail) {
      return res.status(403).json({
        valid: false,
        message: "Kunci ini terdaftar untuk email lain. Harap hubungi admin."
      });
    }

    // Clean up pending requests
    await serverDb.collection("license_requests").doc(targetEmail).delete().catch(() => {});

    // Success response
    return res.json({
      valid: true,
      message: "Sukses memverifikasi lisensi!",
      license: {
        licenseKey: licenseData.licenseKey,
        email: licenseData.email,
        plan: licenseData.plan || "Pro",
        activatedAt: licenseData.activatedAt
      }
    });

  } catch (err: any) {
    console.error("Error in client-verify API:", err);
    return res.status(500).json({
      valid: false,
      message: err.message
    });
  }
});

// Vite middleware for development
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), "dist");
      app.use(express.static(distPath));
      
      // Use regex catch-all for Express 5 compatibility (matches everything)
      app.get(/^((?!\/api).)*$/, (req, res) => {
        const indexPath = path.resolve(distPath, "index.html");
        res.sendFile(indexPath);
      });
    }

    // Only listen if not running as a Vercel function
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server listening on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("FAILED TO START SERVER:", error);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
