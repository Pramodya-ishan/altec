import assert from "node:assert/strict";
import {
  inferMistakeImageMime,
  isMistakeImageFollowUp,
  isMistakeReviewIntent,
  mergeMistakeRecords,
  normalizeMistakeRecord,
  selectMistakeRecordForPrompt,
} from "../mistakeStore";

const manual = normalizeMistakeRecord("manual", {
  subject: "sft",
  lesson: "තාපය",
  errorText: "Q7 wrong",
  createdAt: "2026-07-10T10:00:00.000Z",
}, "uid");
const quiz = normalizeMistakeRecord("quiz", {
  subject: "SFT",
  lesson: "විද්‍යුතය",
  questionText: "Q12",
  updatedAt: "2026-07-12T10:00:00.000Z",
}, "uid");
const duplicateLegacy = normalizeMistakeRecord("legacy", {
  subject: "SFT",
  lesson: "තාපය",
  errorText: "Q7 wrong",
  updatedAt: "2026-07-11T10:00:00.000Z",
}, "legacy_email");

const merged = mergeMistakeRecords([manual, quiz, duplicateLegacy]);
assert.equal(merged.length, 2, "manual and quiz records must both survive; semantic duplicates are merged");
assert.equal(merged[0].lesson, "විද්‍යුතය");
assert.equal(merged[1].ownerPath, "legacy_email", "newer duplicate wins regardless of UID/email legacy path");

for (const phrase of [
  "erorrlog eka krmu",
  "error log බලමු",
  "mata wrdina dewal",
  "වැරදුණු ප්‍රශ්න ටික",
  "review my wrong answers",
]) {
  assert.equal(isMistakeReviewIntent(phrase), true, `intent should match: ${phrase}`);
}
assert.equal(isMistakeReviewIntent("2025 SFT Q7"), false);
for (const phrase of [
  "with images",
  "show the saved photos",
  "images too please",
  "give my Error Log with images",
  "රූප ටිකත් පෙන්වන්න",
  "image ekka pennanna",
]) {
  assert.equal(isMistakeImageFollowUp(phrase), true, `image follow-up should match: ${phrase}`);
}
assert.equal(isMistakeImageFollowUp("create an image of a circuit"), false);
assert.equal(inferMistakeImageMime({ imageFileName: "question.PNG" }), "image/png");
assert.equal(inferMistakeImageMime({ imageStoragePath: "mistakes/legacy-photo" }), "image/jpeg");
const force = normalizeMistakeRecord("force", { subject: "SFT", lesson: "බලය", errorText: "මේ වගේ ප්‍රශ්න බැ" }, "uid");
assert.equal(
  selectMistakeRecordForPrompt([manual, quiz, force], "mage error log eke balaya padame prshna wage prshnyk denna")?.id,
  "force",
);
const exactRecord = normalizeMistakeRecord("video-Z5Iv7KQt0YrxOxPDg7Ge", { subject: "ET", lesson: "electrical" }, "uid");
assert.equal(
  selectMistakeRecordForPrompt([force, exactRecord], "Review Error Log record video-Z5Iv7KQt0YrxOxPDg7Ge")?.id,
  exactRecord.id,
);
console.log("mistake store tests passed");
