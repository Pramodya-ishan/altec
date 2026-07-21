import assert from "node:assert/strict";
import { findLessonSources, isLessonEvidenceMode, resolveLessonReference } from "../lessonResolver";
import { routeKnowledgeRequest } from "../knowledgeRouter";
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

assert.equal(resolveLessonReference("electrical questions", undefined, "ET")?.label, "විදුලි තාක්ෂණය / Electrical Technology");
assert.equal(resolveLessonReference("electrical questions", undefined, "SFT")?.label, "විද්‍යුතය / Electricity");
assert.equal(resolveLessonReference("2024 ET electronic q31", undefined, "ET")?.label, "ඉලෙක්ට්‍රොනික තාක්ෂණය / Electronics");


const policy = resolveAnswerPolicy("තරල පාඩමේ ප්‍රශ්න කරමු", { mode: "lesson_question_discussion" }, "SFT");
assert.equal(policy.requireEvidence, true);
assert.equal(policy.intent, "lesson_question_discussion");

const pdfPolicy = resolveAnswerPolicy("tharala pdf", { mode: "lesson_pdf_search" }, "SFT");
assert.equal(pdfPolicy.requireEvidence, true);
assert.equal(pdfPolicy.intent, "lesson_pdf_search");
assert.equal(isLessonEvidenceMode("lesson_pdf_search"), true);

const pdfRoute = await routeKnowledgeRequest({ prompt: "tharala pdf", uid: "test-user", activeSubject: "SFT" });
assert.equal(pdfRoute.mode, "lesson_pdf_search");
assert.equal(pdfRoute.entities.lesson, "තරල / Fluid mechanics");

assert.equal(computeIndexStatus({ indexStatus: "queued", chunkCount: 0, needsOcr: false }), "queued");
assert.equal(computeIndexStatus({ indexStatus: "ready", chunkCount: 4, needsOcr: false }), "ready");
assert.equal(computeIndexStatus({ indexStatus: "failed", chunkCount: 0, needsOcr: false }), "failed");

console.log("lesson resolver regression tests passed");
