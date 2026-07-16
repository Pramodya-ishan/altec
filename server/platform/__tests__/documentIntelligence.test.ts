import assert from "node:assert/strict";
import { calculateDocumentQuality, classifyDocumentMetadata, cleanupResourceTitle } from "../documentIntelligence";

assert.equal(cleanupResourceTitle("2025_SFT_FINAL_SCAN.pdf"), "2025 SFT");

const metadata = classifyDocumentMetadata({
  fileName: "AL_2025_67_S-I.pdf",
  title: "2025 SFT Past Paper",
  text: "අධ්‍යයන පොදු සහතික පත්‍ර උසස් පෙළ විභාගය 2025 Science for Technology I MCQ (1) A (2) B",
});
assert.equal(metadata.subject, "SFT");
assert.equal(metadata.year, "2025");
assert.equal(metadata.paperKind, "past_paper");
assert.equal(metadata.questionType, "MCQ");
assert.ok(metadata.confidence >= 0.7);

const validBuffer = Buffer.from("%PDF-1.7\npage content\n%%EOF");
const quality = calculateDocumentQuality({
  buffer: validBuffer,
  text: "ශ්‍රී ලංකාව Science for Technology ".repeat(100),
  pages: [{ pageNumber: 1, text: "ශ්‍රී ලංකාව Science for Technology ".repeat(100), conversionConfidence: 0.95 }],
  ocrConfidence: 0.95,
});
assert.equal(quality.validPdfHeader, true);
assert.equal(quality.hasEofMarker, true);
assert.equal(quality.corruptionRisk, "low");
assert.equal(quality.lowConfidencePages.length, 0);
assert.equal(quality.fileFingerprint.length, 64);

console.log("documentIntelligence tests passed");
