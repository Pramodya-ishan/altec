import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveRuntimeAdjacentFile(relativePath: string): string | null {
  const runtimeUrl = (globalThis as { __ALTEC_RUNTIME_URL__?: unknown }).__ALTEC_RUNTIME_URL__;
  if (typeof runtimeUrl !== "string" || !runtimeUrl) return null;
  try {
    return fileURLToPath(new URL(relativePath, runtimeUrl));
  } catch {
    return null;
  }
}

export function resolveProjectFile(...segments: string[]): string {
  return resolve(process.cwd(), ...segments);
}
