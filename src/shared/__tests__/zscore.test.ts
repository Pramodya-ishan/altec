import assert from "node:assert/strict";
import {
  buildPracticeZSnapshot,
  calculateOfficialZ,
  summarizeSavedPaperMarks,
} from "../zscore";
import { buildExamScorePrediction, getEstimatedDistrictRank, getEstimatedIslandRank } from "../../lib/scoreUtils";
import { SYLLABUS } from "../../constants/syllabus";

const empty = buildPracticeZSnapshot({
  sft: { topics: { Fluids: { checked: true } }, paperMarks: [] },
  et: { topics: { Mechanics: { checked: true } }, paperMarks: [] },
  ict: { topics: { Databases: { checked: true } }, paperMarks: [] },
});
assert.equal(empty.overall, null, "lesson completion must never produce a Z estimate");
assert.equal(empty.complete, false);
assert.doesNotMatch(empty.message, /Save at least one completed paper/i);

const summary = summarizeSavedPaperMarks([
  { title: "Untitled Paper", total: 0, time: 1 },
  { title: "2024", total: 44, time: 2 },
  { title: "2025", total: 49, time: 3 },
]);
assert.equal(summary.sampleCount, 2);
assert.equal(summary.average, 47.33, "recent real paper totals should be weighted without fake zero records");

const complete = buildPracticeZSnapshot({
  sft: { paperMarks: [{ title: "SFT paper", total: 60, time: 1 }] },
  et: { paperMarks: [{ title: "ET paper", total: 55, time: 1 }] },
  ict: { paperMarks: [{ title: "ICT paper", total: 65, time: 1 }] },
});
assert.equal(complete.complete, true);
assert.equal(complete.official, false);
assert.equal(complete.calculationBasis, "actual_saved_paper_marks");
assert.equal(typeof complete.overall, "number");

assert.equal(calculateOfficialZ(70, 50, 10), 2);
assert.equal(calculateOfficialZ(70, 50, 0), null);

const completedTopics = (subject: "sft" | "et" | "ict") => {
  const definition = SYLLABUS[subject];
  const names = new Set<string>();
  definition.mcqItems.forEach((item) => names.add(item.title));
  definition.partAItems.forEach((item) => item.topics?.forEach((topic) => names.add(topic)));
  definition.partBCDItems.forEach((item) => item.topics?.forEach((topic) => names.add(topic)));
  definition.bcdGroups?.forEach((group) => group.items.forEach((item) => item.topics?.forEach((topic) => names.add(topic))));
  return Object.fromEntries([...names].map((topic) => [topic, { checked: true, videos: [] }]));
};

const predictor = buildExamScorePrediction({
  sft: { topics: completedTopics("sft"), paperMarks: [], questionMarks: {} },
  et: { topics: completedTopics("et"), paperMarks: [], questionMarks: {} },
  ict: { topics: completedTopics("ict"), paperMarks: [], questionMarks: {} },
});
assert.equal(predictor.calculationBasis, "exam_score_predictor");
assert.equal(predictor.official, false);
assert.ok(predictor.projectedMarks.sft > 0);
assert.ok(predictor.estimatedIslandRank >= 1);
assert.ok(getEstimatedIslandRank(2.2) < getEstimatedIslandRank(1.2), "higher Z should produce a better island rank");
assert.ok(getEstimatedDistrictRank(2.2) < getEstimatedDistrictRank(1.2), "higher Z should produce a better district rank");

console.log("Z-score regression tests passed");
