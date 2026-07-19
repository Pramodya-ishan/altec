import assert from "node:assert/strict";
import JSZip from "jszip";
import { runWithConcurrency } from "../bulkActionQueue";
import {
  buildProjectFileContext,
  isProjectArchiveFile,
  isProjectTextFile,
  readProjectArchive,
} from "../projectFileUpload";

assert.equal(isProjectTextFile({ name: "App.tsx", type: "" } as File), true);
assert.equal(isProjectTextFile({ name: "photo.png", type: "image/png" } as File), false);
assert.equal(isProjectArchiveFile({ name: "project.zip", type: "application/zip" } as File), true);

const context = buildProjectFileContext([{ name: "x.ts", textContent: "export const x = 1;", attachmentType: "text" }]);
assert.match(context, /untrusted project data/i);
assert.match(context, /export const x/);

const zip = new JSZip();
zip.file("src/App.tsx", "export default function App() { return null; }");
zip.file("node_modules/ignored.js", "do not include");
zip.file("image.png", "\0binary");
const zipBytes = await zip.generateAsync({ type: "uint8array" });
const file = new File([zipBytes], "project.zip", { type: "application/zip" });
const archive = await readProjectArchive(file);
assert.deepEqual(archive.includedFiles, ["src/App.tsx"]);
assert.match(archive.text, /src\/App\.tsx/);
assert.doesNotMatch(archive.text, /do not include/);

const completed: number[] = [];
const results = await runWithConcurrency({
  items: [1, 2, 3],
  concurrency: 2,
  worker: async (item) => {
    if (item === 2) throw new Error("failed");
  },
  onProgress: (count) => completed.push(count),
});
assert.equal(results.filter((result) => result.ok).length, 2);
assert.equal(results.filter((result) => !result.ok).length, 1);
assert.deepEqual(completed.sort((a, b) => a - b), [1, 2, 3]);

console.log("Project upload and bulk-action tests passed.");
