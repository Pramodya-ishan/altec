import { getDownloadURL, ref } from "firebase/storage";
import { auth, storage } from "./firebase";
import { apiUrl as resolveApiUrl } from "./apiBase";

export async function getAuthTokenOrThrow() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("LOGIN_REQUIRED");
  }
  return await user.getIdToken();
}

export async function openFirebaseStoragePdf(storagePath: string) {
  if (!storagePath) throw new Error("MISSING_STORAGE_PATH");

  const url = await getDownloadURL(ref(storage, storagePath));
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openProtectedApiPdf(apiUrl: string) {
  const token = await getAuthTokenOrThrow();

  const res = await fetch(resolveApiUrl(apiUrl), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PDF_OPEN_FAILED_${res.status}: ${text}`);
  }

  const blob = await res.blob();

  const contentType = blob.type || res.headers.get("content-type") || "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    const text = await blob.text().catch(() => "");
    throw new Error(`NOT_A_PDF_RESPONSE: ${text.slice(0, 300)}`);
  }

  const blobUrl = URL.createObjectURL(
    new Blob([blob], { type: "application/pdf" })
  );

  window.open(blobUrl, "_blank", "noopener,noreferrer");

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function openSourcePdf(source: any) {
  if (!source) throw new Error("MISSING_SOURCE");

  if (source.storagePath) {
    try {
      const url = await getDownloadURL(ref(storage, source.storagePath));
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    } catch (e: any) {
      console.error("Failed to open Firebase Storage PDF via storagePath:", e);
      throw e;
    }
  }

  if (source.url && /^https?:\/\//i.test(source.url)) {
    window.open(source.url, "_blank", "noopener,noreferrer");
    return;
  }

  if (source.url && source.url.startsWith("/api/")) {
    await openProtectedApiPdf(source.url);
    return;
  }

  if (source.apiUrl && source.apiUrl.startsWith("/api/")) {
    await openProtectedApiPdf(source.apiUrl);
    return;
  }

  throw new Error("NO_OPENABLE_PDF_SOURCE");
}


export async function getPdfUrl(source: any): Promise<string> {
  if (!source) throw new Error("MISSING_SOURCE");
  if (source.storagePath) {
    try {
      const url = await getDownloadURL(ref(storage, source.storagePath));
      return url;
    } catch (e: any) {
      console.error("Failed to get Firebase Storage PDF url:", e);
      throw e;
    }
  }
  if (source.url && /^https?:\/\//i.test(source.url)) {
    return source.url;
  }
  if ((source.url && source.url.startsWith("/api/")) || (source.apiUrl && source.apiUrl.startsWith("/api/"))) {
    const apiRoute = source.url || source.apiUrl;
    const token = await getAuthTokenOrThrow();
    const res = await fetch(resolveApiUrl(apiRoute), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("API_ERROR");
    const blob = await res.blob();
    return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  }
  throw new Error("NO_OPENABLE_PDF_SOURCE");
}
