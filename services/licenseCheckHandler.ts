export async function handleLicenseCheck(
  licenseKey: string,
  clientHeaders?: any,
  clientDomain?: string,
  buyerEmail?: string
) {
  if (!licenseKey) {
    return { success: false, status: 400, message: "Kunci lisensi wajib diisi." };
  }

  const rawApiUrl = process.env.SRFACTORY_API_URL || "https://www.srfactory.web.id";
  const SRFACTORY_API_KEY = process.env.SRFACTORY_API_KEY;

  if (!SRFACTORY_API_KEY) {
    return {
      success: false,
      status: 500,
      message:
        "Konfigurasi SRFACTORY_API_KEY belum di-set di environment server Voice Generator. Harap atur API Key di menu Settings.",
    };
  }

  // Robust parsing: handle both base domains and full endpoint URLs
  let endpointUrl = rawApiUrl.trim();
  if (!endpointUrl.includes("/api/license/validate")) {
    if (endpointUrl.endsWith("/")) {
      endpointUrl = endpointUrl.slice(0, -1);
    }
    endpointUrl = `${endpointUrl}/api/license/validate`;
  }

  // Extract / parse domain
  let domain = clientDomain || "";
  if (!domain && clientHeaders) {
    const referer = clientHeaders.referer || "";
    if (referer) {
      try {
        const url = new URL(referer);
        domain = url.hostname;
      } catch (e) {}
    }
    if (!domain && clientHeaders.origin) {
      try {
        const url = new URL(clientHeaders.origin);
        domain = url.hostname;
      } catch (e) {}
    }
    if (!domain && clientHeaders.host) {
      domain = clientHeaders.host.split(":")[0];
    }
  }

  if (domain) {
    domain = domain.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];
  }

  const origin =
    clientHeaders?.origin ||
    (clientHeaders?.host ? `https://${clientHeaders.host}` : "");
  const referer =
    clientHeaders?.referer ||
    (clientHeaders?.host ? `https://${clientHeaders.host}/` : "");

  console.log(
    `📡 Memvalidasi kunci lisensi: ${licenseKey} ke ${endpointUrl} (Host/Domain terdeteksi: ${domain}, Email: ${buyerEmail})`
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 6000);

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SRFACTORY_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: origin,
        Referer: referer,
      },
      body: JSON.stringify({
        licenseKey: licenseKey,
        productName: "Voice Generator Pro",
        buyerEmail: buyerEmail || "",
        email: buyerEmail || "",
        requestDomain: domain || "",
        domain: domain || "",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    let data: any = {};
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const textResponse = await response.text();
      console.error("Non-JSON response from SRFactory:", textResponse, "Status:", response.status);
      
      let errorMsg = "Response dari server SRFactory tidak valid (Bukan JSON).";
      if (response.status === 403) {
        errorMsg = "Akses ditolak (403 Forbidden). Pastikan Kunci API (SRFACTORY_API_KEY) benar atau periksa whitelist IP/domain Anda di panel CMS SRFactory.";
      } else if (response.status === 401) {
        errorMsg = "Otorisasi gagal (401 Unauthorized). Harap periksa kembali token SRFACTORY_API_KEY Anda.";
      } else if (response.status === 404) {
        errorMsg = "Endpoint verifikasi tidak ditemukan (404 Not Found).";
      } else if (response.status >= 500) {
        errorMsg = `Server SRFactory mengalami masalah internal (HTTP ${response.status}).`;
      }

      return {
        success: false,
        status: response.status || 502,
        message: errorMsg,
      };
    }

    if (response.ok && data.valid) {
      return {
        success: true,
        status: 200,
        message: "Lisensi aktif! Mengalihkan ke aplikasi...",
        licenseDetails: data.license,
      };
    } else {
      return {
        success: false,
        status: response.status,
        message: data.message || "Lisensi tidak valid atau telah kedaluwarsa.",
      };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Gagal melakukan pengecekan lisensi:", error);
    if (error.name === "AbortError") {
      return {
        success: false,
        status: 504,
        message:
          "Koneksi ke server CMS SRFactory habis waktu (Timeout). Harap coba kembali sebentar lagi.",
      };
    }
    return {
      success: false,
      status: 500,
      message:
        "Gagal tersambung ke server CMS SRFactory. Silakan periksa koneksi internet Anda atau coba lagi nanti.",
    };
  }
}
