import { getDownloadURL, ref } from "firebase/storage";
import { auth, storage } from "./firebase";
import { apiUrl as resolveApiUrl } from "./apiBase";
import { apiFetch } from "./api";

type PdfSource = {
  id?: string;
  sourceId?: string;
  storagePath?: string;
  url?: string;
  apiUrl?: string;
  title?: string;
};

type ProtectedPdfResponse = {
  ok?: boolean;
  mode?: "signed_url" | "stream";
  url?: string;
  streamUrl?: string;
  expiresAt?: string;
  code?: string;
  message?: string;
  error?: string;
};

export async function getAuthTokenOrThrow() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error("LOGIN_REQUIRED");
  }
  return await user.getIdToken();
}

function addQuery(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function getProtectedPdfRoute(source: PdfSource): string | null {
  const explicit = [source.apiUrl, source.url]
    .find((value) => typeof value === "string" && value.startsWith("/api/"));
  if (explicit) return explicit;

  const sourceId = String(source.sourceId || source.id || "").trim();
  if (!sourceId) return null;
  return `/api/rag/sources/${encodeURIComponent(sourceId)}/download`;
}

async function responseError(response: Response) {
  const payload = await response.clone().json().catch(() => null) as ProtectedPdfResponse | null;
  const fallback = await response.text().catch(() => "");
  const message = payload?.message || payload?.error || fallback || response.statusText;
  const code = payload?.code || `PDF_OPEN_FAILED_${response.status}`;
  const error = new Error(`${code}: ${message}`);
  (error as any).code = code;
  (error as any).status = response.status;
  return error;
}

async function fetchProtectedPdfBlobUrl(apiRoute: string): Promise<string> {
  await getAuthTokenOrThrow();
  const streamRoute = addQuery(apiRoute, "stream", "true");
  const response = await apiFetch(resolveApiUrl(streamRoute), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) throw await responseError(response);

  const blob = await response.blob();
  const contentType = blob.type || response.headers.get("content-type") || "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    const text = await blob.text().catch(() => "");
    throw new Error(`NOT_A_PDF_RESPONSE: ${text.slice(0, 300)}`);
  }

  return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
}

export async function getProtectedPdfUrl(apiRoute: string): Promise<string> {
  await getAuthTokenOrThrow();
  const metadataRoute = addQuery(apiRoute, "format", "json");
  const response = await apiFetch(resolveApiUrl(metadataRoute), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) throw await responseError(response);

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null) as ProtectedPdfResponse | null;
    if (payload?.url && /^https?:\/\//i.test(payload.url)) return payload.url;
    if (payload?.mode === "stream" || payload?.streamUrl) {
      return await fetchProtectedPdfBlobUrl(payload.streamUrl || apiRoute);
    }
    throw new Error(payload?.message || payload?.error || "PDF_URL_UNAVAILABLE");
  }

  // Backward-compatible fallback for an older API deployment that streams the
  // PDF instead of returning JSON metadata.
  const blob = await response.blob();
  return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
}

export function getPdfOpenErrorMessage(error: unknown) {
  const message = String((error as any)?.message || error || "");
  const code = String((error as any)?.code || "");
  if (message.includes("LOGIN_REQUIRED") || code === "LOGIN_REQUIRED") return "Sign in again to open this PDF.";
  if (/SOURCE_ACCESS_FORBIDDEN|PDF_OPEN_FAILED_403/.test(`${code} ${message}`)) return "This PDF is not published for your account.";
  if (/SOURCE_FILE_NOT_FOUND|SOURCE_NOT_FOUND|NO_OPENABLE_PDF_SOURCE/.test(`${code} ${message}`)) return "This PDF file is no longer available.";
  if (/SOURCE_BACKEND_PERMISSION_ERROR|SOURCE_DOWNLOAD_FAILED/.test(`${code} ${message}`)) return "The secure PDF service could not open this file. Please try again shortly.";
  if (message.includes("NOT_A_PDF_RESPONSE")) return "The server returned an invalid PDF response.";
  return "The PDF could not be opened. Please try again.";
}

export async function openFirebaseStoragePdf(storagePath: string) {
  if (!storagePath) throw new Error("MISSING_STORAGE_PATH");
  const url = await getDownloadURL(ref(storage, storagePath));
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openProtectedApiPdf(apiRoute: string) {
  // Open synchronously so mobile Safari/Chrome do not classify the final tab as
  // an unsolicited popup after the authenticated URL request finishes.
  const popup = window.open("about:blank", "_blank");
  if (popup) {
    popup.opener = null;
    popup.document.title = "Opening PDF…";
    const status = popup.document.createElement("p");
    status.textContent = "Opening secure PDF…";
    status.style.cssText = "font:14px system-ui;padding:24px;color:#475569";
    popup.document.body.replaceChildren(status);
  }

  try {
    const url = await getProtectedPdfUrl(apiRoute);
    if (popup && !popup.closed) {
      popup.location.replace(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}

export async function openSourcePdf(source: PdfSource) {
  if (!source) throw new Error("MISSING_SOURCE");

  // Shared/official resources must go through the authenticated backend. This
  // deliberately bypasses Firebase client Storage rules, so students can open
  // published papers owned by an administrator without object-owner access.
  const protectedRoute = getProtectedPdfRoute(source);
  if (protectedRoute) {
    await openProtectedApiPdf(protectedRoute);
    return;
  }

  if (source.url && /^https?:\/\//i.test(source.url)) {
    window.open(source.url, "_blank", "noopener,noreferrer");
    return;
  }

  // Owner-only personal attachments may still use the Firebase client SDK when
  // no source record/API identity exists.
  if (source.storagePath) {
    await openFirebaseStoragePdf(source.storagePath);
    return;
  }

  throw new Error("NO_OPENABLE_PDF_SOURCE");
}

export async function getPdfUrl(source: PdfSource): Promise<string> {
  if (!source) throw new Error("MISSING_SOURCE");

  const protectedRoute = getProtectedPdfRoute(source);
  if (protectedRoute) return await getProtectedPdfUrl(protectedRoute);

  if (source.url && /^https?:\/\//i.test(source.url)) return source.url;

  if (source.storagePath) {
    // Personal owner-only attachment fallback.
    return await getDownloadURL(ref(storage, source.storagePath));
  }

  throw new Error("NO_OPENABLE_PDF_SOURCE");
}
