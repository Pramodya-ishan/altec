import assert from "node:assert/strict";
import { assessTurnRisk } from "../turnRisk";

const low = assessTurnRisk({
  prompt: "තාපය කියන්නේ මොකක්ද?",
  mode: "tutor_explanation",
  evidenceRequired: false,
});
assert.equal(low.level, "low");
assert.equal(low.useProWriter, false);
assert.equal(low.useModelPlanner, false);
assert.equal(low.useModelReviewer, false);
assert.ok(low.maxContinuationPasses <= 2);

const official = assessTurnRisk({
  prompt: "2024 ET MCQ 31 නිල ප්‍රශ්නය options සමඟ විසඳන්න",
  mode: "paper_question_qa",
  evidenceRequired: true,
  sourceCount: 2,
  hasExactQuestionText: true,
});
assert.ok(["high", "critical"].includes(official.level));
assert.equal(official.useProWriter, true);
assert.equal(official.useModelReviewer, true);
assert.ok(official.contextCharBudget > low.contextCharBudget);

const critical = assessTurnRisk({
  prompt: "(a) (i) පරිපථය විශ්ලේෂණය කරන්න. (ii) ධාරාව ගණනය කරන්න. (b) ප්‍රස්තාරය ඇඳලා official marking scheme අනුව සාධනය කරන්න.",
  mode: "paper_question_qa",
  evidenceRequired: true,
  sourceCount: 4,
  hasImage: true,
  needsOcr: true,
  contradictionCount: 1,
});
assert.equal(critical.level, "critical");
assert.equal(critical.useModelPlanner, true);
assert.ok(critical.maxContinuationPasses >= 7);

console.log("AI turn risk tests passed.");
