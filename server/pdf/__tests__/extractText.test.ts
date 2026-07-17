import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "../extractText";

const textPdf = await PDFDocument.create();
const page = textPdf.addPage([500, 500]);
const font = await textPdf.embedFont(StandardFonts.Helvetica);
page.drawText("Question 1: This searchable text verifies that the PDF parser and worker are available.", { x: 40, y: 430, size: 14, font });
const textResult = await extractPdfText(Buffer.from(await textPdf.save()));
assert.equal(textResult.status, "PDF_TEXT_READY");
assert.equal(textResult.needsOcr, false);
assert.match(textResult.text, /Question 1/);

const scannedPdf = await PDFDocument.create();
scannedPdf.addPage([500, 500]);
const scanResult = await extractPdfText(Buffer.from(await scannedPdf.save()));
assert.equal(scanResult.needsOcr, true);
assert.notEqual(scanResult.status, "PDF_PARSER_RUNTIME_ERROR");
console.log("PDF extraction state tests passed");
