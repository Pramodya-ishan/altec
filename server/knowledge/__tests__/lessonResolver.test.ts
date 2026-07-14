import assert from "node:assert/strict";
import { findLessonSources, resolveLessonReference } from "../lessonResolver";
import { resolveAnswerPolicy } from "../../ai/answerPolicy";
import { computeIndexStatus } from "../../sources/sourceInventoryService";

const sources = [
  { id: "fluid-note", title: "SFT තරල පාඩම Revision", lesson: "තරල", chunkCount: 8, textIndexed: true },
  { id: "fluid-paper", title: "Fluid Mechanics Past Paper Questions", lesson: "Fluid mechanics", chunkCount: 12, textIndexed: true },
  { id: "electricity", title: "විද්‍යුතය", lesson: "විද්‍යුතය", chunkCount: 5, textIndexed: true },
];

const romanized = findLessonSources(sources, "tharala padame prashna karamu");
assert.equal(romanized.reference?.label, "තරල / Fluid mechanics");
assert.deepEqual(romanized.sources.map((source) => source.id).sort(), ["fluid-note", "fluid-paper"]);

const sinhala = findLessonSources(sources, "තරල පාඩමේ past paper ප්‍රශ්න කරමු");
assert.deepEqual(sinhala.sources.map((source) => source.id).sort(), ["fluid-note", "fluid-paper"]);

assert.equal(resolveLessonReference("Python lesson quiz")?.label, "Python");

const policy = resolveAnswerPolicy("තරල පාඩමේ ප්‍රශ්න කරමු", { mode: "lesson_question_discussion" }, "SFT");
assert.equal(policy.requireEvidence, true);
assert.equal(policy.intent, "lesson_question_discussion");

assert.equal(computeIndexStatus({ indexStatus: "queued", chunkCount: 0, needsOcr: false }), "queued");
assert.equal(computeIndexStatus({ indexStatus: "ready", chunkCount: 4, needsOcr: false }), "ready");
assert.equal(computeIndexStatus({ indexStatus: "failed", chunkCount: 0, needsOcr: false }), "failed");

console.log("lesson resolver regression tests passed");
