import fs from "fs";
import path from "path";

const FORBIDDEN_PATTERN = "ais-dev-gpqcngantkpaaav3si4cpn";

const TARGETS = [
  "src",
  "server",
  "public",
  "index.html",
  "vercel.json",
  "package.json",
  "vite.config.ts"
];

function scanDirOrFile(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stats = fs.statSync(targetPath);
  
  if (stats.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    for (const file of files) {
      scanDirOrFile(path.join(targetPath, file));
    }
  } else if (stats.isFile()) {
    // Skip scripts/ itself and node_modules / .git / dist / .next / build
    const relative = path.relative(process.cwd(), targetPath);
    if (
      relative.startsWith("node_modules") ||
      relative.startsWith(".git") ||
      relative.startsWith("dist") ||
      relative.startsWith("scripts/check-no-old-preview-url.mjs") ||
      relative.startsWith(".dev.env.json") // skip the local dev env config
    ) {
      return;
    }
    
    try {
      const content = fs.readFileSync(targetPath, "utf-8");
      if (content.includes(FORBIDDEN_PATTERN)) {
        console.error(`\x1b[31mError: Found forbidden URL pattern "${FORBIDDEN_PATTERN}" in file: ${relative}\x1b[0m`);
        process.exit(1);
      }
    } catch (e) {
      // Ignore binary files or unreadable files
    }
  }
}

console.log("Scanning files for old preview URLs...");
for (const target of TARGETS) {
  scanDirOrFile(path.resolve(target));
}
console.log("No old preview URLs found. Success!");
process.exit(0);
