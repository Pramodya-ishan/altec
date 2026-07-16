import assert from "node:assert/strict";
import { analyseLearningAttempt, buildRevisionPlan, calculateMasteryScore, gradeAnswer } from "../learningEngine";

const wrong = analyseLearningAttempt({
  subject: "SFT",
  lesson: "තරල",
  questionType: "Calculation",
  correct: false,
  confidence: 0.9,
  responseTimeMs: 1800,
  expectedUnit: "m s-1",
  submittedUnit: "m",
  previousErrorCount: 2,
  now: new Date("2026-07-16T00:00:00.000Z"),
});
assert.equal(wrong.guessed, true);
assert.ok(wrong.mistakeTypes.includes("unit_conversion"));
assert.ok(wrong.intervalDays >= 1);

const mastery = calculateMasteryScore([
  { subject: "SFT", lesson: "තරල", correct: false, confidence: 0.8 },
  { subject: "SFT", lesson: "තරල", correct: true, confidence: 0.7 },
  { subject: "SFT", lesson: "තරල", correct: true, confidence: 0.9 },
]);
assert.ok(mastery > 50 && mastery <= 100);

const plan = buildRevisionPlan([
  { id: "1", subject: "SFT", lesson: "තරල", weaknessScore: 90, errorCount: 4, estimatedMinutes: 30 },
  { id: "2", subject: "ET", lesson: "Electrical", weaknessScore: 60, errorCount: 2, estimatedMinutes: 20 },
], { days: 3, dailyMinutes: 60, startDate: new Date("2026-07-16T00:00:00.000Z") });
assert.equal(plan.length, 3);
assert.ok(plan.every((day) => day.totalMinutes <= 60));
assert.ok(plan[0].tasks.length > 0);

const grade = gradeAnswer({
  studentAnswer: "උෂ්ණත්වය වැඩි වීමෙන් අණු අතර ආකර්ෂණ බලය දුර්වල වී පෘෂ්ඨික ආතතිය අඩු වේ.",
  markingPoints: [
    { text: "උෂ්ණත්වය වැඩි වන විට පෘෂ්ඨික ආතතිය අඩු වේ", marks: 1 },
    { text: "අණු අතර ආකර්ෂණ බල දුර්වල වේ", marks: 1, alternatives: ["සංසක්ති බල දුර්වල වේ"] },
  ],
  maxMarks: 2,
});
assert.ok(grade.awardedMarks >= 1);
assert.ok(grade.percentage >= 50);

console.log("learningEngine tests passed");
