import { rm, stat } from "node:fs/promises";

// These paths belong to the pre-V11 legacy backend. They are intentionally
// removed before every typecheck/build so copying a repaired project over an
// older checkout cannot leave stale, insecure TypeScript files behind.
const obsoletePaths = [
  "server/app.ts",
  "server/dev.ts",
  "server/data/userRepository.ts",
  "data_users",
];

const removed = [];
for (const path of obsoletePaths) {
  try {
    await stat(path);
    await rm(path, { recursive: true, force: true });
    removed.push(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

if (removed.length > 0) {
  console.log(`[CLEANUP] Removed obsolete legacy paths: ${removed.join(", ")}`);
} else {
  console.log("[CLEANUP] No obsolete legacy paths found.");
}
