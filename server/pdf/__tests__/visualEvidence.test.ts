import assert from "node:assert/strict";
import { questionRequiresVisualEvidence } from "../visualEvidence";
import { isPaperOutlineIntent, formatPaperOutlineMarkdown } from "../paperOutline";

assert.equal(questionRequiresVisualEvidence("පහත දැක්වෙන යන්ත්‍ර කොටසේ ඉදිරි පෙනුම අඳින්න"), true);
assert.equal(questionRequiresVisualEvidence("වස්තුවේ බර ගණනය කරන්න"), false);
assert.equal(questionRequiresVisualEvidence("Use the following diagram and dimensions"), true);

assert.equal(isPaperOutlineIntent("full paper eke lesson name and point name wise denna"), true);
assert.equal(isPaperOutlineIntent("q1 answer"), false);

const markdown = formatPaperOutlineMarkdown({
  sourceId: "guess-1",
  sourceTitle: "Guessing 01 Essay",
  complete: true,
  warning: null,
  extractionMethod: "pdf_vision",
  sections: [{ questionLabel: "Q1(A)", lesson: "ශාක වර්ධනය", points: ["ද්විතීයික වර්ධනය", "අරටුව සහ එලය"], pageNumber: 1, evidence: "ශාක වර්ධනය" }],
});
assert.ok(markdown.includes("ශාක වර්ධනය"));
assert.ok(markdown.includes("Q1(A)"));

console.log("PDF visual evidence and outline intent tests passed.");
