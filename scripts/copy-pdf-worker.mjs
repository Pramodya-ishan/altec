import fs from "fs";
import path from "path";

const possibleWorkerPaths = [
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.min.js",
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js",
  "node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.js"
];

const destDir = path.resolve("public");
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

let copied = false;
for (const workerPath of possibleWorkerPaths) {
  const fullPath = path.resolve(workerPath);
  if (fs.existsSync(fullPath)) {
    const isMjs = workerPath.endsWith(".mjs");
    const destName = isMjs ? "pdf.worker.min.mjs" : "pdf.worker.min.js";
    fs.copyFileSync(fullPath, path.join(destDir, destName));
    if (isMjs) fs.copyFileSync(fullPath, path.join(destDir, "pdf.worker.mjs"));
    console.log(`Copied worker from ${workerPath} to public/${destName}`);
    fs.writeFileSync(path.join(destDir, "pdf-worker-manifest.json"), JSON.stringify({ worker: `/${destName}` }));
    copied = true;
    break;
  }
}

if (!copied) {
  console.error("Could not find any pdf.worker.min.js/mjs source file.");
  process.exit(1);
}
