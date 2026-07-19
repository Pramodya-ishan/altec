import assert from "node:assert/strict";
import { detectOfficialPaperCandidate } from "../../ai-core/intent/paperQuestionParser";
import { routeKnowledgeRequest } from "../knowledgeRouter";
import { extractTitleYear, inferResourceType, inferSubject } from "../../sources/sourceInventoryService";
import { resolveStrictSource } from "../../ai-core/sources/sourceResolver";

const q50 = detectOfficialPaperCandidate("2025 50 mcq eke answer eka", "SFT");
assert.equal(q50.isOfficialPaperCandidate, true);
assert.equal(q50.year, "2025");
assert.equal(q50.subject, "SFT");
assert.equal(q50.questionNo, "50");
assert.equal(q50.questionType, "MCQ");

const q5 = detectOfficialPaperCandidate("2025 sft paper 5th mcq", null);
assert.equal(q5.questionNo, "5");
assert.equal(q5.subject, "SFT");

const prediction = await routeKnowledgeRequest({
  prompt: "2026 paper ekt oya okkoma pdf use krl guessing denna",
  activeSubject: "SFT",
});
assert.equal(prediction.mode, "past_paper_analysis");
assert.equal(prediction.entities.subject, "SFT");
assert.equal(prediction.entities.year, "2026");

const inventory = await routeKnowledgeRequest({ prompt: "give all pdfs", activeSubject: "SFT" });
assert.equal(inventory.mode, "pdf_inventory_request");
assert.equal(inventory.entities.subject, undefined);

const explicitInventory = await routeKnowledgeRequest({ prompt: "give all SFT pdfs" });
assert.equal(explicitInventory.mode, "pdf_inventory_request");
assert.equal(explicitInventory.entities.subject, "SFT");

const answerableInventory = await routeKnowledgeRequest({
  prompt: "oyt answers denna puluwn pdf mond kiyl check krnn",
  activeSubject: "SFT",
});
assert.equal(answerableInventory.mode, "pdf_inventory_request");
assert.equal(answerableInventory.entities.inventoryMode, "answerable");
assert.equal(answerableInventory.entities.subject, undefined);

assert.equal(inferSubject("**2025 sft paper **"), "SFT");
assert.equal(extractTitleYear("2025 Science for Technology Full SM (1).pdf"), "2025");
assert.equal(inferResourceType({ title: "2025 Science for Technology Full SM (1).pdf" }), "marking_scheme");
assert.equal(inferResourceType({ title: "2025 SFT official paper.pdf" }), "past_paper");

const strict = resolveStrictSource([
  {
    id: "paper-2025",
    title: "2025 SFT official paper.pdf",
    subject: "SFT",
    year: "2025",
    resourceType: "past_paper",
    downloadUrl: "https://firebasestorage.googleapis.com/v0/b/example/o/papers%2F2025-sft.pdf?alt=media",
  },
  {
    id: "scheme-2025",
    title: "2025 Science for Technology Full SM.pdf",
    subject: "SFT",
    year: "2025",
    resourceType: "marking_scheme",
    storagePath: "papers/2025-sft-sm.pdf",
  },
], {
  subject: "SFT",
  year: "2025",
  prompt: "2025 50 mcq eke answer eka",
  expectedResourceType: "past_paper",
});
assert.equal(strict.sourceLocked, true);
assert.equal(strict.selectedSourceId, "paper-2025");

const namedGuessing = [
  { id: "guess-1", title: "2025 Guessing 1 Essay.pdf", subject: "SFT", storagePath: "papers/g1.pdf", textIndexed: true },
  { id: "guess-2", title: "2025 Guessing 2 Essay.pdf", subject: "SFT", storagePath: "papers/g2.pdf", textIndexed: true },
];
const { selectNamedSource, extractQuestionNumberFromPrompt } = await import("../../ai/sourceSelection");
const selectedGuessing = selectNamedSource(namedGuessing, "2025 guessing 1 pdf q1");
assert.equal(selectedGuessing.sourceId, "guess-1");
assert.equal(extractQuestionNumberFromPrompt("2025 guessing 1 pdf q1"), "1");

console.log("Paper routing regression tests passed.");
