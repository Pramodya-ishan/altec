import assert from "node:assert/strict";
import { buildMistakeReviewUpdate, isMistakeDue } from "../mistakeStore";

const now = new Date("2026-07-19T00:00:00.000Z");
const firstSuccess = buildMistakeReviewUpdate({ masteryScore: 20, correctStreak: 0, intervalDays: 0 }, 5, now);
assert.equal(firstSuccess.correctStreak, 1);
assert.equal(firstSuccess.intervalDays, 1);
assert.ok(firstSuccess.masteryScore > 20);
assert.equal(isMistakeDue(firstSuccess, now.getTime()), false);

const failure = buildMistakeReviewUpdate({ masteryScore: 70, correctStreak: 2, intervalDays: 3, repeatCount: 1 }, 1, now);
assert.equal(failure.correctStreak, 0);
assert.ok(failure.masteryScore < 70);
assert.equal(failure.repeatCount, 2);

console.log("Mistake scheduling tests passed.");
