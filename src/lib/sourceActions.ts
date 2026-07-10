import { getDownloadURL, ref } from "firebase/storage";
import { auth, storage } from "./firebase";

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

  const res = await fetch(apiUrl, {
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

  let lastError = null;

  if (source.storagePath) {
    try {
      await openFirebaseStoragePdf(source.storagePath);
      return;
    } catch (e: any) {
      console.warn("Failed to open Firebase Storage PDF:", e);
      lastError = e;
      // Fall through to try URLs if they exist
    }
  }

  if (source.url && /^https?:\/\//i.test(source.url)) {
    window.open(source.url, "_blank", "noopener,noreferrer");
    return;
  }

  if (source.url && source.url.startsWith("/api/")) {
    try {
       await openProtectedApiPdf(source.url);
       return;
    } catch(e: any) {
       console.warn("Failed to open protected API PDF:", e);
       lastError = e;
    }
  }

  if (source.apiUrl && source.apiUrl.startsWith("/api/")) {
    try {
       await openProtectedApiPdf(source.apiUrl);
       return;
    } catch(e: any) {
       console.warn("Failed to open protected API PDF (apiUrl):", e);
       lastError = e;
    }
  }

  throw lastError || new Error("NO_OPENABLE_PDF_SOURCE");
}
