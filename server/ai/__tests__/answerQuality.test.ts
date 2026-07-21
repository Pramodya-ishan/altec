import assert from "node:assert/strict";
import { buildAnswerContractInstruction, deterministicQualityReport } from "../answerQuality";

const complete = deterministicQualityReport({
  prompt: "(i) බර ගණනය කරන්න. (ii) අභිලම්භ ප්‍රතික්‍රියාව ගණනය කරන්න.",
  answer: "(i) $W = mg = 10 \\times 10 = 100\\,\\mathrm{N}$.\n\n(ii) $R = 100 - 100\\sin 60^\\circ = 13.4\\,\\mathrm{N}$.",
  mode: "paper_question_qa",
  sourceCount: 1,
});
assert.equal(complete.passed, true);
assert.equal(complete.coveragePercent, 100);

const missingUnit = deterministicQualityReport({
  prompt: "බලය ගණනය කරන්න.",
  answer: "අවසාන පිළිතුර 20 වේ.",
  mode: "tutor_explanation",
});
assert.equal(missingUnit.passed, false);
assert.ok(missingUnit.numericalChecks.some((item) => item.includes("unit")));

const evidenceMissing = deterministicQualityReport({
  prompt: "2025 official paper q1 answer",
  answer: "Q1 පිළිතුර 2 වේ.",
  mode: "paper_question_qa",
  evidenceRequired: true,
  sourceCount: 0,
});
assert.equal(evidenceMissing.passed, false);
assert.ok(evidenceMissing.citationRisks.length > 0);


const legacySinhala = deterministicQualityReport({
  prompt: "සිංහලෙන් පැහැදිලි කරන්න",
  answer: "fuu ms<s;=r ksjerÈ fkd fõ.",
  mode: "tutor_explanation",
});
assert.equal(legacySinhala.passed, false);
assert.ok(legacySinhala.factualRisks.some((item) => /legacy Sinhala|Unicode Sinhala/i.test(item)));

const contract = buildAnswerContractInstruction({ prompt: "(A) explain (i) one (ii) two", mode: "paper_question_qa", evidenceRequired: true });
assert.match(contract, /A, A\.I, A\.II/);
assert.match(contract, /Evidence is mandatory/);

console.log("Answer quality tests passed.");
