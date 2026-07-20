import assert from "node:assert/strict";
import { defaultPredictionSettings, getSubjectPredictionProfile, mergePredictionSettings, sourceReliability } from "../predictionPolicy";
import { backtestPredictionModel } from "../backtest";
import { buildPredictionFallbackVisual, ensureVisualQuestionIntegrity } from "../predictionVisual";

assert.ok(getSubjectPredictionProfile("ET").minimumVisualsForFullPaper >= 3);
assert.equal(defaultPredictionSettings("ICT").includeGuessingPapers, false, "circular guessing evidence must be opt-in");
assert.ok(sourceReliability({ resourceType: "past_paper" }) > sourceReliability({ resourceType: "model_paper" }));
const normalized = mergePredictionSettings("SFT", {}, { weights: { syllabus: 5 }, committeeSize: 99 });
assert.equal(normalized.committeeSize, 5);
assert.ok(Math.abs(Object.values(normalized.weights).reduce((sum, value) => sum + value, 0) - 1) < 0.01);

const backtest = backtestPredictionModel({
  subject: "SFT",
  questions: [
    { year: 2021, lesson: "Force", verified: true, sourceId: "a" },
    { year: 2022, lesson: "Fluids", verified: true, sourceId: "b" },
    { year: 2023, lesson: "Force", verified: true, sourceId: "c" },
    { year: 2024, lesson: "Fluids", verified: true, sourceId: "d" },
  ],
  startYear: 2023,
  endYear: 2024,
  topK: 3,
});
assert.ok(backtest.yearsTested >= 1);
const visualQuestions = ensureVisualQuestionIntegrity([
  { questionNo: 1, requiresImage: true, visualSpec: { kind: "free_body_diagram", labels: ["W", "R", "F"] } },
  { questionNo: 2, requiresImage: true, visualSpec: { kind: "graph" } },
], 1);
assert.equal(visualQuestions[0].requiresImage, true);
assert.equal(visualQuestions[1].requiresImage, false, "visual quota must be enforced deterministically");
const fallbackImage = buildPredictionFallbackVisual(visualQuestions[0]);
assert.match(fallbackImage.url, /^data:image\/svg\+xml;base64,/);
assert.equal(fallbackImage.generatedBy, "deterministic_svg_fallback");
const sinhalaFallback = buildPredictionFallbackVisual({ questionNo: 3, visualSpec: { kind: "measurement", labels: ["ප්‍රධාන පරිමාණය", "වර්නියර් පරිමාණය"] } });
const decodedSinhalaSvg = Buffer.from(String(sinhalaFallback.url).split(",")[1], "base64").toString("utf8");
assert.match(decodedSinhalaSvg, /ප්‍රධාන පරිමාණය/, "Sinhala labels must remain Unicode in deterministic paper visuals");
assert.doesNotMatch(decodedSinhalaSvg, /#2563eb|#7c3aed|gradient/i, "fallback question visuals should remain restrained black-and-white paper diagrams");
console.log("prediction policy and backtest tests passed");
