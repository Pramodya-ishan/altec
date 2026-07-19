import assert from "node:assert/strict";
import { assessDirectPdfResultCompleteness, createDirectPdfInputPart } from "../directPdfQa";

const uri = "gs://example-bucket/users/u/source.pdf";
assert.deepEqual(createDirectPdfInputPart(undefined, uri), {
  fileData: { mimeType: "application/pdf", fileUri: uri },
});

const inline = createDirectPdfInputPart(Buffer.from("%PDF-test")) as any;
assert.equal(inline.inlineData.mimeType, "application/pdf");
assert.equal(Buffer.from(inline.inlineData.data, "base64").toString(), "%PDF-test");
assert.equal(createDirectPdfInputPart(), null);

const completeEssay = assessDirectPdfResultCompleteness({
  found: true,
  confidence: 0.9,
  sourceEvidence: {
    questionText: "(A) බලය සම්බන්ධයෙන් (i) බර ගණනය කරන්න. (ii) ප්‍රතික්‍රියා බලය ගණනය කරන්න.",
  },
  answer: {
    solvedAnswer: {
      answerMarkdownSinhala: "(A)(i) W = mg = 100 N වේ.\n\n(A)(ii) සිරස් සමතුලිතතාවයෙන් R = 13.4 N වේ.",
      answeredSubparts: ["A.i", "A.ii"],
      missingSubparts: [],
      complete: true,
    },
  },
}, "ESSAY");
assert.equal(completeEssay.passed, true);
assert.equal(completeEssay.coveragePercent, 100);

const partialEssay = assessDirectPdfResultCompleteness({
  found: true,
  sourceEvidence: {
    questionText: "(A) බලය සම්බන්ධයෙන් (i) බර ගණනය කරන්න. (ii) ප්‍රතික්‍රියා බලය ගණනය කරන්න.",
  },
  answer: {
    solvedAnswer: {
      answerMarkdownSinhala: "(A)(i) W = mg = 100 N වේ. මෙය පළමු කොටසේ පිළිතුරයි.",
      answeredSubparts: ["A.i"],
      missingSubparts: ["A.ii"],
      complete: false,
    },
  },
}, "ESSAY");
assert.equal(partialEssay.passed, false);
assert.deepEqual(partialEssay.missingRequirements, ["Unanswered question parts: A.ii."]);

const extractionOnly = assessDirectPdfResultCompleteness({
  found: true,
  sourceEvidence: { questionText: "මෙය extraction පමණක් ඇති සම්පූර්ණ ප්‍රශ්න වාක්‍යයකි." },
  answer: {},
}, "ESSAY");
assert.equal(extractionOnly.passed, false);

console.log("Direct PDF input tests passed");
