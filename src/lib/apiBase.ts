export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const DIRECT_BASE = import.meta.env.VITE_BACKEND_DIRECT_URL || "";

const LARGE_PATHS = [
  "/api/pdf/direct-qa-file",
  "/api/rag/reindex-uploaded",
  "/api/rag/ingest-uploaded"
];

export function apiUrl(path: string) {
  if (path.startsWith("http")) return path;
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function toPathOnly(input: string) {
  if (input.startsWith("http")) {
    try {
      const u = new URL(input);
      return `${u.pathname}${u.search}`;
    } catch {
      return input;
    }
  }
  return input.startsWith("/") ? input : `/${input}`;
}

export function getLargeEndpointUrl(input: string): string {
  const pathOnly = toPathOnly(input);
  const isLarge = LARGE_PATHS.some(p => pathOnly.startsWith(p));

  if (DIRECT_BASE && isLarge) {
    if (typeof window !== "undefined") {
      try {
        const directUrl = new URL(DIRECT_BASE);
        // If the current hostname is different from the direct backend hostname,
        // we must use our current runtime container's backend.
        if (window.location.hostname !== directUrl.hostname) {
          console.warn("[API] Overriding VITE_BACKEND_DIRECT_URL due to hostname mismatch:", {
            current: window.location.hostname,
            direct: directUrl.hostname
          });
          return apiUrl(pathOnly);
        }
      } catch (e) {
        // ignore invalid URL
      }
    }
    return `${DIRECT_BASE.replace(/\/$/, "")}${pathOnly}`;
  }

  return apiUrl(pathOnly);
}
