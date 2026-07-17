import { readFile } from "node:fs/promises";

const lockPath = new URL("../package-lock.json", import.meta.url);
const lockText = await readFile(lockPath, "utf8");
const forbiddenHosts = [
  "packages.applied-caas-gateway1.internal.api.openai.org",
  "artifactory/api/npm/npm-public",
  "localhost",
  "127.0.0.1",
];

const violations = forbiddenHosts.filter((value) => lockText.includes(value));
if (violations.length > 0) {
  console.error(
    `package-lock.json contains non-portable npm registry references: ${violations.join(", ")}`,
  );
  process.exit(1);
}

console.log("npm lockfile registry check passed.");
