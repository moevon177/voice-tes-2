/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
// Removed client-side GoogleGenAI imports
import { 
  Mic, Play, Square, Download, Settings2, Sparkles, Loader2, Volume2, 
  History, Mic2, Sun, Moon, LogIn, LogOut, Menu, X, Trash2, Key, Info, Search, Cloud,
  MicVocal, ChevronRight, Headphones, Bell, User as UserIcon, Copy, ChevronDown,
  Folder, ExternalLink, Bookmark, MessageCircle, ShieldCheck, Users, Check, XCircle,
  AlertCircle, FileAudio, FileVideo, Pause, Languages, Upload, Eye, EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import WaveSurfer from "wavesurfer.js";
import { useTranslation } from "react-i18next";
import { OnboardingTour, TourStep } from "./components/OnboardingTour";
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  GoogleAuthProvider,
  db, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc, 
  onAuthStateChanged,
  OperationType,
  handleFirestoreError,
  setCachedToken,
  getCachedToken,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from "./lib/firebase";
import type { User } from "./lib/firebase";
import AppLogo from "./components/AppLogo";

// --- Types & Constants ---

const APP_VERSION = "1.1.0";

function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}-${part()}`;
}

const TOUR_STEPS: TourStep[] = [
  {
    element: "#apiKeyButton",
    title: "Gemini API Key",
    description: "Hubungkan API Key Gemini Anda di sini untuk mengaktifkan mesin AI Voice. Anda bisa mendapatkannya secara gratis di Google AI Studio."
  },
  {
    element: "#scriptContent",
    title: "Script Generator",
    description: "Tulis atau tempel script Anda di sini. Gunakan tag emosi seperti [ceria] atau [formal] untuk hasil yang lebih ekspresif."
  },
  {
    element: "#audioProfile",
    title: "Karakter Suara",
    description: "Pilih dari puluhan model suara profesional. Anda bisa memfilter berdasarkan gender dan gaya bicara."
  },
  {
    element: "#sceneContext",
    title: "Scene Context",
    description: "Atur environment audio (misal: Ruang Kedap Suara, Stadiun) untuk memberikan dimensi pada suara yang dihasilkan."
  },
  {
    element: "#directorNote",
    title: "Director's Note",
    description: "Berikan instruksi khusus pada AI tentang emosi, penekanan kata, atau gaya bicara tertentu."
  },
  {
    element: "#generateButton",
    title: "Mulai Generating",
    description: "Klik Generate untuk merender script menjadi audio berkualitas tinggi. Dibutuhkan waktu 5-10 detik per 100 karakter."
  },
  {
    element: "#audioHistory",
    title: "History Asset",
    description: "Dengarkan dan unduh semua audio yang pernah Anda buat di panel history ini."
  },
  {
    element: "#guideButton",
    title: "Pusat Bantuan",
    description: "Klik tombol ini kapan saja jika Anda butuh panduan ulang atau bantuan fitur."
  }
];

const VOICE_OPTIONS = [
  // Wanita (Female)
  { id: "Aoede", name: "Aoede (Breezy — Middle pitch)", type: "Wanita", tags: ["Informasi", "Natural", "Calm"] },
  { id: "Autonoe", name: "Autonoe (Bright — Middle pitch)", type: "Wanita", tags: ["Promosi", "Energetik", "Iklan"] },
  { id: "Callirrhoe", name: "Callirrhoe (Easy-going — Middle pitch)", type: "Wanita", tags: ["Informasi", "Friendly", "Natural"] },
  { id: "Despina", name: "Despina (Smooth — Middle pitch)", type: "Wanita", tags: ["Narasi", "Gentle", "Calm"] },
  { id: "Erinome", name: "Erinome (Clear — Middle pitch)", type: "Wanita", tags: ["Informasi", "Professional", "Clear"] },
  { id: "Kore", name: "Kore (Firm — Middle pitch)", type: "Wanita", tags: ["Iklan", "Tegas", "Energetik"] },
  { id: "Laomedeia", name: "Laomedeia (Upbeat — Higher pitch)", type: "Wanita", tags: ["Promosi", "Cheerful", "Upbeat"] },
  { id: "Leda", name: "Leda (Youthful — Higher pitch)", type: "Wanita", tags: ["Cheerful", "Young", "Natural"] },
  { id: "Pulcherrima", name: "Pulcherrima (Forward — Middle pitch)", type: "Wanita", tags: ["Promosi", "Direct", "Iklan"] },
  { id: "Sulafat", name: "Sulafat (Warm — Middle pitch)", type: "Wanita", tags: ["Narasi", "Warm", "Gentle"] },
  { id: "Vindemiatrix", name: "Vindemiatrix (Gentle — Middle pitch)", type: "Wanita", tags: ["Poetic", "Gentle", "Calm"] },
  { id: "Zephyr", name: "Zephyr (Bright — Higher pitch)", type: "Wanita", tags: ["Promosi", "Energetik", "Cheerful"] },
  // Pria (Male)
  { id: "Achernar", name: "Achernar (Soft — Higher pitch)", type: "Pria", tags: ["Narasi", "Soft", "Calm"] },
  { id: "Achird", name: "Achird (Friendly — Lower middle pitch)", type: "Pria", tags: ["Informasi", "Friendly", "Professional"] },
  { id: "Algenib", name: "Algenib (Gravelly — Lower pitch)", type: "Pria", tags: ["Narasi", "Tegas", "Heavy"] },
  { id: "Algieba", name: "Algieba (Smooth — Lower pitch)", type: "Pria", tags: ["Narasi", "Smooth", "Calm"] },
  { id: "Alnilam", name: "Alnilam (Firm — Lower middle pitch)", type: "Pria", tags: ["Informasi", "Tegas", "Professional"] },
  { id: "Charon", name: "Charon (Informative — Lower pitch)", type: "Pria", tags: ["Informasi", "Direct", "Broadcasting"] },
  { id: "Enceladus", name: "Enceladus (Breathy — Lower pitch)", type: "Pria", tags: ["Poetic", "Whisper", "Calm"] },
  { id: "Fenrir", name: "Fenrir (Excitable — Lower middle pitch)", type: "Pria", tags: ["Energetik", "Promosi", "Excited"] },
  { id: "Gacrux", name: "Gacrux (Mature — Middle pitch)", type: "Pria", tags: ["Narasi", "Mature", "Wise"] },
  { id: "Iapetus", name: "Iapetus (Clear — Lower middle pitch)", type: "Pria", tags: ["Informasi", "Clear", "Natural"] },
  { id: "Orus", name: "Orus (Firm — Lower middle pitch)", type: "Pria", tags: ["Iklan", "Tegas", "Professional"] },
  { id: "Puck", name: "Puck (Upbeat — Middle pitch)", type: "Pria", tags: ["Cheerful", "Upbeat", "Friendly"] },
  { id: "Rasalgethi", name: "Rasalgethi (Informative — Middle pitch)", type: "Pria", tags: ["Informasi", "Broadcasting", "Clear"] },
  { id: "Sadachbia", name: "Sadachbia (Lively — Lower pitch)", type: "Pria", tags: ["Promosi", "Energetik", "Lively"] },
  { id: "Sadaltager", name: "Sadaltager (Knowledgeable — Middle pitch)", type: "Pria", tags: ["Informasi", "Teacher", "Calm"] },
  { id: "Schedar", name: "Schedar (Even — Lower middle pitch)", type: "Pria", tags: ["Narasi", "Natural", "Clear"] },
  { id: "Umbriel", name: "Umbriel (Easy-going — Lower middle pitch)", type: "Pria", tags: ["Informasi", "Casual", "Friendly"] },
  { id: "Zubenelgenubi", name: "Zubenelgenubi (Casual — Lower middle pitch)", type: "Pria", tags: ["Narasi", "Casual", "Natural"] },
];
// ... (rest of constants stay same)
const AUDIO_PROFILE_PRESETS = [
  "Warm & Balanced", "Cinematic Hero", "Studio Quality", "Vintage Radio", "Bright & Clear", "Natural Ambient",
  "Deep Bass", "Whisper Quiet", "Broadcasting HD", "Lo-Fi Aesthetic", "Dynamic Range", "Crystal Highs", "Bass Boosted", "Telephone Line", "Underwater", "Space Void"
];

const SCENE_CONTEXT_PRESETS = [
  "Quiet Room", "Open Stadium", "Underground Cave", "Modern Office", "Car Interior", "Classroom",
  "Busy Street", "Small Closet", "Grand Cathedral", "Echoing Hallway", "Forest at Night", "Airplane Cabin", "Deep Sea", "Rainy Porch", "Cyberpunk City", "Empty Library"
];
const PACE_OPTIONS = [
  { id: "natural", label: "Natural", description: "Natural conversational pace." },
  { id: "rapid", label: "Rapid Fire", description: "Fast, energetic, no dead air. Sentences overlap slightly." },
  { id: "drift", label: "The Drift", description: "Slow, liquid, zero urgency. Long pauses for breath." },
  { id: "staccato", label: "Staccato", description: "Short, clipped sentences with distinct pauses between words." },
];
const ACCENT_OPTIONS = ["Neutral"];

const DIRECTOR_NOTE_PRESETS = [
  { label: "Ceria", value: "Sangat bersemangat, penuh energi, bicara cepat dan ceria." },
  { label: "Tenang", value: "Suara lembut, menenangkan, tempo bicara lambat dan teratur." },
  { label: "Tegas", value: "Nada bicara tegas, lugas, berwibawa, dan penuh penekanan." },
  { label: "Sedih", value: "Suara pelan, penuh emosi haru, tempo sangat lambat." },
  { label: "Misterius", value: "Suara berat, berbisik, ada jeda dramatis yang membuat penasaran." },
  { label: "Marah", value: "Bicara dengan nada tinggi, kasar, penuh amarah dan emosi yang meledak-ledak." },
  { label: "Takut", value: "Suara gemetar, gagap, napas terengah-engah, seperti sedang dalam bahaya." },
  { label: "Sarkastik", value: "Nada bicara yang mengejek, sinis, dengan penekanan pada kata-kata tertentu." },
  { label: "Formal", value: "Bicara dengan artikulasi yang sangat jelas, nada datar, profesional, dan berwibawa." },
  { label: "Ramah", value: "Suara yang hangat, penuh senyum, intonasi naik turun secara natural dan menyambut." },
  { label: "Lelah", value: "Suara rendah, serak, banyak helaan napas, tempo sangat lambat, terdengar sangat letih." },
  { label: "Bingung", value: "Banyak jeda, intonasi yang tidak pasti di akhir kalimat, bicara agak terbata-bata." }
];

interface AudioHistoryItem {
  id: string;
  userId: string;
  transcript: string;
  audioProfile: string;
  scene: string;
  directorNote: string;
  voice: string;
  pace: string;
  accent: string;
  temperature: number;
  timestamp: number;
  audioUrl?: string;
  audioBase64?: string;
  audioTooLarge?: boolean;
}

interface VoicePreset {
  id: string;
  userId: string;
  name: string;
  voice: string;
  voiceGender: "Wanita" | "Pria";
  audioProfile: string;
  directorNote: string;
  scene: string;
  pace: string;
  accent: string;
  temperature: number;
  createdAt: number;
}

// --- Utils ---
// ... (pcmToWav stay same)
/**
 * Converts raw PCM (L16) data to a WAV file blob.
 * Standard Gemini TTS output is L16, 24000Hz, single channel.
 */
function pcmToWav(base64Data: string, sampleRate = 24000): Blob {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, len, true);

  // write the PCM data
  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, binaryString.charCodeAt(i));
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// --- Wavesurfer Component ---

const WaveformPlayer = ({ audioUrl, theme }: { audioUrl: string; theme: "light" | "dark" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: theme === "dark" ? "rgba(79, 70, 229, 0.4)" : "rgba(99, 102, 241, 0.4)",
      progressColor: theme === "dark" ? "#818cf8" : "#4f46e5",
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      height: 40,
      normalize: true,
      url: audioUrl,
    });

    wavesurfer.on("play", () => setIsPlaying(true));
    wavesurfer.on("pause", () => setIsPlaying(false));
    wavesurfer.on("finish", () => setIsPlaying(false));

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, theme]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  return (
    <div className={`p-4 rounded-2xl flex items-center gap-4 transition-all ${
      theme === "dark" ? "bg-white/[0.03] border border-white/5" : "bg-slate-50 border border-slate-100"
    }`}>
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
          theme === "dark" ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        }`}
      >
        {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div ref={containerRef} className="flex-1 min-w-0" />
    </div>
  );
};

function parseUserAgent(ua: string): string {
  if (!ua) return "Browser/Device";
  const lowercase = ua.toLowerCase();
  
  let os = "OS Lain";
  if (lowercase.includes("windows")) os = "Windows";
  else if (lowercase.includes("macintosh") || lowercase.includes("mac os")) os = "macOS";
  else if (lowercase.includes("android")) os = "Android";
  else if (lowercase.includes("iphone") || lowercase.includes("ipad")) os = "iOS";
  else if (lowercase.includes("linux")) os = "Linux";
  
  let browser = "Peramban";
  if (lowercase.includes("chrome") || lowercase.includes("chromium")) browser = "Chrome";
  else if (lowercase.includes("safari")) browser = "Safari";
  else if (lowercase.includes("firefox")) browser = "Firefox";
  else if (lowercase.includes("edge")) browser = "Edge";
  else if (lowercase.includes("opera") || lowercase.includes("opr")) browser = "Opera";
  
  return `${browser} (${os})`;
}

// --- Components ---

export default function App() {
  const { t, i18n } = useTranslation();
  const [transcript, setTranscript] = useState("Pernah nggak sih ngerasa kulit lagi rewel banget, kusam, dan gampang breakout padahal ngerasa udah rajin skincare-an?");
  const [audioProfile, setAudioProfile] = useState("Bright & Clear");
  const [directorNote, setDirectorNote] = useState(DIRECTOR_NOTE_PRESETS[9].value); // Default to "Ramah" (Friendly)
  const [scene, setScene] = useState("Quiet Room");
  const [pace, setPace] = useState(PACE_OPTIONS[0].id);
  const [accent, setAccent] = useState(ACCENT_OPTIONS[0]);
  const [temperature, setTemperature] = useState(1);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Autonoe");
  const [voiceGender, setVoiceGender] = useState<"Wanita" | "Pria">("Wanita");
  const [isGenerating, setIsGenerating] = useState(false);

  // Keep selectedVoice consistent with selected gender
  useEffect(() => {
    const currentVoice = VOICE_OPTIONS.find(v => v.id === selectedVoice);
    if (!currentVoice || currentVoice.type !== voiceGender) {
      const firstOfGender = VOICE_OPTIONS.find(v => v.type === voiceGender);
      if (firstOfGender) {
        setSelectedVoice(firstOfGender.id);
      }
    }
  }, [voiceGender]);

  // Sync gender filter when voice is selected from history or other sources
  useEffect(() => {
    const currentVoice = VOICE_OPTIONS.find(v => v.id === selectedVoice);
    if (currentVoice && currentVoice.type !== voiceGender) {
      setVoiceGender(currentVoice.type as "Wanita" | "Pria");
    }
  }, [selectedVoice]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentPcmBase64, setCurrentPcmBase64] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [activeView, setActiveView] = useState<"studio" | "history" | "settings" | "gdrive" | "imageVoice" | "transcription" | "admin">("studio");
  const [driveToken, setDriveToken] = useState<string | null>(() => {
    const stored = getCachedToken();
    return (stored && stored !== "undefined") ? stored : null;
  });
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);

  const findOrCreateDriveFolder = async (token: string) => {
    try {
      // Search for folder
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='SRFactory Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        const folderId = searchData.files[0].id;
        console.log("Folder found:", folderId);
        setDriveFolderId(folderId);
        return folderId;
      } else {
        // Create folder
        const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'SRFactory Recordings',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        const createdFolder = await createFolderResponse.json();
        const folderId = createdFolder.id;
        console.log("Folder created:", folderId);
        setDriveFolderId(folderId);
        return folderId;
      }
    } catch (err) {
      console.error("Error finding/creating folder:", err);
      return null;
    }
  };

  useEffect(() => {
    if (driveToken && !driveFolderId) {
      findOrCreateDriveFolder(driveToken);
    }
  }, [driveToken]);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isGDriveDisconnectModalOpen, setIsGDriveDisconnectModalOpen] = useState(false);
  const [userApiKeys, setUserApiKeys] = useState<string[]>(() => {
    const stored = localStorage.getItem("gemini_api_keys");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const single = localStorage.getItem("gemini_api_key");
    return single ? [single] : [""];
  });
  const [keyStatuses, setKeyStatuses] = useState<Record<string, { status: 'active' | 'exhausted' | 'testing' | 'idle', message?: string }>>({});
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<number, boolean>>({});
  const [showApiKeyGuide, setShowApiKeyGuide] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [license, setLicense] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLicenseLoading, setIsLicenseLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userLicenseKey, setUserLicenseKey] = useState(() => localStorage.getItem("licenseKey") || "");

  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem("app_session_id");
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem("app_session_id", id);
    }
    return id;
  });
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isSessionBlocked, setIsSessionBlocked] = useState(false);

  const clearOtherSessions = async () => {
    if (!user?.email) return;
    const toastId = toast.loading("Membersihkan sesi lain...");
    try {
      const q = query(
        collection(db, "sessions"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      let deletedCount = 0;
      for (const d of snapshot.docs) {
        if (d.id !== sessionId) {
          await deleteDoc(doc(db, "sessions", d.id));
          deletedCount++;
        }
      }
      toast.success(`Berhasil mengeluarkan ${deletedCount} sesi lain!`, { id: toastId });
      setIsSessionBlocked(false);
    } catch (err) {
      console.error("Gagal mengeluarkan sesi lain:", err);
      toast.error("Gagal mengeluarkan sesi lain", { id: toastId });
    }
  };

  // Concurrent Session Control (Maksimal 5 Sesi per Akun)
  useEffect(() => {
    if (!user?.email || !user?.uid || isLicenseLoading || (!license && !isAdmin)) {
      setActiveSessions([]);
      setIsSessionBlocked(false);
      return;
    }

    const sessionDocRef = doc(db, "sessions", sessionId);
    
    const writeSessionWithRetry = async (retryCount = 0) => {
      if (!user?.uid) return;
      try {
        await setDoc(sessionDocRef, {
          userId: user.uid,
          email: user.email,
          lastActive: serverTimestamp(),
          userAgent: navigator.userAgent
        }, { merge: true });
      } catch (err: any) {
        console.warn(`[Session] Percobaan ${retryCount + 1} menulis sesi aktif gagal:`, err);
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          setTimeout(() => writeSessionWithRetry(retryCount + 1), delay);
        } else {
          console.error("[Session] Gagal menulis sesi aktif setelah percobaan maksimum:", err);
          handleFirestoreError(err, OperationType.WRITE, `sessions/${sessionId}`);
        }
      }
    };

    // Jalankan penulisan sesi pertama
    writeSessionWithRetry(0);

    // Heartbeat berkala setiap 20 detik
    const intervalId = setInterval(() => writeSessionWithRetry(0), 15000);

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const docs: any[] = [];
      const expiredDocs: any[] = [];

      snapshot.forEach((d) => {
        const data = d.data();
        const lastActiveDate = data.lastActive?.toDate() || new Date();
        const ageMs = now - lastActiveDate.getTime();

        // Anggap sesi tidak aktif jika tidak ada heartbeat selama 90 detik (1.5 menit)
        if (ageMs < 90000) {
          docs.push({ id: d.id, ...data, lastActiveDate });
        } else {
          expiredDocs.push(d.id);
        }
      });

      // Bersihkan sesi yang sudah kadaluarsa secara asinkron
      expiredDocs.forEach(async (id) => {
        try {
          await deleteDoc(doc(db, "sessions", id));
        } catch (e) {
          console.error(`[Session] Gagal membersihkan sesi kedaluwarsa ${id}:`, e);
        }
      });

      // Urutkan sesi aktif dari yang paling baru diaktifkan/heartbeat
      docs.sort((a, b) => b.lastActiveDate.getTime() - a.lastActiveDate.getTime());
      setActiveSessions(docs);

      // Batasi maksimal 5 sesi teraktif
      if (docs.length > 5) {
        const top5Ids = docs.slice(0, 5).map(s => s.id);
        if (!top5Ids.includes(sessionId)) {
          setIsSessionBlocked(true);
        } else {
          setIsSessionBlocked(false);
        }
      } else {
        setIsSessionBlocked(false);
      }
    }, (err) => {
      console.error("Error listening to active sessions:", err);
      handleFirestoreError(err, OperationType.LIST, "sessions");
    });

    // Event listener untuk menghapus sesi secara instan saat tab ditutup / direload
    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        deleteDoc(sessionDocRef).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      unsub();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (auth.currentUser) {
        deleteDoc(sessionDocRef).catch(() => {});
      }
    };
    function unsub() {
      if (unsubscribe) unsubscribe();
    }
  }, [user?.email, user?.uid, sessionId, license, isAdmin, isLicenseLoading]);

  useEffect(() => {
    if (user?.email) {
      setIsLicenseLoading(true);
      const docRef = doc(db, "licenses", user.email);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.licenseKey) {
            if (userLicenseKey === data.licenseKey) {
              setLicense(data);
              setIsAdmin(data.plan === "Admin");
            } else {
              setLicense(null);
            }
          } else {
            // Legacy / direct approval (without key) support
            setLicense(data);
            setIsAdmin(data.plan === "Admin");
          }
        } else {
          setLicense(null);
          // Default admin check for initial setup
          if (user.email === "rizkirifai058@gmail.com") {
            setIsAdmin(true);
          }
        }
        setIsLicenseLoading(false);
      }, (err) => {
        console.error("Error watching license:", err);
        setIsLicenseLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLicense(null);
      setIsAdmin(false);
    }
  }, [user?.email, userLicenseKey]);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Show tour if not completed
    const storedTour = localStorage.getItem("tour_completed");
    const tourCompleted = storedTour && storedTour !== "undefined";
    if (!tourCompleted) {
      setTimeout(() => setIsTourOpen(true), 2000);
    }
  }, []);

  useEffect(() => {
    // Show API Key guide if neither local key nor env key exists
    const hasKey = userApiKeys.some(k => k.trim() !== "") || process.env.GEMINI_API_KEY;
    if (!hasKey) {
      setTimeout(() => setShowApiKeyGuide(true), 1500);
    }
  }, [userApiKeys]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        fetchHistory(currentUser.uid);
        fetchPresets(currentUser.uid);
      } else {
        setHistory([]);
        setPresets([]);
        setLicense(null);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchPresets = async (userId: string) => {
    try {
      const q = query(
        collection(db, "presets"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const items: VoicePreset[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as VoicePreset);
      });
      setPresets(items);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "presets");
    }
  };

  const savePreset = async () => {
    if (!user || !newPresetName.trim()) return;
    setIsSavingPreset(true);
    const toastId = toast.loading("Menyimpan preset...");
    try {
      const presetData: Omit<VoicePreset, "id"> = {
        userId: user.uid,
        name: newPresetName.trim(),
        voice: selectedVoice,
        voiceGender,
        audioProfile,
        directorNote,
        scene,
        pace,
        accent,
        temperature,
        createdAt: Date.now()
      };
      const docRef = await addDoc(collection(db, "presets"), presetData);
      setPresets(prev => [{ id: docRef.id, ...presetData }, ...prev]);
      setIsPresetModalOpen(false);
      setNewPresetName("");
      toast.success("Preset berhasil disimpan!", { id: toastId });
    } catch (err) {
      toast.error("Gagal menyimpan preset", { id: toastId });
      handleFirestoreError(err, OperationType.CREATE, "presets");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const deletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, "presets", id));
      setPresets(prev => prev.filter(p => p.id !== id));
      toast.success("Preset dihapus");
    } catch (err) {
      toast.error("Gagal menghapus preset");
      handleFirestoreError(err, OperationType.DELETE, `presets/${id}`);
    }
  };

  const applyPreset = (preset: VoicePreset) => {
    setSelectedVoice(preset.voice);
    setVoiceGender(preset.voiceGender);
    setAudioProfile(preset.audioProfile);
    setDirectorNote(preset.directorNote);
    setScene(preset.scene);
    setPace(preset.pace);
    setAccent(preset.accent);
    setTemperature(preset.temperature);
    toast.success(`Preset "${preset.name}" diterapkan`);
  };

  const fetchHistory = async (userId: string) => {
    try {
      const q = query(
        collection(db, "history"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(q);
      const items: AudioHistoryItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as AudioHistoryItem);
      });
      setHistory(items);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "history");
    }
  };

  const deleteHistoryItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "history", id));
      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success("Riwayat dihapus");
    } catch (err) {
      toast.error(t('toasts.errorHistoryDelete'));
      handleFirestoreError(err, OperationType.DELETE, `history/${id}`);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedToken(credential.accessToken);
      }
      toast.success(t('toasts.successLogin'));
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
        toast.info("Proses masuk dibatalkan");
      } else {
        setError(t('toasts.errorLogin'));
        toast.error(t('toasts.errorLogin'));
      }
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setCachedToken(null);
      toast.success(t('toasts.successLogout'));
    } catch (err) {
      console.error("Logout failed:", err);
      toast.error(t('toasts.errorLogout'));
    }
  };

  const saveToGoogleDrive = async (blob: Blob, filenameSuggestion: string) => {
    console.log("Starting Google Drive upload process...");
    setIsSavingToDrive(true);
    const toastId = toast.loading(t('toasts.startDriveSave'));
    
    try {
      let token = getCachedToken();
      
      if (!token) {
        console.log("No token found, requesting authorization...");
        toast.loading("Meminta izin akses Google Drive...", { id: toastId });
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        token = credential?.accessToken || null;
        if (token) {
          setCachedToken(token);
          setDriveToken(token);
          console.log("Token obtained successfully.");
        } else {
          console.error("Failed to extract access token from result.");
          toast.error(t('toasts.errorDriveSave'), { id: toastId });
          setIsSavingToDrive(false);
          return;
        }
      }

      // 1. Get or Create Folder "SRFactory Recordings"
      let folderId = driveFolderId;
      if (!folderId) {
        toast.loading("Mempersiapkan folder SRFactory...", { id: toastId });
        folderId = await findOrCreateDriveFolder(token);
      }

      const metadata = {
        name: `SRFactory-${filenameSuggestion.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.wav`,
        mimeType: 'audio/wav',
        parents: folderId ? [folderId] : []
      };

      console.log("Preparing audio data...");
      toast.loading("Mempersiapkan data audio...", { id: toastId });
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error(t('toasts.errorRender')));
        reader.readAsDataURL(blob);
      });

      const base64Data = await base64Promise;
      const boundary = 'SRFACTORY_BOUNDARY';
      const body = 
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: audio/wav\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n` +
        `${base64Data}\r\n` +
        `--${boundary}--`;

      console.log("Uploading to Google Drive API...");
      toast.loading("Mengunggah ke My Drive...", { id: toastId });

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      });

      if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({}));
        console.error("Drive upload error detail:", errorDetail);

        if (response.status === 401) {
          setCachedToken(null);
          console.warn("Token expired, clearing cache.");
          toast.error("Sesi kadaluarsa", { 
            id: toastId, 
            description: "Klik simpan lagi untuk memperbarui izin." 
          });
          setIsSavingToDrive(false);
          return;
        }
        
        const errorMessage = errorDetail.error?.message || response.statusText || "Gagal mengunggah ke Drive";
        
        if (errorMessage.includes("Google Drive API has not been used") || errorMessage.includes("disabled")) {
          const projectId = "srfactoryportal";
          toast.error("Google Drive API Belum Aktif di Project Firebase", {
            id: toastId,
            description: `API harus diaktifkan untuk project ID '${projectId}'. Project 'srfactory' berbeda dengan project Firebase Anda.`,
            action: {
              label: "Buka Console",
              onClick: () => window.open(`https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`, '_blank')
            },
            duration: 15000
          });
          setIsSavingToDrive(false);
          return;
        }

        throw new Error(errorMessage);
      }

      console.log("Upload successful!");
      toast.success(t('toasts.successDriveSave'), { 
        id: toastId,
        description: t('drive.connectedHint') 
      });
    } catch (err: any) {
      console.error("Drive save error:", err);
      if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
        toast.info("Aktivasi izin dihentikan oleh pengguna.", { id: toastId });
      } else {
        toast.error(t('toasts.errorDriveSave'), { 
          id: toastId,
          description: err.message || "Pastikan koneksi internet stabil." 
        });
      }
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const completeTour = () => {
    setIsTourOpen(false);
    localStorage.setItem("tour_completed", "true");
    toast.success("Tutorial complete! Happy creating."); // hardcoded English for now since it's a generic success
  };

  const saveApiKeys = (keys: string[]) => {
    const filtered = keys.filter(k => k.trim() !== "");
    setUserApiKeys(filtered.length > 0 ? filtered : [""]);
    localStorage.setItem("gemini_api_keys", JSON.stringify(filtered));
    localStorage.setItem("gemini_api_key", filtered[0] || "");
    setActiveView("studio");
    toast.success(t('toasts.successApiKey'));
  };

  const checkKeyStatus = async (key: string) => {
    if (!key.trim()) return;
    setKeyStatuses(prev => ({ ...prev, [key]: { status: 'testing' } }));
    try {
      const response = await fetch("/api/check-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await response.json();
      setKeyStatuses(prev => ({ ...prev, [key]: { status: data.status, message: data.message } }));
    } catch (err) {
      setKeyStatuses(prev => ({ ...prev, [key]: { status: 'exhausted', message: "Network Error" } }));
    }
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const selectedPaceObj = PACE_OPTIONS.find(p => p.id === pace) || PACE_OPTIONS[0];
      const fullPrompt = `Read the following transcript based on the audio profile and director's note.

# Audio Profile
${audioProfile}

# Director's note
${directorNote}

## Pace:
${selectedPaceObj.label}: ${selectedPaceObj.description}

## Accent:
${accent}

## Scene:
${scene}

## Transcript:
${transcript}`;

      const response = await fetch("/api/generate-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          voiceName: selectedVoice,
          temperature: temperature,
          apiKey: userApiKeys // Still allow user-provided keys
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal mengambil data audio dari server.");
      }

      const { audioBase64: base64Audio } = await response.json();

      if (base64Audio) {
        const audioBlob = pcmToWav(base64Audio);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setCurrentPcmBase64(base64Audio);
        toast.success(t('toasts.successRender'));

        const historyData = {
          userId: user?.uid || "anonymous",
          transcript: transcript,
          audioProfile,
          scene,
          directorNote,
          voice: selectedVoice,
          pace,
          accent,
          temperature,
          timestamp: Date.now(),
          audioBase64: base64Audio // Save base64 for history playback
        };

        if (user) {
          try {
            // Firestore sync: Omit audio data if it exceeds 800KB to avoid the 1MB limit error
            const isTooLarge = base64Audio.length > 800000;
            const dataToSync = { ...historyData };
            
            if (isTooLarge) {
              delete dataToSync.audioBase64;
              (dataToSync as any).audioTooLarge = true;
              toast.info(t('toasts.cloudLimit'));
            }

            const docRef = await addDoc(collection(db, "history"), dataToSync);
            setHistory(prev => [{ id: docRef.id, ...historyData } as AudioHistoryItem, ...prev]);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, "history");
          }
        } else {
          setHistory(prev => [{ id: Math.random().toString(), ...historyData } as AudioHistoryItem, ...prev].slice(0, 10));
        }

        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play();
          }
        }, 100);
      } else {
        throw new Error("Gagal mengambil data audio dari server.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('toasts.errorRender'));
      toast.error(t('toasts.errorRender'));
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-500/30 transition-colors duration-300 overflow-x-hidden ${
      theme === "dark" 
        ? "bg-[#070708] text-zinc-100" 
        : "bg-[#f7f8fc] text-slate-900"
    }`}>
      <Toaster position="top-center" expand={true} richColors theme={theme === "dark" ? "dark" : "light"} />
      
      <OnboardingTour 
        steps={TOUR_STEPS} 
        isOpen={isTourOpen} 
        onComplete={completeTour} 
        theme={theme} 
      />

      {/* API Key Guided Overlay */}
      <AnimatePresence>
        {showApiKeyGuide && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 sm:right-6 md:right-10 z-[110] max-w-[260px]"
          >
            <div className={`p-4 rounded-2xl border shadow-2xl relative ${
              theme === "dark" ? "bg-zinc-900 border-indigo-500/50 text-white shadow-indigo-500/10" : "bg-white border-indigo-200 text-slate-800 shadow-xl"
            }`}>
               {/* Decorative Arrow Pointing Up to the Key Button */}
               <div className={`absolute -top-2 right-10 w-4 h-4 border-t border-l rotate-45 ${
                 theme === "dark" ? "bg-zinc-900 border-indigo-500/50" : "bg-white border-indigo-200"
               }`} />

               <button 
                 onClick={() => setShowApiKeyGuide(false)}
                 className="absolute top-2 right-2 p-1 hover:bg-black/5 rounded-full transition-colors"
                 aria-label="Close Guide"
               >
                 <X className="w-3.5 h-3.5 opacity-40" />
               </button>
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center animate-bounce">
                     <Key className="w-4 h-4 text-white" aria-hidden="true" />
                  </div>
                  <span className="font-bold text-xs">Belum Ada API Key?</span>
               </div>
               <p className="text-[11px] leading-relaxed opacity-70 mb-4">
                 Siapkan API Key Gemini Anda di sini untuk mengaktifkan AI Studio. Anda bisa mendapatkannya secara gratis di Google AI Studio.
               </p>
               <button 
                 id="apiKeyButton"
                 onClick={() => {
                   setActiveView("settings");
                   setShowApiKeyGuide(false);
                 }}
                 className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20"
               >
                 Input API Key
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[130] p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm p-8 rounded-3xl border shadow-2xl ${
                theme === "dark" ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
              }`}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>
              
              <h2 className="text-xl font-bold text-center mb-2">{t('modals.logoutTitle')}</h2>
              <p className="text-sm opacity-60 text-center mb-8">
                {t('modals.logoutMessage', { name: user?.displayName || "ini" })}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className={`py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    theme === "dark" 
                      ? "bg-white/5 hover:bg-white/10 text-zinc-400" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {t('modals.cancel')}
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsLogoutModalOpen(false);
                  }}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-600/20"
                >
                  {t('modals.confirmLogout')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tutorial Modal */}
      <AnimatePresence>
        {isGDriveDisconnectModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[150] p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGDriveDisconnectModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm p-8 rounded-3xl border shadow-2xl ${
                theme === "dark" ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
              }`}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Cloud className="w-8 h-8 text-red-500" />
              </div>
              
              <h2 className="text-xl font-bold text-center mb-2">{t('modals.disconnectDriveTitle')}</h2>
              <p className="text-sm opacity-60 text-center mb-8">
                {t('modals.disconnectDriveMessage')}
              </p>
 
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setIsGDriveDisconnectModalOpen(false)}
                  className={`py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    theme === "dark" 
                      ? "bg-white/5 hover:bg-white/10 text-zinc-400" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {t('modals.cancel')}
                </button>
                <button
                  onClick={() => {
                    setCachedToken(null);
                    setDriveToken(null);
                    setIsGDriveDisconnectModalOpen(false);
                    toast.success(t('toasts.errorLogout')); // reusing or should I add a specific one? "GDrive Disconnected"
                  }}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-600/20"
                >
                  {t('modals.confirmDisconnect')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTutorialOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[120] p-4">
             <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTutorialOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-10 rounded-3xl border shadow-2xl custom-scrollbar ${
                theme === "dark" ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
              }`}
            >
               <button 
                 onClick={() => setIsTutorialOpen(false)} 
                 className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-all"
                 aria-label={t('modals.cancel')}
               >
                  <X className="w-6 h-6 text-zinc-500" />
               </button>

               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
                    <Mic2 className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('tutorial.title')}</h2>
                    <p className="text-sm opacity-50 font-medium">{t('tutorial.subtitle')}</p>
                  </div>
               </div>

               <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-indigo-400">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black border border-indigo-500/20">1</span>
                          <h4 className="font-bold text-sm uppercase tracking-wider">{t('tutorial.step1Title')}</h4>
                       </div>
                       <p className="text-xs leading-relaxed opacity-60">{t('tutorial.step1Desc')}</p>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-indigo-400">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black border border-indigo-500/20">2</span>
                          <h4 className="font-bold text-sm uppercase tracking-wider">{t('tutorial.step2Title')}</h4>
                       </div>
                       <p className="text-xs leading-relaxed opacity-60">{t('tutorial.step2Desc')}</p>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-indigo-400">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black border border-indigo-500/20">3</span>
                          <h4 className="font-bold text-sm uppercase tracking-wider">{t('tutorial.step3Title')}</h4>
                       </div>
                       <p className="text-xs leading-relaxed opacity-60">{t('tutorial.step3Desc')}</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-indigo-400">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black border border-indigo-500/20">4</span>
                          <h4 className="font-bold text-sm uppercase tracking-wider">{t('tutorial.step4Title')}</h4>
                       </div>
                       <p className="text-xs leading-relaxed opacity-60">{t('tutorial.step4Desc')}</p>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-indigo-400">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black border border-indigo-500/20">5</span>
                          <h4 className="font-bold text-sm uppercase tracking-wider">{t('tutorial.step5Title')}</h4>
                       </div>
                       <p className="text-xs leading-relaxed opacity-60">{t('tutorial.step5Desc')}</p>
                    </div>
                    <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 mt-4">
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.1em] mb-2">💡 {t('tutorial.tipsTitle')}</p>
                       <p className="text-[11px] leading-relaxed italic opacity-80">{t('tutorial.tipsContent')}</p>
                    </div>
                  </div>
               </div>

               <button 
                 onClick={() => setIsTutorialOpen(false)}
                 className="w-full mt-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-indigo-600/20"
               >
                 {t('tutorial.startBtn')}
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`fixed top-0 left-0 h-full w-[280px] z-[70] shadow-2xl p-6 flex flex-col border-r transition-colors ${
                theme === "dark" ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <Menu className="w-4 h-4 text-white" aria-hidden="true" />
                   </div>
                   <span className="font-bold tracking-tight">{t('menu.mainMenu')}</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)} 
                  className="p-1 hover:bg-white/5 rounded-md transition-colors"
                  aria-label={t('modals.cancel')}
                >
                   <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1 mb-8">
                <button
                  onClick={() => {
                    setActiveView("studio");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === "studio"
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600")
                      : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                  }`}
                >
                  <Mic2 className="w-4 h-4" />
                  <span className="text-sm font-bold">{t('menu.textToVoice')}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("imageVoice");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === "imageVoice"
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600")
                      : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-bold">{t('menu.imageToVoice')}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("transcription");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === "transcription"
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600")
                      : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                  }`}
                >
                  <Languages className="w-4 h-4" />
                  <span className="text-sm font-bold">AI Transcription</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("history");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === "history"
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600")
                      : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span className="text-sm font-bold">{t('menu.history')}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("settings");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === "settings"
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600")
                      : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                  }`}
                >
                  <Settings2 className="w-4 h-4" />
                  <span className="text-sm font-bold">{t('menu.settings')}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("gdrive");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeView === "gdrive"
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-600")
                      : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span className="text-sm font-bold">{t('menu.connectGDrive')}</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveView("admin");
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeView === "admin"
                        ? (theme === "dark" ? "bg-amber-500/20 text-amber-300" : "bg-amber-50 text-amber-600")
                        : (theme === "dark" ? "hover:bg-white/5 text-zinc-400" : "hover:bg-slate-100 text-slate-500")
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    <span className="text-sm font-bold">License Center</span>
                  </button>
                )}
              </nav>

              {user && (
                <div className="mt-auto pt-6 border-t border-white/5 flex items-center gap-3">
                   <img src={user.photoURL || ""} alt="" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                   <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{user.displayName}</p>
                      <button 
                        onClick={() => {
                          setIsSidebarOpen(false);
                          setIsLogoutModalOpen(true);
                        }} 
                        className="text-[10px] text-red-400 font-bold hover:underline"
                      >
                        {t('menu.signOut')}
                      </button>
                   </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>


      {/* Session Blocked Overlay for Concurrent Session Limit */}
      <AnimatePresence>
        {isSessionBlocked && (
          <motion.div 
            key="session-block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[230] flex flex-col items-center justify-center p-6 text-center backdrop-blur-3xl ${
              theme === 'dark' ? 'bg-[#070708]/95 text-white' : 'bg-slate-50/95 text-slate-900'
            }`}
          >
            <div className={`w-full max-w-md rounded-[32px] p-8 border shadow-2xl relative overflow-hidden backdrop-blur-md ${
              theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-100'
            }`}>
              <div className="absolute -inset-24 bg-red-500/5 blur-[100px] pointer-events-none" />
              
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-6 mx-auto relative z-10">
                <AlertCircle className="w-10 h-10" />
              </div>
              
              <h2 className="text-2xl font-black tracking-tight mb-2 relative z-10">
                Batas Sesi Terlampaui
              </h2>
              <p className="opacity-60 text-sm mb-6 leading-relaxed relative z-10">
                Satu akun maksimal hanya boleh digunakan pada <strong>5 sesi/perangkat secara bersamaan</strong> guna menjaga keamanan akun dari penggunaan bersama yang tidak sah.
              </p>

              <div className={`rounded-2xl p-4 mb-6 border text-left ${
                theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Sesi Aktif Anda ({activeSessions.length}):</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {activeSessions.map((s, idx) => (
                    <div key={s.id} className="flex justify-between items-center text-xs">
                      <span className="truncate max-w-[200px] opacity-80 font-bold">
                        {idx + 1}. {parseUserAgent(s.userAgent)}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                        s.id === sessionId 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-zinc-500/10 opacity-70'
                      }`}>
                        {s.id === sessionId ? 'Sesi Ini' : 'Aktif'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 relative z-10 font-bold">
                <button 
                  onClick={clearOtherSessions}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl transition-all shadow-lg hover:shadow-indigo-600/20 active:scale-[0.98]"
                >
                  Keluarkan Sesi Lainnya
                </button>
                <button 
                  onClick={() => auth.signOut()}
                  className={`w-full py-4 text-xs font-black uppercase tracking-[0.15em] rounded-2xl transition-all ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Keluar / Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* License Guard Overlays */}
      <AnimatePresence>
        {(isLicenseLoading || isAuthLoading) && (
          <motion.div 
             key="loading-license"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className={`fixed inset-0 z-[210] flex flex-col items-center justify-center gap-4 backdrop-blur-xl ${
               theme === 'dark' ? 'bg-[#070708]' : 'bg-[#f7f8fc]'
             }`}
          >
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="text-xs font-black uppercase tracking-[0.3em] opacity-20">
              {isAuthLoading ? "Authenticating" : "Verifying Identity"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {user && !license && !isAdmin && !isLicenseLoading && (
           <motion.div
             key="no-license"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[200]"
           >
              <LicenseOverlay 
                theme={theme} 
                user={user} 
                onVerified={(licenseData: any) => {
                  localStorage.setItem("licenseKey", licenseData.licenseKey);
                  setUserLicenseKey(licenseData.licenseKey);
                  setLicense(licenseData);
                  setIsAdmin(licenseData.plan === "Admin");
                }} 
              />
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!user && !isAuthLoading && (
          <motion.div 
            key="login-guard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[220] flex flex-col items-center justify-center p-8 text-center backdrop-blur-3xl ${
              theme === 'dark' ? 'bg-[#070708]' : 'bg-slate-50'
            }`}
          >
            <div className="mb-12 relative">
              <div className="absolute -inset-24 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute -inset-24 bg-violet-500/10 blur-[80px] rounded-full pointer-events-none translate-x-12 translate-y-12" />
              
              <div className="mb-8 relative z-10 flex justify-center">
                <AppLogo size={128} />
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-3 relative z-10">
                New Voice <span className="text-indigo-500 font-black">-</span> SRFactory
              </h1>
              <p className="opacity-40 font-bold uppercase tracking-[0.4em] text-[10px] sm:text-xs relative z-10">Member Exclusive Access</p>
            </div>
            
            <button 
              onClick={handleLogin}
              className={`group relative flex items-center gap-4 px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 shadow-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-white text-black' : 'bg-zinc-900 text-white'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <LogIn className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Sign in with Google Account</span>
            </button>
            <p className="mt-10 text-[10px] opacity-20 max-w-xs leading-relaxed uppercase tracking-widest font-bold">Please sign in with your registered email to verify your member license.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topbar (Desktop) */}
      <header className={`sticky top-0 z-50 hidden lg:flex h-20 items-center justify-between border-b px-8 backdrop-blur-xl transition-all ${
        theme === "dark" 
          ? "border-white/10 bg-black/80" 
          : "border-black/5 bg-white/80"
      }`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all ${
              theme === "dark" ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-black/5 hover:bg-slate-50"
            }`}
          >
            <Menu className={`w-5 h-5 ${theme === "dark" ? "text-zinc-400" : "text-slate-600"}`} />
          </button>

          <div className="flex items-center gap-4">
            <AppLogo size={52} />

            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight">
                New Voice - SRFactory
              </h1>
              <p className={`text-xs font-medium uppercase tracking-[0.25em] ${
                theme === "dark" ? "text-zinc-500" : "text-slate-400"
              }`}>
                Professional AI Engine • v{APP_VERSION}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
             id="guideButton"
             onClick={() => setIsTourOpen(true)}
             className={`hidden sm:block rounded-xl border px-5 py-3 text-sm font-medium shadow-sm transition ${
               theme === "dark" 
                ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" 
                : "bg-white border-black/5 text-slate-700 hover:bg-slate-50"
             }`}
          >
            {t('menu.guide')}
          </button>

          {!user ? (
            <button 
              onClick={handleLogin}
              className={`rounded-xl border px-5 py-3 text-sm font-medium shadow-sm transition ${
                theme === "dark" 
                 ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" 
                 : "bg-white border-black/5 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t('menu.signIn')}
            </button>
          ) : (
            <button
               onClick={() => setIsLogoutModalOpen(true)}
               className={`flex items-center gap-3 pl-3 pr-4 py-2 rounded-xl border transition-all ${
                 theme === "dark"
                   ? "bg-indigo-500/5 border-indigo-500/10"
                   : "bg-indigo-50 border-indigo-100"
               }`}
             >
                <img src={user.photoURL || ""} alt="" className="w-6 h-6 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                <span className={`text-xs font-bold ${theme === "dark" ? "text-indigo-400" : "text-indigo-600"}`}>
                  {user.displayName?.split(' ')[0]}
                </span>
             </button>
          )}

          {(license || isAdmin) && (
            <button 
               onClick={() => setActiveView("transcription")}
               className={`hidden md:flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold shadow-sm transition ${
                 activeView === "transcription"
                  ? (theme === "dark" ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600")
                  : (theme === "dark" ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-white border-black/5 text-slate-700 hover:bg-slate-50")
               }`}
            >
              <Languages className="w-4 h-4" />
              <span>Transcription</span>
            </button>
          )}

          {isAdmin && (
            <button 
               onClick={() => setActiveView("admin")}
               className={`hidden md:flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold shadow-sm transition ${
                 activeView === "admin"
                  ? (theme === "dark" ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-600")
                  : (theme === "dark" ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-white border-black/5 text-slate-700 hover:bg-slate-50")
               }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>
          )}

          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className={`p-3 rounded-xl border transition-all ${
              theme === "dark"
                ? "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                : "bg-white border-black/5 text-slate-600 hover:bg-slate-50"
            }`}
            aria-label="Toggle Theme"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button className={`flex h-12 items-center rounded-full border px-5 text-sm font-semibold transition-all ${
            theme === "dark"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-emerald-50 border-emerald-200 text-emerald-600"
          }`}>
            ● READY
          </button>
        </div>
      </header>

      {/* Top Header (ElevenLabs Style - Mobile/Tablet) */}
      <header className={`sticky top-0 z-50 flex lg:hidden h-16 items-center justify-between border-b px-4 backdrop-blur-xl transition-all ${
        theme === "dark" 
          ? "border-white/10 bg-black/80" 
          : "border-slate-200 bg-white/80"
      }`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
              theme === "dark" ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <Menu className={`w-5 h-5 ${theme === "dark" ? "text-zinc-400" : "text-slate-600"}`} />
          </button>

          <div className="flex items-center gap-2">
            <AppLogo size={36} />
            <h1 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-100' : 'text-slate-800'}`}>
              New Voice - SRFactory
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
             <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all ${
               theme === "dark" ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
             }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white uppercase ${
                  theme === "dark" ? "bg-zinc-700" : "bg-indigo-500"
                }`}>
                  {user.displayName?.[0] || "U"}
                </div>
                <span className="text-[10px] font-bold opacity-70">{user.displayName?.split(' ')[0]}</span>
             </div>
          )}
          
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className={`p-2 rounded-xl border transition-all ${
              theme === "dark"
                ? "bg-white/5 border-white/10 text-zinc-400"
                : "bg-white border-slate-200 text-slate-600 shadow-sm"
            }`}
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button className={`hidden sm:flex h-8 items-center rounded-full border px-3 text-[9px] font-black tracking-widest transition-all ${
            theme === "dark"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-emerald-50 border-emerald-200 text-emerald-600"
          }`}>
            READY
          </button>
        </div>
      </header>

      <main id="main-content" className="max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <>
            {activeView === "transcription" && (license || isAdmin) && (
              <motion.div
                key="transcription"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <TranscriptionView 
                  theme={theme} 
                  userApiKeys={userApiKeys} 
                  onSendToStudio={(text) => {
                    setTranscript(text);
                    setActiveView("studio");
                  }}
                />
              </motion.div>
            )}

            {activeView === "admin" && isAdmin && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
              >
                <AdminPanel theme={theme} />
              </motion.div>
            )}

            {activeView === "studio" && (license || isAdmin) && (
              <motion.div 
                key="studio"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col lg:flex-row gap-6"
              >
              {/* Left Sidebar: Voice Settings - Hidden on mobile, shown on large screens */}
              <aside className={`hidden lg:block lg:sticky lg:top-28 h-fit lg:max-h-[calc(100vh-8rem)] w-full lg:w-[320px] xl:w-[360px] overflow-y-auto rounded-3xl border p-5 transition-all custom-scrollbar ${
                theme === "dark" ? "bg-zinc-900/50 border-white/5" : "bg-white border-black/5 shadow-sm"
              }`}>
                <VoiceSettingsContent 
                  voiceGender={voiceGender} 
                  setVoiceGender={setVoiceGender}
                  selectedVoice={selectedVoice}
                  setSelectedVoice={setSelectedVoice}
                  voiceSearch={voiceSearch}
                  setVoiceSearch={setVoiceSearch}
                  audioProfile={audioProfile}
                  setAudioProfile={setAudioProfile}
                  scene={scene}
                  setScene={setScene}
                  pace={pace}
                  setPace={setPace}
                  accent={accent}
                  setAccent={setAccent}
                  directorNote={directorNote}
                  setDirectorNote={setDirectorNote}
                  temperature={temperature}
                  setTemperature={setTemperature}
                  theme={theme}
                  t={t}
                  presets={presets}
                  applyPreset={applyPreset}
                  deletePreset={deletePreset}
                  setIsPresetModalOpen={setIsPresetModalOpen}
                  user={user}
                />
              </aside>

              {/* Main Workspace */}
              <main className="flex-1 min-w-0 space-y-6 pb-32 lg:pb-0">

                {/* Script Section */}
                <section id="scriptContent" className={`rounded-[32px] border p-4 sm:p-8 transition-all ${
                  theme === "dark" ? "bg-zinc-900 border-white/5 shadow-2xl" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  {/* Voice Chip (Mobile Top) */}
                  <div className="pb-6 lg:hidden">
                    <button 
                      onClick={() => setIsMobileSettingsOpen(true)}
                      className={`flex items-center gap-3 px-5 py-3 rounded-full border transition-all active:scale-95 ${
                        theme === 'dark' ? 'bg-zinc-800 border-white/10' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                        {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name || "Select Voice"}
                      </span>
                    </button>
                  </div>

                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${theme === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
                              Script Content
                            </h2>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-mono ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>
                              {transcript.length} Characters
                            </span>

                            <button 
                              onClick={() => setTranscript("")}
                              className={`rounded-xl border px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                                theme === "dark" ? "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-400" : "bg-slate-50 border-black/5 hover:bg-slate-100"
                              }`}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="relative group">
                           {/* Decorative Interaction Tags (Mobile Reference Style) */}
                           <div className="absolute top-4 left-4 flex gap-2 pointer-events-none opacity-40 lg:opacity-60">
                              <span className="px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-[8px] font-bold text-violet-600 uppercase tracking-widest">[confident]</span>
                              <span className="hidden sm:inline-block px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-[8px] font-bold text-indigo-600 uppercase tracking-widest">[warm]</span>
                           </div>

                           <textarea
                             value={transcript}
                             onChange={(e) => setTranscript(e.target.value)}
                             placeholder={t('studio.inputPlaceholder')}
                             className={`h-[450px] sm:h-[400px] w-full resize-none rounded-3xl border p-6 pt-16 text-lg sm:text-xl leading-relaxed outline-none transition-all focus:ring-8 ${
                               theme === "dark"
                                 ? "bg-black/40 border-white/5 text-zinc-100 focus:border-indigo-500/50 focus:ring-indigo-500/5 placeholder:text-zinc-800"
                                 : "bg-[#fafbff] border-slate-100 text-slate-900 focus:border-indigo-300 focus:ring-indigo-100/30 placeholder:text-slate-200"
                             }`}
                           />
                        </div>

                        <div className="mt-6 hidden lg:flex justify-end">
                          <button
                            id="generateButton"
                            onClick={handleGenerate}
                            disabled={isGenerating || !transcript.trim()}
                            className={`group relative overflow-hidden rounded-2xl px-10 py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 ${
                              theme === "dark"
                                ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
                            }`}
                          >
                            <div className="relative z-10 flex items-center gap-3">
                              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                              <span className="text-[11px]">{isGenerating ? "Rendering..." : "Generate Voice"}</span>
                            </div>
                          </button>
                        </div>
                      </section>

                      {/* Bottom Grid: Audio Player & History */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Audio Player Section */}
                        <section className={`rounded-[32px] border p-8 transition-all relative overflow-hidden ${
                          theme === "dark" 
                            ? "bg-zinc-900 border-white/5 shadow-2xl shadow-indigo-500/5" 
                            : "bg-white border-black/5 shadow-xl shadow-slate-200/50"
                        }`}>
                          <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                theme === "dark" ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                              }`}>
                                <MicVocal className="w-4 h-4" />
                              </div>
                              <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${theme === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
                                Studio Monitor
                              </h2>
                            </div>
                            
                            <div className="flex gap-2">
                              {/* Buttons moved below audio player */}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-10">
                            <div className={`relative flex h-14 w-14 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl text-2xl sm:text-4xl shadow-inner ${
                              theme === "dark" ? "bg-zinc-800" : "bg-indigo-50/50"
                            }`}>
                              {selectedVoice ? (VOICE_OPTIONS.find(v => v.id === selectedVoice)?.type === "Wanita" ? "👩" : "👨") : "👤"}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg sm:text-2xl font-black tracking-tight truncate">{VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name || "Engine Standby"}</h3>
                              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 sm:mt-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${
                                  theme === "dark" ? "bg-white/5 text-zinc-500" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {audioProfile}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${
                                  theme === "dark" ? "bg-white/5 text-zinc-500" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {scene}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${
                                  theme === "dark" ? "bg-white/5 text-zinc-500" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {PACE_OPTIONS.find(p => p.id === pace)?.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            {audioUrl ? (
                              <div className="space-y-4 sm:space-y-6">
                                <WaveformPlayer audioUrl={audioUrl} theme={theme} />
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                                  <div className="flex gap-2 items-center">
                                    <span className={`text-[10px] font-mono font-bold ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>00:00</span>
                                    <span className={`text-[10px] font-mono font-bold ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>/ 24.0 kHz</span>
                                  </div>

                                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                    <a 
                                      href={audioUrl} 
                                      download="recording.wav" 
                                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all ${
                                        theme === "dark" 
                                          ? "bg-white/5 border-white/5 hover:bg-white/10 text-zinc-400 hover:text-indigo-400" 
                                          : "bg-slate-50 border-black/5 hover:bg-white text-slate-400 hover:text-indigo-600 shadow-sm"
                                      }`}
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Download</span>
                                    </a>
                                    <button
                                      onClick={async () => {
                                        if (currentPcmBase64) {
                                          const blob = pcmToWav(currentPcmBase64);
                                          await saveToGoogleDrive(blob, transcript);
                                        }
                                      }}
                                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all ${
                                        theme === "dark" 
                                          ? "bg-white/5 border-white/5 hover:bg-white/10 text-zinc-400 hover:text-emerald-400" 
                                          : "bg-slate-50 border-black/5 hover:bg-white text-slate-400 hover:text-emerald-600 shadow-sm"
                                      }`}
                                    >
                                      <Cloud className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Save Drive</span>
                                    </button>
                                    
                                    {driveToken && (
                                      <button
                                        onClick={() => {
                                          if (driveFolderId) {
                                            window.open(`https://drive.google.com/drive/folders/${driveFolderId}`, '_blank');
                                          } else {
                                            window.open(`https://drive.google.com/drive/my-drive`, '_blank');
                                          }
                                        }}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all ${
                                          theme === "dark" 
                                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" 
                                            : "bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 shadow-sm"
                                        }`}
                                      >
                                        <Folder className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Buka Folder</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className={`h-24 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed transition-all ${
                                theme === "dark" ? "bg-white/5 border-white/5" : "bg-slate-50 border-black/5"
                              }`}>
                                <div className="flex gap-2">
                                  {[1,2,3,4,5].map(i => (
                                    <div key={i} className={`w-1 bg-indigo-500/10 rounded-full h-${i % 2 === 0 ? '4' : '8'}`} />
                                  ))}
                                </div>
                                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] opacity-20">
                                  Waiting for signal...
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-10 flex items-center justify-between">
                            {/* System Ready Badge Removed */}
                          </div>
                        </section>

                        {/* Quick History Section - Hidden on mobile, shown on large screens */}
                        <section id="audioHistory" className={`hidden lg:block rounded-[32px] border p-8 transition-all ${
                          theme === "dark" 
                            ? "bg-zinc-900 border-white/5 shadow-2xl" 
                            : "bg-white border-black/5 shadow-xl shadow-slate-200/50"
                        }`}>
                          <HistoryContent 
                            history={history} 
                            theme={theme} 
                            setActiveView={setActiveView} 
                            setTranscript={setTranscript}
                            setAudioProfile={setAudioProfile}
                            setScene={setScene}
                            setDirectorNote={setDirectorNote}
                            setSelectedVoice={setSelectedVoice}
                            setCurrentPcmBase64={setCurrentPcmBase64}
                            setAudioUrl={setAudioUrl}
                            t={t}
                          />
                        </section>
                      </div>
              </main>
            </motion.div>
          )}

          {activeView === "history" && (
        <motion.div
           key="history"
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 1.02 }}
           className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                <History className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{t('history.title')}</h2>
                <p className="text-sm opacity-50">{t('history.subtitle')}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveView("studio")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                theme === "dark" ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t('history.backToStudio')}
            </button>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {history.length === 0 ? (
               <div className="col-span-full py-20 text-center opacity-40">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <p className="font-bold uppercase tracking-[0.2em]">{t('history.empty')}</p>
               </div>
            ) : (
              history.map((item) => {
                const audioBlob = item.audioBase64 ? pcmToWav(item.audioBase64) : null;
                const ephemeralUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;

                return (
                  <motion.div
                    key={item.id}
                    className={`p-6 rounded-3xl border transition-all relative group space-y-6 ${
                      theme === "dark" 
                        ? "bg-zinc-900 border-white/5 hover:border-indigo-500/30" 
                        : "bg-white border-slate-100 hover:border-indigo-500/20 shadow-sm hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                       <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border w-fit ${
                            theme === "dark" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-indigo-50 border-indigo-100 text-indigo-600"
                          }`}>
                            {item.voice}
                          </span>
                          <span className="text-[9px] font-mono opacity-30 mt-1">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                       </div>
                       <div className="flex gap-2">
                          {item.audioBase64 ? (
                            <button
                              onClick={() => {
                                const blob = pcmToWav(item.audioBase64!);
                                saveToGoogleDrive(blob, item.transcript);
                              }}
                              className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-500 transition-colors"
                              title={t('studio.saveToDrive')}
                            >
                               <Cloud className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="p-2 text-zinc-500 opacity-20" title="Audio data not synced (too large)">
                              <Cloud className="w-4 h-4 flex" />
                            </div>
                          )}
                          <button
                            onClick={() => deleteHistoryItem(item.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>

                    <p className={`text-sm leading-relaxed line-clamp-3 italic ${theme === "dark" ? "text-zinc-400" : "text-slate-600"}`}>
                      "{item.transcript}"
                    </p>

                    {ephemeralUrl ? (
                      <WaveformPlayer audioUrl={ephemeralUrl} theme={theme} />
                    ) : (
                      <div className={`p-4 rounded-2xl border border-dashed text-center flex items-center justify-center gap-2 ${
                        theme === "dark" ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                      }`}>
                         <Cloud className="w-3 h-3 opacity-30 text-red-500" />
                         <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('history.cloudLimit')}</p>
                      </div>
                    )}

                    <button 
                      onClick={() => {
                        setTranscript(item.transcript);
                        if (item.audioProfile) setAudioProfile(item.audioProfile);
                        if (item.scene) setScene(item.scene);
                        if (item.directorNote) setDirectorNote(item.directorNote);
                        if (item.voice) setSelectedVoice(item.voice);
                        setActiveView("studio");
                        toast.success(t('history.scriptRestored'));
                      }}
                      className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        theme === "dark" ? "bg-white/5 hover:bg-white/10 text-zinc-400" : "bg-slate-50 hover:bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t('history.useScript')}
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      {activeView === "imageVoice" && (
        <motion.div
           key="imageVoice"
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 1.02 }}
           className="max-w-4xl mx-auto space-y-10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{t('imageVoice.title')}</h2>
                <p className="text-sm opacity-50">{t('imageVoice.subtitle')}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveView("studio")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                theme === "dark" ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t('history.backToStudio')}
            </button>
          </div>

          <div className="grid lg:grid-cols-[1fr,350px] gap-8">
            <div className="space-y-6">
               <div 
                 className={`relative rounded-3xl border-2 border-dashed transition-all p-10 flex flex-col items-center justify-center min-h-[300px] text-center ${
                   theme === "dark" 
                     ? "bg-black/20 border-white/10 hover:border-indigo-500/30" 
                     : "bg-white border-slate-200 hover:border-indigo-500/20"
                 }`}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => {
                   e.preventDefault();
                   const file = e.dataTransfer.files[0];
                   if (file && file.type.startsWith("image/")) {
                     const reader = new FileReader();
                     reader.onload = (ev) => {
                       setUploadedImage(ev.target?.result as string);
                       setImageFile(file);
                     };
                     reader.readAsDataURL(file);
                   }
                 }}
               >
                 {uploadedImage ? (
                   <div className="relative group w-full">
                      <img src={uploadedImage} alt="Uploaded" className="max-h-[400px] w-auto mx-auto rounded-xl shadow-2xl" />
                      <button 
                        onClick={() => { setUploadedImage(null); setImageFile(null); }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                   </div>
                 ) : (
                   <>
                      <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6">
                        <Cloud className="w-8 h-8 text-indigo-400" />
                      </div>
                      <h3 className="font-bold mb-2">{t('imageVoice.uploadTitle')}</h3>
                      <p className="text-sm opacity-50 mb-6 max-w-xs">{t('imageVoice.uploadHint')}</p>
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="image-upload" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             const reader = new FileReader();
                             reader.onload = (ev) => {
                               setUploadedImage(ev.target?.result as string);
                               setImageFile(file);
                             };
                             reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="image-upload"
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95"
                      >
                        {t('imageVoice.chooseImage')}
                      </label>
                   </>
                 )}
               </div>

               {uploadedImage && (
                 <button
                   onClick={async () => {
                     if (!imageFile) return;
                     setIsAnalyzingImage(true);
                     const toastId = toast.loading(t('imageVoice.analyzing'));
                     try {
                        const reader = new FileReader();
                        const base64Promise = new Promise<string>((resolve) => {
                           reader.onload = () => resolve((reader.result as string).split(',')[1]);
                           reader.readAsDataURL(imageFile);
                        });
                        const base64 = await base64Promise;
                        
                        const response = await fetch("/api/analyze-image", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ base64, mimeType: imageFile.type, apiKey: userApiKeys }),
                        });

                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || t('imageVoice.analyzingFailed'));
                        }

                        const { text } = await response.json();
                        if (text) {
                           setTranscript(text);
                           setActiveView("studio");
                           toast.success(t('imageVoice.analyzingSuccess'), { id: toastId });
                           setTimeout(() => {
                              toast.info(t('imageVoice.scriptLoaded'));
                           }, 500);
                        }
                     } catch (err: any) {
                        toast.error(t('imageVoice.analyzingFailed'), { id: toastId, description: err.message });
                     } finally {
                        setIsAnalyzingImage(false);
                     }
                   }}
                   disabled={isAnalyzingImage}
                   className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20"
                 >
                   {isAnalyzingImage ? (
                     <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('imageVoice.analyzing')}</span>
                     </>
                   ) : (
                     <>
                        <Sparkles className="w-5 h-5" />
                        <span>{t('imageVoice.analyze')}</span>
                     </>
                   )}
                 </button>
               )}
            </div>

            <div className="space-y-6">
               <div className={`p-6 rounded-3xl border ${theme === "dark" ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-sm"}`}>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50 flex items-center gap-2">
                     <Info className="w-3 h-3" />
                     {t('imageVoice.howItWorks')}
                  </h4>
                  <ul className="space-y-4 text-xs">
                     <li className="flex gap-3">
                        <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black">1</div>
                        <p className="opacity-70 leading-relaxed">{t('imageVoice.step1')}</p>
                     </li>
                     <li className="flex gap-3">
                        <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black">2</div>
                        <p className="opacity-70 leading-relaxed">{t('imageVoice.step2')}</p>
                     </li>
                     <li className="flex gap-3">
                        <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black">3</div>
                        <p className="opacity-70 leading-relaxed">{t('imageVoice.step3')}</p>
                     </li>
                  </ul>
               </div>

               <div className={`p-6 rounded-3xl border ${theme === "dark" ? "bg-indigo-500/5 border-indigo-500/10" : "bg-indigo-50 border-indigo-100"}`}>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">💡 {t('imageVoice.tips')}</p>
                  <p className="text-[11px] leading-relaxed italic opacity-80">
                    "{t('imageVoice.tipContent')}"
                  </p>
               </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeView === "gdrive" && (
        <motion.div
           key="gdrive"
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           className="max-w-2xl mx-auto space-y-10"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Cloud className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t('menu.connectGDrive')}</h2>
              <p className="text-sm opacity-50">{t('drive.subtitle', { defaultValue: 'Cloud storage management for your audio' })}</p>
            </div>
          </div>

          <div className={`p-8 rounded-3xl border transition-all ${
            theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-slate-200 shadow-xl"
          }`}>
             <div className="flex flex-col items-center text-center space-y-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  driveToken ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-500/10 text-zinc-500"
                }`}>
                   <Cloud className="w-10 h-10" />
                </div>
                
                <div>
                   <h3 className="text-xl font-bold mb-2">
                     {driveToken ? t('drive.connected') : t('drive.disconnected')}
                   </h3>
                   <p className="text-sm opacity-60 leading-relaxed max-w-sm">
                     {driveToken 
                       ? t('drive.connectedHint')
                       : t('drive.disconnectedHint')}
                   </p>
                </div>

                {driveToken ? (
                  <div className="w-full space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between text-xs font-bold text-emerald-500">
                      <span>STATUS: {driveToken ? t('drive.connected').toUpperCase() : t('drive.disconnected').toUpperCase()}</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    
                    <button 
                      onClick={() => window.open(driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : `https://drive.google.com/drive/my-drive`, '_blank')}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                    >
                      Buka Folder "SRFactory Recordings"
                    </button>

                    <button 
                      onClick={() => setIsGDriveDisconnectModalOpen(true)}
                      className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-all"
                    >
                      {t('drive.disconnect')}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={async () => {
                      const toastId = toast.loading(t('toasts.processing', { defaultValue: 'Connecting...' }));
                      try {
                        const result = await signInWithPopup(auth, googleProvider);
                        const credential = GoogleAuthProvider.credentialFromResult(result);
                        const token = credential?.accessToken || null;
                        if (token) {
                          setCachedToken(token);
                          setDriveToken(token);
                          
                          // Ensure folder exists immediately
                          toast.loading("Mempersiapkan folder SRFactory...", { id: toastId });
                          await findOrCreateDriveFolder(token);

                          toast.success(t('toasts.successDriveSave'), { id: toastId });
                        } else {
                          toast.error(t('toasts.errorDriveSave'), { id: toastId });
                        }
                      } catch (err: any) {
                        if (err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/popup-closed-by-user') {
                          toast.info("Aktivasi izin dihentikan oleh pengguna.", { id: toastId });
                        } else {
                          toast.error(t('toasts.errorDriveSave'), { id: toastId, description: err.message });
                        }
                      }
                    }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                  >
                    {t('drive.connectNow')}
                  </button>
                )}
             </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
             <div className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4">
                   <Key className="w-4 h-4 text-indigo-400" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2">{t('drive.limitedPermission', { defaultValue: 'Limited Permissions' })}</h4>
                <p className="text-[10px] opacity-60 leading-relaxed">
                  {t('drive.limitedPermissionDesc', { defaultValue: 'We only request drive.file access. This means the app can only see and edit files it created.' })}
                </p>
             </div>
             <div className={`p-6 rounded-2xl border ${theme === "dark" ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4">
                   <Mic2 className="w-4 h-4 text-indigo-400" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-2">{t('drive.autoSave')}</h4>
                <p className="text-[10px] opacity-60 leading-relaxed">
                  {t('drive.autoSaveDesc')}
                </p>
             </div>
          </div>
        </motion.div>
      )}

      {activeView === "settings" && (
        <motion.div
           key="settings"
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -20 }}
           className="max-w-2xl mx-auto space-y-10"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Settings2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
              <p className="text-sm opacity-50">{t('settings.subtitle')}</p>
            </div>
          </div>

          <div className={`p-8 rounded-3xl border ${
            theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-slate-200 shadow-xl"
          }`}>
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-80">{t('settings.engineTitle')}</h3>
                <span className="text-[10px] font-black tracking-widest bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20">ROTATION ACTIVE</span>
             </div>
             <div className="space-y-8">
                {/* Language Toggle */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 px-1">{t('settings.language')}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => i18n.changeLanguage('id')}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        i18n.language === 'id'
                          ? (theme === "dark" ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600")
                          : (theme === "dark" ? "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10" : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100")
                      }`}
                    >
                      Indonesian
                    </button>
                    <button
                      onClick={() => i18n.changeLanguage('en')}
                      className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        i18n.language === 'en'
                          ? (theme === "dark" ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-600")
                          : (theme === "dark" ? "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10" : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100")
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Multiple API Keys */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('settings.apiKeyLabel')} (MAX 5)</label>
                      <button 
                         onClick={() => {
                            if (userApiKeys.length < 5) {
                               setUserApiKeys([...userApiKeys, ""]);
                            } else {
                               toast.error("Maximum 5 API keys reached");
                            }
                         }}
                         className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:underline"
                      >
                         + Tambah Key
                      </button>
                   </div>
                   
                   <div className="space-y-3">
                      {userApiKeys.map((key, index) => (
                        <div key={index} className="space-y-2">
                           <div className="relative group">
                              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                              <input 
                                type={visibleApiKeys[index] ? "text" : "password"}
                                value={key}
                                onChange={(e) => {
                                   const newKeys = [...userApiKeys];
                                   newKeys[index] = e.target.value;
                                   setUserApiKeys(newKeys);
                                }}
                                placeholder={`API Key #${index + 1}`}
                                className={`w-full pl-12 pr-32 py-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono text-xs transition-all ${
                                  theme === "dark" ? "bg-black/40 border-white/10" : "bg-slate-50 border-slate-200"
                                }`}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                 <button 
                                    onClick={() => setVisibleApiKeys(prev => ({ ...prev, [index]: !prev[index] }))}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-all text-zinc-500 hover:text-indigo-400"
                                    title={visibleApiKeys[index] ? "Hide Key" : "Show Key"}
                                 >
                                    {visibleApiKeys[index] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                 </button>
                                 {key && (
                                    <button 
                                       onClick={() => checkKeyStatus(key)}
                                       className="p-2 hover:bg-white/10 rounded-lg transition-all"
                                       title="Check Status"
                                    >
                                       {keyStatuses[key]?.status === 'testing' ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                       ) : (
                                          <Check className={`w-3.5 h-3.5 ${keyStatuses[key]?.status === 'active' ? 'text-emerald-500' : 'text-zinc-500'}`} />
                                       )}
                                    </button>
                                 )}
                                 {userApiKeys.length > 1 && (
                                    <button 
                                       onClick={() => {
                                          const newKeys = userApiKeys.filter((_, i) => i !== index);
                                          setUserApiKeys(newKeys);
                                       }}
                                       className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all"
                                    >
                                       <X className="w-3.5 h-3.5" />
                                    </button>
                                 )}
                              </div>
                           </div>
                           {keyStatuses[key]?.message && (
                              <p className={`text-[9px] px-2 font-bold uppercase tracking-wider ${keyStatuses[key]?.status === 'exhausted' ? 'text-red-500' : 'text-emerald-500'}`}>
                                 {keyStatuses[key]?.status === 'exhausted' ? 'QUOTA EXHAUSTED / INVALID' : 'ACTIVE & READY'}
                                 <span className="opacity-40 ml-2 font-medium">({keyStatuses[key]?.message})</span>
                              </p>
                           )}
                        </div>
                      ))}
                   </div>
                   <p className="text-[10px] opacity-40 px-1 leading-relaxed">
                     Sistem akan mencoba menggunakan key pertama. Jika gagal atau limit habis, otomatis beralih ke key berikutnya.
                   </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">{t('settings.modelEngine')}</p>
                    <p className="text-xs font-bold">Gemini 3.1 Flash TTS</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">{t('settings.connectionStatus')}</p>
                    <p className="text-xs font-bold">Rotation Active • Cluster Ready</p>
                  </div>
                </div>

                <button 
                  onClick={() => saveApiKeys(userApiKeys)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                >
                  {t('settings.saveSettings')}
                </button>
             </div>
          </div>

          <div className={`p-8 rounded-3xl border ${
            theme === "dark" ? "bg-zinc-900 border-white/5" : "bg-white border-slate-200"
          }`}>
             <h3 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-80">{t('settings.accountTitle')}</h3>
             {user ? (
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img src={user.photoURL || ""} alt="" className="w-12 h-12 rounded-2xl border border-white/10" referrerPolicy="no-referrer" />
                    <div>
                      <p className="font-bold">{user.displayName}</p>
                      <p className="text-xs opacity-50">{user.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                  >
                    {t('menu.signOut')}
                  </button>
               </div>
             ) : (
               <div className="text-center py-6">
                 <p className="text-sm opacity-50 mb-4">{t('settings.loginHint')}</p>
                 <button 
                   onClick={handleLogin}
                   className="px-6 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20"
                 >
                   {t('menu.signIn')}
                 </button>
               </div>
             )}
          </div>
        </motion.div>
      )}
            </>
    </AnimatePresence>

    {/* Mobile Floating Actions & Fixed Bottom Bar (ElevenLabs Style) */}
    {activeView === "studio" && (
      <div className="lg:hidden">
        <div className={`fixed bottom-0 left-0 right-0 z-40 px-6 pb-8 pt-4 border-t backdrop-blur-xl ${
          theme === 'dark' ? 'bg-zinc-900/90 border-white/10' : 'bg-white/90 border-slate-100 shadow-[0_-15px_40px_rgba(0,0,0,0.06)]'
        }`}>
          {/* Row 1: Quick Actions */}
          <div className="flex items-center justify-between gap-3 mb-4">
                <button
                  onClick={() => setIsMobileSettingsOpen(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all active:scale-95 ${
                    theme === "dark" ? "bg-zinc-800 border-white/5 text-zinc-400" : "bg-white border-slate-200 text-slate-500 shadow-sm"
                  }`}
                >
                  <Settings2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Settings</span>
                </button>
                <button
                  onClick={() => setIsMobileHistoryOpen(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all active:scale-95 ${
                    theme === "dark" ? "bg-zinc-800 border-white/5 text-zinc-400" : "bg-white border-slate-200 text-slate-500 shadow-sm"
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">History</span>
                </button>
          </div>

          {/* Row 2: Main Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !transcript}
            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl active:scale-[0.98] relative overflow-hidden ${
              isGenerating || !transcript
                ? (theme === 'dark' ? "bg-zinc-800 text-zinc-600" : "bg-slate-200 text-slate-400")
                : "bg-indigo-600 text-white shadow-indigo-500/25"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : null}
            <span className="text-sm font-black uppercase tracking-[0.2em]">
              {isGenerating ? "Generating..." : "Generate Voice"}
            </span>
          </button>
        </div>
      </div>
    )}
  </main>

  {/* Preset Save Modal */}
  <AnimatePresence>
    {isPresetModalOpen && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsPresetModalOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`relative w-full max-w-md rounded-[32px] p-8 shadow-2xl ${
            theme === "dark" ? "bg-zinc-900 border border-white/10" : "bg-white"
          }`}
        >
          <h3 className="text-xl font-bold mb-2">Simpan Preset Suara</h3>
          <p className="text-sm opacity-50 mb-6">Beri nama preset ini agar mudah ditemukan nanti.</p>
          
          <div className="space-y-4">
            <input 
              autoFocus
              type="text"
              placeholder="Misal: Narator Dokumenter"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && savePreset()}
              className={`w-full px-5 py-4 rounded-2xl border outline-none transition-all focus:ring-4 ${
                theme === "dark" 
                  ? "bg-black/40 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/10" 
                  : "bg-slate-50 border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
              }`}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => setIsPresetModalOpen(false)}
                className={`flex-1 py-4 rounded-2xl font-bold transition-all ${
                  theme === "dark" ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Batal
              </button>
              <button 
                onClick={savePreset}
                disabled={!newPresetName.trim() || isSavingPreset}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20"
              >
                {isSavingPreset ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Slide-up Drawers (Mobile) */}
  <AnimatePresence mode="wait">
    {isMobileSettingsOpen && (
      <MobileDrawer
        title="Voice Settings"
        onClose={() => setIsMobileSettingsOpen(false)}
        theme={theme}
      >
        <VoiceSettingsContent 
          voiceGender={voiceGender} 
          setVoiceGender={setVoiceGender}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          voiceSearch={voiceSearch}
          setVoiceSearch={setVoiceSearch}
          audioProfile={audioProfile}
          setAudioProfile={setAudioProfile}
          scene={scene}
          setScene={setScene}
          pace={pace}
          setPace={setPace}
          accent={accent}
          setAccent={setAccent}
          directorNote={directorNote}
          setDirectorNote={setDirectorNote}
          temperature={temperature}
          setTemperature={setTemperature}
          theme={theme}
          t={t}
          presets={presets}
          applyPreset={applyPreset}
          deletePreset={deletePreset}
          setIsPresetModalOpen={setIsPresetModalOpen}
          user={user}
        />
      </MobileDrawer>
    )}
    {isMobileHistoryOpen && (
      <MobileDrawer
        title="Quick Sessions"
        onClose={() => setIsMobileHistoryOpen(false)}
        theme={theme}
      >
        <HistoryContent 
          history={history} 
          theme={theme} 
          setActiveView={setActiveView} 
          setTranscript={(val: string) => { setTranscript(val); setIsMobileHistoryOpen(false); }}
          setAudioProfile={setAudioProfile}
          setScene={setScene}
          setDirectorNote={setDirectorNote}
          setSelectedVoice={setSelectedVoice}
          setCurrentPcmBase64={setCurrentPcmBase64}
          setAudioUrl={setAudioUrl}
          t={t}
        />
      </MobileDrawer>
    )}
  </AnimatePresence>

      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className={`absolute top-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-colors ${
          theme === "dark" ? "bg-indigo-600/5" : "bg-indigo-500/10"
        }`} />
        <div className={`absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] blur-[100px] rounded-full transition-colors ${
          theme === "dark" ? "bg-violet-600/5" : "bg-violet-500/10"
        }`} />
      </div>

      <footer className={`max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10 border-t transition-colors ${
        theme === "dark" ? "border-white/5" : "border-slate-200"
      }`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-1">
              <p className={`text-[9px] uppercase font-black tracking-[0.25em] ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>Encoding</p>
              <p className={`text-[10px] font-mono font-bold ${theme === "dark" ? "text-zinc-400" : "text-slate-600"}`}>L16 16-bit PCM</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className={`text-[9px] uppercase font-black tracking-[0.25em] ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>Sample Rate</p>
              <p className={`text-[10px] font-mono font-bold ${theme === "dark" ? "text-zinc-400" : "text-slate-600"}`}>24.0 kHz</p>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <p className={`text-[9px] uppercase font-bold tracking-widest ${theme === "dark" ? "text-zinc-700" : "text-slate-400"}`}>
              Powered by • New Voice - SRFactory V{APP_VERSION}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SidebarSection({ title, description, children, theme, id }: { title: string; description: string; children: React.ReactNode; theme: "light" | "dark"; id?: string }) {
  return (
    <section id={id} className={`mb-5 rounded-2xl border p-4 transition-colors ${
      theme === "dark" ? "bg-white/5 border-white/5" : "bg-white border-black/5"
    }`}>
      <div className="mb-4">
        <h3 className={`text-xs font-bold uppercase tracking-[0.2em] ${
          theme === "dark" ? "text-zinc-400" : "text-slate-500"
        }`}>
          {title}
        </h3>

        <p className={`mt-2 text-sm ${
          theme === "dark" ? "text-zinc-500" : "text-slate-400"
        }`}>
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

// --- Mobile Optimized Sub-components ---

function VoiceSettingsContent({ 
  voiceGender, setVoiceGender, selectedVoice, setSelectedVoice, voiceSearch, setVoiceSearch,
  audioProfile, setAudioProfile, scene, setScene, pace, setPace, accent, setAccent,
  directorNote, setDirectorNote, temperature, setTemperature, theme, t,
  presets, applyPreset, deletePreset, setIsPresetModalOpen, user
}: any) {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="hidden lg:flex mb-6 items-center justify-between">
        <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${theme === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
          Voice Settings
        </h2>
        <Settings2 className="w-4 h-4 opacity-30" />
      </div>

      {/* 0. Saved Presets */}
      {user && (
        <div className={`mb-5 rounded-3xl border p-5 shadow-sm transition-all ${
          theme === "dark" ? "border-indigo-500/20 bg-indigo-500/5" : "border-indigo-200 bg-indigo-50/50"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "dark" ? "text-indigo-400" : "text-indigo-500"}`}>
              0. Saved Presets
            </p>
            <button 
              onClick={() => setIsPresetModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                theme === "dark" 
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20" 
                  : "bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-100"
              }`}
            >
              <Bookmark className="w-2.5 h-2.5" />
              Save New
            </button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
            {presets.length === 0 ? (
              <p className="text-[10px] opacity-40 italic py-2">Belum ada preset tersimpan.</p>
            ) : (
              presets.map((preset: VoicePreset) => (
                <div 
                  key={preset.id}
                  className={`group relative flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-black/20 border-white/5 hover:border-indigo-500/40"
                      : "bg-white border-slate-100 hover:border-indigo-200 shadow-sm"
                  }`}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="text-[10px] font-bold truncate max-w-[100px]">{preset.name}</span>
                  <button 
                    onClick={(e) => deletePreset(preset.id, e)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 1. Voice Selection */}
      <div className={`mb-5 rounded-3xl border p-5 shadow-sm transition-all ${
        theme === "dark" ? "border-violet-500/20 bg-violet-500/5" : "border-violet-200 bg-violet-50/50"
      }`}>
        <div className="mb-4">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "dark" ? "text-violet-400" : "text-violet-500"}`}>
            1. Gender Focus
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setVoiceGender("Wanita")}
              className={`flex-1 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                voiceGender === "Wanita"
                  ? (theme === "dark" ? "bg-violet-500/20 border-violet-500/50 text-violet-300" : "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/20")
                  : (theme === "dark" ? "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50")
              }`}
            >
              Wanita
            </button>
            <button
              onClick={() => setVoiceGender("Pria")}
              className={`flex-1 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                voiceGender === "Pria"
                  ? (theme === "dark" ? "bg-violet-500/20 border-violet-500/50 text-violet-300" : "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/20")
                  : (theme === "dark" ? "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50")
              }`}
            >
              Pria
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm transition-all ${
          theme === "dark" ? "bg-zinc-900 border-violet-500/30" : "bg-white border-violet-300"
        }`}>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text"
              placeholder="Search voice model..."
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                theme === "dark" ? "bg-black/20 border-white/5 text-zinc-300 focus:border-violet-500/40" : "bg-slate-50 border-slate-100 text-slate-600 focus:border-violet-200"
              }`}
            />
          </div>

          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className={`w-full rounded-xl border px-3 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer ${
              theme === "dark"
                ? "bg-zinc-800 border-white/5 text-zinc-100"
                : "bg-slate-100 border-black/5 text-slate-900"
            }`}
          >
            {VOICE_OPTIONS
              .filter(v => v.type === voiceGender && (v.name.toLowerCase().includes(voiceSearch.toLowerCase()) || v.id.toLowerCase().includes(voiceSearch.toLowerCase())))
              .map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
          </select>

          <div className="mt-4 flex flex-wrap gap-1.5 min-h-[26px]">
            {(VOICE_OPTIONS.find(v => v.id === selectedVoice)?.tags || []).map((tag) => {
              const getTagColor = (t: string) => {
                const tag = t.toLowerCase();
                if (tag.includes('promosi') || tag.includes('iklan')) return theme === 'dark' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-600';
                if (tag.includes('energetik') || tag.includes('upbeat')) return theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600';
                if (tag.includes('informasi') || tag.includes('professional')) return theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600';
                if (tag.includes('narasi') || tag.includes('calm')) return theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600';
                return theme === 'dark' ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-500';
              };
              return (
                <span
                  key={tag}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${getTagColor(tag)}`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <SidebarSection
        id="audioProfile"
        title="2. Audio Profile"
        description={t('studio.audioProfilePlaceholder')}
        theme={theme}
      >
        <select 
          value={audioProfile}
          onChange={(e) => setAudioProfile(e.target.value)}
          className={`w-full rounded-2xl border px-5 py-4 text-sm font-medium focus:outline-none transition-all ${
            theme === "dark" ? "bg-white/5 border-white/5 text-zinc-300" : "bg-slate-50 border-black/5"
          }`}
        >
          {AUDIO_PROFILE_PRESETS.map(preset => (
            <option key={preset} value={preset}>{preset}</option>
          ))}
        </select>
      </SidebarSection>

      <SidebarSection
        id="sceneContext"
        title="3. Scene Context"
        description={t('studio.scenePlaceholder')}
        theme={theme}
      >
        <select 
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          className={`w-full rounded-2xl border px-5 py-4 text-sm font-medium focus:outline-none transition-all ${
            theme === "dark" ? "bg-white/5 border-white/5 text-zinc-300" : "bg-slate-50 border-black/5"
          }`}
        >
          {SCENE_CONTEXT_PRESETS.map(preset => (
            <option key={preset} value={preset}>{preset}</option>
          ))}
        </select>
      </SidebarSection>

      <SidebarSection
        title="4. Pace & Accent"
        description={t('studio.pace')}
        theme={theme}
      >
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PACE_OPTIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPace(item.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                pace === item.id
                  ? (theme === "dark" ? "border-violet-500/50 bg-violet-500/10 text-violet-200" : "border-violet-300 bg-violet-50")
                  : (theme === "dark" ? "border-white/5 bg-white/5 hover:bg-white/10" : "border-black/5 bg-slate-50 hover:bg-white shadow-sm")
              }`}
            >
              <p className="font-bold text-[10px] uppercase tracking-wider">{item.label}</p>
              <p className={`mt-1 text-[9px] leading-tight ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>
                {item.description.slice(0, 30)}...
              </p>
            </button>
          ))}
        </div>

        <select 
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className={`w-full rounded-2xl border px-5 py-4 text-sm font-medium focus:outline-none transition-all ${
            theme === "dark" ? "bg-white/5 border-white/5 text-zinc-300" : "bg-slate-50 border-black/5"
          }`}
        >
          {ACCENT_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </SidebarSection>

      <SidebarSection
        id="directorNote"
        title="5. Director's Note"
        description="Atur gaya bicara dan emosi AI"
        theme={theme}
      >
        <div className="space-y-4">
          <select 
            value={DIRECTOR_NOTE_PRESETS.find(p => p.value === directorNote)?.value || ""}
            onChange={(e) => setDirectorNote(e.target.value)}
            className={`w-full rounded-2xl border px-5 py-4 text-sm focus:outline-none transition-all ${
              theme === "dark" ? "bg-white/5 border-white/5 text-zinc-300" : "bg-slate-50 border-black/5"
            }`}
          >
            <option value="" disabled>Pilih Preset Emosi...</option>
            {DIRECTOR_NOTE_PRESETS.map(preset => (
              <option key={preset.label} value={preset.value}>{preset.label}</option>
            ))}
          </select>

          <textarea
            value={directorNote}
            onChange={(e) => setDirectorNote(e.target.value)}
            className={`w-full min-h-[120px] rounded-2xl border p-5 text-sm font-medium resize-none outline-none transition-all ${
              theme === "dark" 
                ? "bg-black/20 border-white/5 text-zinc-400 focus:border-violet-500/30" 
                : "bg-slate-50 border-black/5 text-slate-600 focus:border-violet-200"
            }`}
            placeholder="Atau ketik instruksi kustom di sini..."
          />
        </div>
      </SidebarSection>

      <SidebarSection
        title="6. Advanced Control"
        description="Model Accuracy"
        theme={theme}
      >
        <div className="py-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Temperature</p>
            <span className={`rounded-xl px-4 py-1.5 text-[10px] font-black border ${
              theme === "dark" ? "bg-violet-500/10 border-violet-500/20 text-violet-400" : "bg-violet-50 border-violet-100 text-violet-600 shadow-sm"
            }`}>
              {temperature.toFixed(2)}
            </span>
          </div>

          <input 
            type="range" 
            min="0"
            max="2"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:bg-zinc-800" 
          />
        </div>
      </SidebarSection>

      <button 
        onClick={() => {
          setAudioProfile("Bright & Clear");
          setScene("Quiet Room");
          setPace(PACE_OPTIONS[0].id);
          setTemperature(1);
          setAccent("Neutral");
          setDirectorNote("Sangat bersemangat, penuh energi, bicara cepat dan ceria.");
        }}
        className={`w-full rounded-[20px] border py-5 text-[10px] font-black uppercase tracking-widest transition-all ${
          theme === "dark" ? "bg-white/5 border-white/5 hover:bg-white/10 text-zinc-400" : "bg-slate-50 border-black/5 hover:bg-slate-100"
        }`}
      >
        Reset to Defaults
      </button>
    </div>
  );
}

function TranscriptionView({ 
  theme, 
  userApiKeys,
  onSendToStudio
}: { 
  theme: "light" | "dark"; 
  userApiKeys: string[];
  onSendToStudio: (text: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'file' | 'live'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recognitionRef = useRef<any>(null);

  // Live Dictation
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'id-ID';

      recognitionRef.current.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          }
        }
        if (final) {
          setLiveText(prev => prev + final);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Browser Anda tidak mendukung fitur Speech Recognition. Coba gunakan Google Chrome.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      toast.info("Perekaman dihentikan");
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.success("Mulai mendengarkan...");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 9 * 1024 * 1024) {
        setError("Ukuran file terlalu besar. Batas maksimal adalah 9MB.");
        return;
      }
      setFile(selectedFile);
      setError('');
      setTranscription('');
    }
  };

  const transcribeFile = async () => {
    if (!file) return;

    setIsLoading(true);
    setError('');
    const toastId = toast.loading("Sedang mentranskrip dengan Gemini...");

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: base64Data,
          mimeType: file.type,
          apiKey: userApiKeys
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal melakukan transkripsi.");
      }

      setTranscription(data.text);
      toast.success("Transkripsi selesai!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error("Gagal transkripsi", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success("Teks berhasil disalin!");
    } catch (err) {
      toast.error("Gagal menyalin teks.");
    }
    document.body.removeChild(textArea);
  };

  const downloadText = (text: string, filename: string) => {
    const element = document.createElement("a");
    const blob = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(blob);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
        }`}>
          <Languages className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black">AI Transcription</h2>
          <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Audio & Video to Text</p>
        </div>
      </div>

      <div className={`rounded-[32px] border overflow-hidden ${
        theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-slate-200 shadow-xl'
      }`}>
        <div className="flex border-b border-white/5">
          <button 
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-all ${
              activeTab === 'file' 
                ? (theme === 'dark' ? 'text-indigo-400 bg-white/5' : 'text-indigo-600 bg-slate-50') 
                : 'opacity-40 hover:opacity-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button 
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-all ${
              activeTab === 'live' 
                ? (theme === 'dark' ? 'text-indigo-400 bg-white/5' : 'text-indigo-600 bg-slate-50') 
                : 'opacity-40 hover:opacity-100'
            }`}
          >
            <Mic className="w-4 h-4" />
            Live Dikte
          </button>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-6">
              <div className={`border-2 border-dashed rounded-[32px] p-10 text-center transition-all relative ${
                theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <input 
                  type="file" 
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {file ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-indigo-500/20 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
                      {file.type.startsWith('video') ? <FileVideo className="w-8 h-8" /> : <FileAudio className="w-8 h-8" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{file.name}</h3>
                      <p className="opacity-40 text-xs text-indigo-500 font-bold uppercase">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                        setTranscription('');
                      }}
                      className="text-red-500 text-xs font-bold hover:underline"
                    >
                      Hapus & Ganti File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="w-16 h-16 bg-white/5 text-zinc-500 rounded-2xl flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold">Input Audio atau Video</h3>
                    <p className="opacity-40 text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto">
                      MP3, MP4, WAV, AAC, dll. Maksimal 9MB.
                    </p>
                  </div>
                )}
              </div>

              {file && !transcription && (
                <button
                  onClick={transcribeFile}
                  disabled={isLoading}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin" />
                       Proses Transkripsi...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                       <Sparkles className="w-4 h-4" />
                       Mulai Transkripsi AI
                    </span>
                  )}
                </button>
              )}

              {transcription && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Hasil Transkripsi</h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onSendToStudio(transcription)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Send to Studio
                      </button>
                      <button 
                        onClick={() => copyToClipboard(transcription)}
                        className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                        title="Salin Teks"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => downloadText(transcription, `transkrip-${file?.name}.txt`)}
                        className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                        title="Unduh Teks"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <textarea 
                    value={transcription}
                    readOnly
                    className={`w-full h-80 p-8 rounded-[32px] border outline-none font-medium leading-relaxed resize-none custom-scrollbar ${
                      theme === 'dark' ? 'bg-black/40 border-white/5 text-zinc-300' : 'bg-slate-50 border-slate-100'
                    }`}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-8 py-4">
              <div className="text-center space-y-6">
                <div className="relative inline-block">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isRecording 
                      ? 'bg-red-500/20 shadow-[0_0_0_12px_rgba(239,68,68,0.05)]' 
                      : (theme === 'dark' ? 'bg-white/5' : 'bg-slate-50')
                  }`}>
                    <Mic className={`w-12 h-12 ${isRecording ? 'text-red-500 animate-pulse' : 'opacity-10'}`} />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold">
                    {isRecording ? 'Mendengarkan...' : 'Siap Merekam'}
                  </h3>
                  <p className="text-xs opacity-50 mt-2 max-w-sm mx-auto leading-relaxed">
                    Pastikan mikrofon Anda aktif. Bicara dalam Bahasa Indonesia untuk hasil terbaik.
                  </p>
                </div>

                <button
                  onClick={toggleRecording}
                  className={`px-12 py-5 rounded-full font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  }`}
                >
                  {isRecording ? (
                    <span className="flex items-center gap-3"><Pause className="w-4 h-4 fill-current" /> Stop recording</span>
                  ) : (
                    <span className="flex items-center gap-3"><Play className="w-4 h-4 fill-current ml-0.5" /> Start talking</span>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Live Transcript</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onSendToStudio(liveText)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                        theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Send to Studio
                    </button>
                    <button 
                      onClick={() => setLiveText('')}
                      className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                      title="Bersihkan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(liveText)}
                      className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                      title="Salin"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => downloadText(liveText, 'live-transkrip.txt')}
                      className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                      title="Unduh"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <textarea 
                  value={liveText}
                  onChange={(e) => setLiveText(e.target.value)}
                  placeholder="Bicara sekarang..."
                  className={`w-full h-80 p-8 rounded-[32px] border outline-none font-bold text-lg leading-relaxed focus:ring-4 transition-all resize-none custom-scrollbar ${
                    theme === 'dark' 
                      ? 'bg-black/30 border-white/5 text-white focus:border-indigo-500/50 focus:ring-indigo-500/10' 
                      : 'bg-slate-50 border-slate-100 focus:border-indigo-200 focus:ring-indigo-50'
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ theme }: { theme: "light" | "dark" }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Watch Requests
    const qReq = query(collection(db, "license_requests"), orderBy("requestedAt", "desc"));
    const unsubReq = onSnapshot(qReq, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Watch Licenses
    const qLic = query(collection(db, "licenses"), orderBy("activatedAt", "desc"));
    const unsubLic = onSnapshot(qLic, (snapshot) => {
      setLicenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubReq();
      unsubLic();
    };
  }, []);

  const handleAction = async (email: string, action: "approve" | "deny", data: any) => {
    try {
      if (action === "approve") {
        const generatedKey = generateLicenseKey();
        await setDoc(doc(db, "licenses", email), {
          email: email,
          licenseKey: generatedKey,
          plan: "Pro",
          active: true,
          activatedAt: Timestamp.now(),
          displayName: data.displayName || "",
          photoURL: data.photoURL || ""
        });
        await deleteDoc(doc(db, "license_requests", email));
        toast.success(`User ${email} activated with Key: ${generatedKey}`);
      } else {
        await deleteDoc(doc(db, "license_requests", email));
        toast.info(`Request from ${email} denied.`);
      }
    } catch (err) {
      console.error("Error managing license:", err);
      toast.error("Operation failed.");
    }
  };

  const manualActivate = async () => {
    if (!targetEmail.trim()) return;
    setIsGenerating(true);
    const toastId = toast.loading("Activating...");
    try {
      const email = targetEmail.trim().toLowerCase();
      const finalKey = manualKey.trim() || generateLicenseKey();
      await setDoc(doc(db, "licenses", email), {
        email,
        licenseKey: finalKey,
        active: true,
        plan: "Pro",
        activatedAt: Timestamp.now()
      });
      // Bersihkan juga request yang tertunda jika ada
      await deleteDoc(doc(db, "license_requests", email)).catch(() => {});
      
      toast.success(`License activated with Key: ${finalKey}`, { id: toastId });
      setTargetEmail("");
      setManualKey("");
    } catch (err) {
      toast.error("Activation failed", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteLicense = async (email: string) => {
    if (!confirm(`Delete license for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, "licenses", email));
      toast.success("License deleted");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
        }`}>
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            License Center
          </h2>
          <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Manage Member Access</p>
        </div>
      </div>

      {/* Pending Requests */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Pending Requests ({requests.length})</h3>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-xs">Checking requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className={`p-10 rounded-[32px] border border-dashed text-center opacity-30 ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="text-sm font-bold">No pending requests</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-[32px] border flex flex-wrap items-center justify-between gap-6 transition-all ${
                  theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  {req.photoURL ? (
                    <img src={req.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-indigo-500/20" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold">
                      {req.email?.[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-black text-lg">{req.displayName || "Anonymous User"}</div>
                    <div className="text-sm opacity-50 font-medium">{req.email}</div>
                    <div className="text-[10px] mt-1 opacity-40 uppercase tracking-widest flex items-center gap-1">
                      <Cloud className="w-3 h-3" />
                      Requested {req.requestedAt?.toDate().toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(req.email, "approve", req)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(req.email, "deny", req)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 ${
                      theme === 'dark' ? 'bg-white/5 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Deny
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Manual Activation */}
      <section className={`p-8 rounded-[32px] border transition-all ${
        theme === "dark" ? "bg-zinc-900 border-white/5 shadow-2xl" : "bg-white border-slate-200 shadow-xl"
      }`}>
        <h3 className="text-lg font-bold mb-6">Manual Activation</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <input 
            type="email"
            placeholder="User email address"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            className={`flex-1 px-6 py-4 rounded-2xl border outline-none transition-all focus:ring-4 ${
              theme === "dark" 
                ? "bg-black/40 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/10 text-white" 
                : "bg-slate-50 border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
            }`}
          />
          <input 
            type="text"
            placeholder="License Key (opsional, kosongkan untuk buat otomatis)"
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            className={`flex-1 px-6 py-4 rounded-2xl border outline-none transition-all focus:ring-4 font-mono ${
              theme === "dark" 
                ? "bg-black/40 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/10 text-white" 
                : "bg-slate-50 border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
            }`}
          />
          <button 
            disabled={isGenerating || !targetEmail.trim()}
            onClick={manualActivate}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Activate"}
          </button>
        </div>
      </section>

      {/* Licensed Members */}
      <section className="space-y-6 pb-20">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Licensed Members ({licenses.length})</h3>
          </div>
        </div>
        <div className="grid gap-3">
          {licenses.map(lic => (
            <div 
              key={lic.id}
              className={`flex items-center justify-between p-6 rounded-[28px] border transition-all ${
                theme === "dark" ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]" : "bg-white border-slate-100 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  theme === 'dark' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{lic.email}</p>
                  <p className="text-[10px] mt-1 opacity-40 uppercase tracking-[0.2em] font-bold">
                    {lic.activatedAt?.toDate?.() ? lic.activatedAt.toDate().toLocaleDateString() : 'Legacy'} • {lic.plan || 'Free'}
                  </p>
                  {lic.licenseKey && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <code className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        theme === 'dark' 
                          ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10' 
                          : 'text-indigo-600 bg-indigo-50 border-indigo-100'
                      }`}>
                        {lic.licenseKey}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(lic.licenseKey);
                          toast.success("Kunci lisensi disalin!");
                        }}
                        className="text-[10px] text-indigo-500 hover:text-indigo-400 font-bold hover:underline"
                      >
                        Salin Key
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => deleteLicense(lic.id)}
                className={`p-4 rounded-2xl transition-all ${
                  theme === 'dark' ? 'hover:bg-red-500/10 text-zinc-600 hover:text-red-500' : 'hover:bg-red-50 text-slate-300 hover:text-red-600'
                }`}
                title="Revoke License"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {licenses.length === 0 && (
            <div className="py-20 text-center opacity-20">
              <Users className="w-16 h-16 mx-auto mb-4" />
              <p>No licenses active</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function HistoryContent({ 
  history, theme, setActiveView, setTranscript, setAudioProfile, setScene, 
  setDirectorNote, setSelectedVoice, setCurrentPcmBase64, setAudioUrl, t 
}: any) {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
            theme === "dark" ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600"
          }`}>
            <History className="w-5 h-5" />
          </div>
          <h2 className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
            Recent Sessions
          </h2>
        </div>
        <button 
          onClick={() => setActiveView("history")}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-all"
        >
          View Library
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="space-y-4 max-h-[500px] lg:max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-20 lg:pb-0">
        {history.slice(0, 8).map((item: any, index: number) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            key={item.id}
            onClick={() => {
              setTranscript(item.transcript);
              if (item.audioProfile) setAudioProfile(item.audioProfile);
              if (item.scene) setScene(item.scene);
              if (item.directorNote) setDirectorNote(item.directorNote);
              if (item.voice) setSelectedVoice(item.voice);
              if (item.audioBase64) {
                setCurrentPcmBase64(item.audioBase64);
                const blob = pcmToWav(item.audioBase64);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
              }
              toast.success(t('history.scriptRestored'));
            }}
            className={`group flex items-center gap-4 rounded-[20px] border p-3 pl-4 transition-all cursor-pointer ${
              index === 0
                ? (theme === "dark" ? "border-indigo-500/30 bg-indigo-500/5 shadow-2xl shadow-indigo-500/5" : "border-indigo-200 bg-indigo-50 shadow-md")
                : (theme === "dark" ? "border-white/5 bg-zinc-900 shadow-sm hover:bg-zinc-800" : "border-black/5 bg-white shadow-sm hover:border-indigo-500/10 hover:shadow-md")
            }`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
              theme === "dark" ? "bg-white/5 text-indigo-400 border border-white/5" : "bg-white text-indigo-600 shadow-sm border border-slate-100"
            }`}>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[13px] leading-tight truncate">
                {item.transcript}
              </p>
              <div className="flex items-center gap-3 mt-1 underline-offset-4">
                <span className={`text-[10px] font-bold opacity-40 uppercase tracking-tighter ${
                  theme === "dark" ? "text-zinc-500" : "text-slate-500"
                }`}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                  theme === "dark" ? "text-indigo-400" : "text-indigo-600"
                }`}>
                  {item.voice}
                </span>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 shrink-0 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </motion.div>
        ))}

        {history.length === 0 && (
          <div className="py-24 text-center">
            <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mx-auto mb-6 border-2 border-dashed ${
              theme === "dark" ? "border-white/5 bg-white/5" : "border-black/5 bg-slate-50"
            }`}>
              <History className="w-8 h-8 opacity-10" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-20">Database Empty</p>
          </div>
        )}
      </div>
    </>
  );
}

function LicenseOverlay({ theme, user, onVerified }: { theme: string; user: any; onVerified: (data: any) => void }) {
  const [inputKey, setInputKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setIsValidating(true);
    setValidationError("");
    const toastId = toast.loading("Memverifikasi kunci lisensi...");

    try {
      const res = await fetch("/api/license/client-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: inputKey.trim(),
          email: user.email,
          clientDomain: window.location.hostname
        })
      });

      let data: any = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textStr = await res.text();
        data = { valid: false, message: textStr || `gRPC/HTTP Error ${res.status}` };
      }

      if (res.ok && data.valid) {
        toast.success("Lisensi berhasil terverifikasi!", { id: toastId });
        onVerified(data.license);
      } else {
        const msg = data.message || "Kunci lisensi tidak valid.";
        setValidationError(msg);
        toast.error(msg, { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      setValidationError("Gagal terhubung ke server lisensi.");
      toast.error("Gagal terhubung ke server lisensi.", { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-8 text-center backdrop-blur-2xl ${
      theme === 'dark' ? 'bg-[#070708]/95' : 'bg-[#f7f8fc]/95'
    }`}>
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 border-2 border-dashed ${
          theme === 'dark' ? 'bg-[#F2994A]/10 border-[#F2994A]/20 text-[#F2994A]' : 'bg-[#F2994A]/5 border-[#F2994A]/25 text-[#F2994A]'
        }`}
      >
        <Key className="w-8 h-8" />
      </motion.div>
      <h2 className="text-3xl font-black mb-3 tracking-tight">Kunci Lisensi Diperlukan</h2>
      <p className="max-w-md opacity-60 mb-6 leading-relaxed text-sm">
        Halo <strong>{user?.email}</strong>. Masukkan kunci lisensi Anda dibawah ini untuk mengaktifkan aplikasi.
      </p>

      {/* Input Lisensi Formulir */}
      <form onSubmit={handleVerify} className="w-full max-w-sm space-y-4 mb-6">
        <div className="relative">
          <input 
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            disabled={isValidating}
            className={`w-full px-6 py-4 rounded-2xl border text-center font-mono font-bold tracking-widest outline-none transition-all focus:ring-4 text-sm ${
              theme === "dark" 
                ? "bg-black/40 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/10 text-white" 
                : "bg-white border-slate-200 focus:border-indigo-300 focus:ring-indigo-100 text-slate-900"
            }`}
          />
        </div>
        
        {validationError && (
          <p className="text-red-500 text-xs font-bold">{validationError}</p>
        )}

        <button 
          type="submit"
          disabled={isValidating || !inputKey.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          {isValidating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memverifikasi...
            </span>
          ) : "Aktifkan Lisensi"}
        </button>
      </form>
      
      <div className={`p-5 rounded-[20px] text-left border flex items-start gap-4 transition-all max-w-sm mb-8 ${
        theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-100'
      }`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
        }`}>
          <Info className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5">Informasi Lisensi</p>
          <p className="text-xs font-medium leading-relaxed opacity-60">Lisensi dilindungi oleh sistem Dual-Lock (Kunci Email & Domain) untuk mencegah penyalahgunaan. Silakan gunakan kunci lisensi resmi Anda.</p>
        </div>
      </div>

      <button 
        onClick={() => auth.signOut()}
        className="mt-8 text-xs font-bold opacity-40 hover:opacity-100 transition-all flex items-center gap-2"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign out and try another account
      </button>
    </div>
  );
}

function MobileDrawer({ title, onClose, theme, children }: { title: string; onClose: () => void; theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-[40px] z-[110] border-t shadow-2xl p-8 custom-scrollbar ${
          theme === "dark" ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              <h2 className="text-xl font-bold tracking-tight">{title}</h2>
           </div>
           <button 
             onClick={onClose} 
             className={`p-3 rounded-full transition-all ${
               theme === "dark" ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
             }`}
           >
              <X className="w-6 h-6 text-zinc-500" />
           </button>
        </div>
        {children}
      </motion.div>
    </>
  );
}
