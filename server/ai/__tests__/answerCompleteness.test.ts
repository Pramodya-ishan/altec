import assert from "node:assert/strict";
import {
  assessAnswerCompleteness,
  extractRequestedSubparts,
  getModelFinishReason,
  mergeContinuationText,
  continuationMadeMeaningfulProgress,
} from "../answerCompleteness";

assert.deepEqual(
  extractRequestedSubparts("(A) ප්‍රශ්නය (i) එක (ii) දෙක\n(B) කොටස (i) තුන"),
  ["A", "A.I", "A.II", "B", "B.I"],
);

const maxTokens = assessAnswerCompleteness({
  prompt: "විස්තර කරන්න",
  answer: "මෙය තවදුරටත් පැහැදිලි කිරීමට",
  finishReason: "MAX_TOKENS",
});
assert.equal(maxTokens.complete, false);
assert.equal(maxTokens.shouldContinue, true);
assert.ok(maxTokens.reasons.includes("MAX_TOKENS"));

const missing = assessAnswerCompleteness({
  prompt: "(i) බර සොයන්න. (ii) ප්‍රතික්‍රියාව සොයන්න.",
  answer: "(i) බර $100\\,\\mathrm{N}$ වේ.",
  finishReason: "STOP",
  mode: "paper_question_qa",
});
assert.equal(missing.complete, false);
assert.deepEqual(missing.missingSubparts, ["II"]);

const complete = assessAnswerCompleteness({
  prompt: "(i) බර සොයන්න. (ii) ප්‍රතික්‍රියාව සොයන්න.",
  answer: "(i) බර $100\\,\\mathrm{N}$ වේ.\n\n(ii) ප්‍රතික්‍රියාව $50\\,\\mathrm{N}$ වේ.",
  finishReason: "STOP",
});
assert.equal(complete.complete, true);

assert.equal(assessAnswerCompleteness({
  prompt: "ගණනය කරන්න",
  answer: "අගය $F = 100\\,\\mathrm{N}",
  finishReason: "STOP",
}).complete, false, "unclosed inline math must trigger completion recovery");

const blocked = assessAnswerCompleteness({
  prompt: "විස්තර කරන්න",
  answer: "කොටසක්",
  finishReason: "SAFETY",
});
assert.equal(blocked.complete, false);
assert.equal(blocked.shouldContinue, false);

assert.equal(
  mergeContinuationText("පළමු කොටස අවසන්. එකම වාක්‍යය", "එකම වාක්‍යය සම්පූර්ණ වේ."),
  "පළමු කොටස අවසන්. එකම වාක්‍යය සම්පූර්ණ වේ.",
);


assert.deepEqual(
  new Set(extractRequestedSubparts("i) පළමු කොටස\nii. දෙවන කොටස\n(iii) තුන්වන කොටස")),
  new Set(["I", "II", "III"]),
);

const semanticMerge = mergeContinuationText(
  "පළමු පියවර අවසන්.\n\nදෙවන පියවරේ සූත්‍රය යොදමු.",
  "දෙවන පියවරේ  සූත්‍රය යොදමු!\n\nඒ අනුව අවසාන අගය 20 N වේ.",
);
assert.equal((semanticMerge.match(/දෙවන පියවරේ/gu) || []).length, 1);
assert.equal(continuationMadeMeaningfulProgress("පිළිතුර අවසන්.", "පිළිතුර අවසන්."), false);
assert.equal(continuationMadeMeaningfulProgress("පළමු කොටස.", "පළමු කොටස.\n\nදෙවන කොටස සම්පූර්ණයි."), true);

assert.equal(getModelFinishReason({ candidates: [{ finishReason: "MAX_TOKENS" }] }), "MAX_TOKENS");

console.log("AI answer completeness tests passed.");
