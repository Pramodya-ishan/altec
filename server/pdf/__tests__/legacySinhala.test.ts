import assert from "node:assert/strict";
import { detectSinhalaTextEncoding, normalizeSinhalaExtractedText } from "../legacySinhala";

const sample = "Ydlhl j3⁄4Okh m%d:ñl j3⁄4Okh yd o aú; Sl j3⁄4Okh f,i m%Odk wdldr follg isÿ fõ.";
assert.equal(detectSinhalaTextEncoding(sample).encoding, "legacy_fm_abhaya");
const result = normalizeSinhalaExtractedText(sample);
assert.equal(result.textEncoding, "legacy_fm_abhaya");
assert.ok(result.normalizedText.includes("ශාකයක වර්ධනය"), result.normalizedText);
assert.ok(result.normalizedText.includes("ප්‍රාථමික වර්ධනය"), result.normalizedText);
assert.ok(result.normalizedText.includes("ද්විතීක වර්ධනය"), result.normalizedText);
assert.ok(!/[A-Za-z]{4,}/u.test(result.normalizedText), result.normalizedText);

const lowConfidence = normalizeSinhalaExtractedText("m% x z q random ABC legacy ???");
assert.equal(lowConfidence.normalizedText, "", "unreliable legacy output must not enter the RAG index");
assert.equal(lowConfidence.needsLegacyConversion, true);
console.log("legacy Sinhala tests passed");
