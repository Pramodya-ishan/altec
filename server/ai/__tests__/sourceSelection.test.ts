import assert from "node:assert/strict";
import {
  extractQuestionNumberFromPrompt,
  inferQuestionTypeFromText,
  parseSourceChoiceIndex,
  rankNamedSources,
  selectNamedSource,
} from "../sourceSelection";

const sources = [
  { id: "guess-mcq", title: "Guessing 01 MCQ", subject: "SFT", storagePath: "papers/guess-01-mcq.pdf", textIndexed: true },
  { id: "guess-essay", title: "Guessing 01 Essay", subject: "SFT", storagePath: "papers/guess-01-essay.pdf", textIndexed: true },
  { id: "paper-2025", title: "2025 SFT Paper", subject: "SFT", storagePath: "papers/2025.pdf", textIndexed: true },
];

const named = selectNamedSource(sources, "guessing 1 essay q1");
assert.equal(named.locked, true);
assert.equal(named.sourceId, "guess-essay");
assert.equal(extractQuestionNumberFromPrompt("guessing 1 essay q1"), "1");
assert.equal(inferQuestionTypeFromText("Guessing 01 Essay"), "ESSAY");
assert.equal(parseSourceChoiceIndex("2", 3), 1);
assert.equal(parseSourceChoiceIndex("4", 3), null);
assert.deepEqual(rankNamedSources(sources, "guessing 1 essay pdf").map((item) => item.source.id)[0], "guess-essay");

console.log("Source selection tests passed.");
