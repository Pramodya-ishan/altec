/**
 * Normalizes Firebase Storage paths and handles different formats
 */
export type NormalizedPath = 
  | { kind: "path"; path: string }
  | { kind: "downloadUrl"; url: string };

export function normalizeStoragePath(input: string): NormalizedPath {
  if (!input) throw new Error("Storage path input is empty");

  // 1. Handle gs:// bucket paths
  if (input.startsWith("gs://")) {
    try {
      const url = new URL(input);
      // Remove leading slash from pathname
      const path = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
      return { kind: "path", path };
    } catch (e) {
      // Fallback for malformed gs URLs
      const path = input.replace(/gs:\/\/[^\/]+\//, "");
      return { kind: "path", path };
    }
  }

  // 2. Handle Firebase download URLs
  if (input.startsWith("https://firebasestorage.googleapis.com")) {
    return { kind: "downloadUrl", url: input };
  }

  // 3. Handle paths with leading slash
  let path = input;
  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  return { kind: "path", path };
}
