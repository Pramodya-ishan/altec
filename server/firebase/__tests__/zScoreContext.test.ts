import assert from "node:assert/strict";
import { mergeZScoreHistory, pickLatestZScoreEntry } from "../zScoreContext";

const merged = mergeZScoreHistory(
  [{ date: "2026-07-10", zScore: 1.1, calculationBasis: "exam_score_predictor" }],
  [{ date: "2026-07-10T12:00:00Z", zScore: 1.5, calculationBasis: "actual_saved_paper_marks" }],
  [{ date: "2026-07-11", overall: 1.2, source: "exam_score_predictor" }],
);
assert.equal(merged.length, 3, "actual and predictor timelines may coexist without erasing history");
const latest = pickLatestZScoreEntry(merged);
assert.equal(latest?.overall, 1.5, "latest user-facing value prefers real saved-paper history over predictor history");
assert.equal(latest?.source, "actual_saved_paper_marks");
console.log("z-score context tests passed");
