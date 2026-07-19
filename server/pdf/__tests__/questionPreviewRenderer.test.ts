import assert from "node:assert/strict";
import { PDFDocument, rgb } from "pdf-lib";
import { createPdfQuestionPreviewFallback, renderPdfPageCrop } from "../questionPreview";

const document = await PDFDocument.create();
const page = document.addPage([400, 300]);
page.drawText("Verified question diagram", { x: 40, y: 240, size: 18 });
page.drawRectangle({ x: 80, y: 80, width: 220, height: 100, borderWidth: 3, borderColor: rgb(0.1, 0.2, 0.8) });
const bytes = await document.save();

const rendered = await renderPdfPageCrop(Buffer.from(bytes), 1, {
  x: 0.1,
  y: 0.2,
  width: 0.8,
  height: 0.65,
});

assert.equal(rendered.pageNumber, 1);
assert.ok(rendered.width > 100 && rendered.height > 100);
assert.ok(rendered.png.length > 500);
assert.deepEqual([...rendered.png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

console.log("PDF question preview renderer tests passed.");

const fallback = createPdfQuestionPreviewFallback({ title: "2025 SFT paper", pageNumber: 3, code: "TEST" });
assert.match(fallback.imageUrl, /^data:image\/svg\+xml;base64,/);
assert.equal(fallback.pageNumber, 3);
assert.equal(fallback.previewUnavailable, true);
