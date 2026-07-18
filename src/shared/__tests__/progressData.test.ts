import assert from "node:assert/strict";
import {
  combineProgressSections,
  hasMeaningfulProgress,
  normalizeProgressData,
  normalizeZScoreHistory,
  splitProgressData,
} from "../progressData";

const original: any = {
  sft: { topics: { Heat: { checked: true, videos: [] } }, paperMarks: [], questionMarks: {} },
  et: { topics: {}, paperMarks: [{ title: "ET Paper", total: 70, mcq: 30, essay: 30, practical: 10, grade: "B", time: 10 }], questionMarks: {} },
  ict: { topics: {}, paperMarks: [], questionMarks: {} },
  targetZ: 2.5,
  zScoreHistory: [
    { date: "2026-07-01", zScore: 1.2, fingerprint: "a", calculationBasis: "exam_score_predictor" },
    { date: "2026-07-02", zScore: 1.3, fingerprint: "b", calculationBasis: "actual_saved_paper_marks" },
    { date: "2026-07-03", zScore: 1.4, fingerprint: "a", calculationBasis: "exam_score_predictor" },
  ],
};

const sections = splitProgressData(original);
const restored = combineProgressSections(sections);
assert.equal(restored.sft.topics.Heat.checked, true);
assert.equal(restored.et.paperMarks[0].total, 70);
assert.equal(restored.targetZ, 2.5);
assert.equal(restored.zScoreHistory?.length, 2, "history should deduplicate by fingerprint without deleting other calculation bases");
assert.equal(restored.zScoreHistory?.[1].zScore, 1.4);
assert.equal(hasMeaningfulProgress(restored), true);
assert.equal(hasMeaningfulProgress(normalizeProgressData(null)), false);

const normalizedHistory = normalizeZScoreHistory([{ date: "bad", zScore: "1.25" }]);
assert.equal(normalizedHistory.length, 1);
assert.equal(normalizedHistory[0].zScore, 1.25);
assert.ok(Number.isFinite(Date.parse(normalizedHistory[0].date)));

const compacted = normalizeProgressData({
  sft: {
    topics: {
      Heat: {
        checked: true,
        videos: [{ title: "Video", url: "https://example.com/video", base64: "x".repeat(50_000) }],
        resources: [{ title: "PDF", storagePath: "users/u/file.pdf", rawText: "x".repeat(50_000) }],
      },
    },
    paperMarks: [],
    questionMarks: {},
  },
});
assert.equal((compacted.sft.topics.Heat.videos[0] as any).base64, undefined);
assert.equal((compacted.sft.topics.Heat.resources?.[0] as any).rawText, undefined);
assert.equal(compacted.sft.topics.Heat.videos[0].url, "https://example.com/video");

console.log("Progress data regression tests passed");
