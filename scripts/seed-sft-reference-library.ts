import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminBucket, getAdminDb } from "../server/firebase/admin";
import { processUploadedPdf } from "../server/pdf/processingPipeline";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = path.join(root, "seed", "sft-reference-library");
const sourceDir = path.join(root, "assets", "authoritative", "sft");
const manifest = JSON.parse(await readFile(path.join(seedDir, "manifest.json"), "utf8"));
const uid = String(process.env.SFT_REFERENCE_OWNER_UID || "7kUEmzikv8hat7KQg8pCNGR1ZUd2");
const db = getAdminDb();
const bucket = getAdminBucket();

for (const source of manifest.sources) {
  const localPath = path.join(sourceDir, source.file);
  const buffer = await readFile(localPath);
  const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 20);
  const sourceId = `official_sft_${digest}`;
  const storagePath = source.authoritative
    ? "official/syllabus/SFT/sALSyl_SFT.pdf"
    : `official/reference-books/SFT/${source.file.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;

  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    metadata: { contentType: "application/pdf", cacheControl: "private, max-age=86400" },
  });

  const now = new Date().toISOString();
  await db.collection("rag_sources").doc(sourceId).set({
    id: sourceId,
    sourceId,
    ownerUid: uid,
    createdBy: uid,
    subject: "SFT",
    title: source.title,
    fileName: source.file,
    storagePath,
    resourceType: source.resourceType,
    sourceType: "pdf",
    sourceScope: source.sourceScope,
    lesson: source.lesson,
    lessonTitle: source.lesson,
    visibility: "official",
    published: true,
    authoritative: Boolean(source.authoritative),
    processingStatus: "processing",
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  const result = await processUploadedPdf({
    uid,
    sourceId,
    storagePath,
    fileName: source.file,
    title: source.title,
    subject: "SFT",
    resourceType: source.resourceType,
    sourceType: "pdf",
    sourceScope: source.sourceScope,
    lesson: source.lesson,
    buffer,
  });
  console.log(JSON.stringify({ sourceId, title: source.title, storagePath, result }));
}
