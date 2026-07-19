import assert from "node:assert/strict";
import { scoreOcrText, selectOcrEnsemble } from "../ocrEnsemble";

const clean = "ප්‍රශ්නය 1. වස්තුවේ බර ගණනය කරන්න. (i) සූත්‍රය ලියන්න. (ii) පිළිතුර සොයන්න.";
const legacy = "m%Yak 1. jia;=fõ nr .Kkh lrkak. (i) iQ;%h ,shkak.";
assert.ok(scoreOcrText(clean, 0.9) > scoreOcrText(legacy, 0.9));

const ensemble = selectOcrEnsemble([
  { pageNumber: 1, text: legacy, provider: "pdf_text", confidence: 0.8 },
  { pageNumber: 1, text: clean, provider: "cloud_vision", confidence: 0.9 },
  { pageNumber: 2, text: "Question 2. Calculate the force using F = ma.", provider: "gemini_pdf_vision", confidence: 0.85 },
]);
assert.equal(ensemble.pages.length, 2);
assert.equal(ensemble.pages[0].provider, "cloud_vision");
assert.match(ensemble.pages[0].text, /ප්‍රශ්නය/);
assert.ok(ensemble.averageQuality > 0.5);

console.log("OCR ensemble tests passed.");
