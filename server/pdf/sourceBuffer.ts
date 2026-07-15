import { getAdminBucket } from "../firebase/admin";
import { retryGoogleAuthOperation } from "../utils/retry";

const DEFAULT_MAX_BYTES = 80 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 45_000;

function configuredMaxBytes() {
  const configured = Number(process.env.DIRECT_PDF_MAX_BYTES || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

export function storageObjectPath(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("gs://")) return raw.replace(/^gs:\/\/[^/]+\//, "");
  if (/^https:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname === "firebasestorage.googleapis.com") {
        const marker = "/o/";
        const index = url.pathname.indexOf(marker);
        return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : "";
      }
      if (url.hostname === "storage.googleapis.com") {
        const parts = url.pathname.replace(/^\/+/, "").split("/");
        return decodeURIComponent(parts.slice(1).join("/"));
      }
    } catch {
      return "";
    }
  }
  return raw.replace(/^\/+/, "");
}

export function storageBucketName(value: unknown) {
  const raw = String(value || "").trim();
  if (raw.startsWith("gs://")) {
    return raw.slice(5).split("/")[0] || "";
  }
  if (/^https:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname === "firebasestorage.googleapis.com") {
        return decodeURIComponent(url.pathname.match(/\/v0\/b\/([^/]+)\/o\//)?.[1] || "");
      }
      if (url.hostname === "storage.googleapis.com") {
        return decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] || "");
      }
    } catch {
      return "";
    }
  }
  return "";
}

/** Return a token-free GCS URI for an already-authorized Firebase object. */
export function storageGsUri(value: unknown, fallbackPath?: unknown) {
  const path = storageObjectPath(value) || storageObjectPath(fallbackPath);
  const bucket = storageBucketName(value)
    || String(process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim();
  if (!path || !bucket || !/^[a-z0-9._-]+$/i.test(bucket)) return "";
  return `gs://${bucket}/${path}`;
}

/**
 * Only Firebase/Google Storage HTTPS URLs for the exact resolved object are
 * accepted. This lets the browser hand the backend a Firebase download-token
 * URL without turning the endpoint into an SSRF proxy.
 */
export function validatedPdfDownloadUrl(value: unknown, expectedStoragePath: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    if (!["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(url.hostname)) return "";
    if (storageObjectPath(raw) !== storageObjectPath(expectedStoragePath)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchPdfUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1" },
    });
    if (!response.ok) throw new Error(`Firebase download URL returned HTTP ${response.status}.`);

    const declaredSize = Number(response.headers.get("content-length") || 0);
    const maxBytes = configuredMaxBytes();
    if (declaredSize > maxBytes) throw new Error(`PDF is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB direct-read limit.`);

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxBytes) throw new Error("PDF download was empty or exceeded the direct-read limit.");
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Storage response is not a PDF document.");
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPdfSourceBuffer(params: {
  source?: Record<string, any> | null;
  storagePath: string;
  submittedDownloadUrl?: unknown;
}) {
  const { source, storagePath, submittedDownloadUrl } = params;
  const candidateUrls = [
    submittedDownloadUrl,
    source?.downloadUrl,
    source?.url,
    source?.firebaseDownloadUrl,
  ]
    .map((value) => validatedPdfDownloadUrl(value, storagePath))
    .filter(Boolean);

  const failures: string[] = [];
  for (const url of [...new Set(candidateUrls)]) {
    try {
      return { buffer: await fetchPdfUrl(url), method: "firebase_download_url" as const };
    } catch (error: any) {
      failures.push(`token_url:${String(error?.message || error)}`);
    }
  }

  try {
    const bucket = getAdminBucket();
    const file = bucket.file(storageObjectPath(storagePath));
    const [bytes] = await retryGoogleAuthOperation("directPdfAdminDownload", async () => file.download());
    if (!bytes?.length || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Admin Storage returned an empty or non-PDF object.");
    }
    if (bytes.length > configuredMaxBytes()) throw new Error("PDF exceeds the direct-read limit.");
    return { buffer: bytes, method: "firebase_admin" as const };
  } catch (error: any) {
    failures.push(`admin_storage:${String(error?.message || error)}`);
  }

  const error = new Error("The original PDF could not be read through its Firebase download URL or Admin Storage.");
  (error as any).code = "DIRECT_QA_SOURCE_DOWNLOAD_FAILED";
  (error as any).details = failures;
  throw error;
}
