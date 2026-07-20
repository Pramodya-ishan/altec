import assert from "node:assert/strict";
import {
  extractQuestionNumberFromPrompt,
  inferQuestionTypeFromText,
  isExplicitNamedSourceRequest,
  isPaperForecastPrompt,
  parseSourceChoiceIndex,
  rankNamedSources,
  resolveLockedQuestionType,
  selectNamedSource,
  shouldUseLockedSourceForTurn,
} from "../sourceSelection";

const sources = [
  { id: "guess-mcq", title: "Guessing 01 MCQ", subject: "SFT", storagePath: "papers/guess-01-mcq.pdf", textIndexed: true },
  { id: "guess-essay", title: "Guessing 01 Essay", subject: "SFT", storagePath: "papers/guess-01-essay.pdf", textIndexed: true },
  { id: "paper-2025", title: "2025 SFT Paper", subject: "SFT", storagePath: "papers/2025.pdf", textIndexed: true },
];

const named = selectNamedSource(sources, "guessing 1 essay q1");
assert.equal(named.locked, true);
assert.equal(named.sourceId, "guess-essay");
assert.equal(extractQuestionNumberFromPrompt("guessing 1 essay q1"), "1");
assert.equal(inferQuestionTypeFromText("Guessing 01 Essay"), "ESSAY");
assert.equal(resolveLockedQuestionType({
  prompt: "q6",
  selectedQuestionType: "ESSAY",
  selectedSourceTitle: "Guessing 01 Essay",
  routedQuestionType: "MCQ",
}), "ESSAY", "the locked Essay type must beat an unrelated router default");
assert.equal(resolveLockedQuestionType({
  prompt: "mcq 6",
  selectedQuestionType: "ESSAY",
  selectedSourceTitle: "Guessing 01 Essay",
  routedQuestionType: "ESSAY",
}), "MCQ", "an explicit type in the current prompt must win");
assert.equal(parseSourceChoiceIndex("2", 3), 1);
assert.equal(parseSourceChoiceIndex("4", 3), null);
assert.deepEqual(rankNamedSources(sources, "guessing 1 essay pdf").map((item) => item.source.id)[0], "guess-essay");

assert.equal(isExplicitNamedSourceRequest("guessing 1 essay q1"), true);
assert.equal(isExplicitNamedSourceRequest("guessing papr 1 essay eke 6 weni main prshne krmu"), true);
assert.equal(selectNamedSource(sources, "guessing papr 1 essay eke 6 weni main prshne krmu").sourceId, "guess-essay");
assert.equal(selectNamedSource(sources, "guessin 01 essay q6 weni eka").sourceId, "guess-essay");
assert.equal(isExplicitNamedSourceRequest("2025 guessing 1 pdf q1"), true);
assert.equal(isExplicitNamedSourceRequest("Guessing 01 Essay"), true);
assert.equal(isPaperForecastPrompt("2026 al paper ekt enna puuluwn sankayanaya ganak denna guessing krl deep thinking"), true);
assert.equal(isExplicitNamedSourceRequest("2026 al paper ekt enna puuluwn sankayanaya ganak denna guessing krl deep thinking"), false);
assert.equal(isExplicitNamedSourceRequest("2026 paper ekt oya okkoma pdf use krl guessing denna"), false);

assert.equal(shouldUseLockedSourceForTurn("q1", "normal_chat"), true);
assert.equal(shouldUseLockedSourceForTurn("මේ PDF එකේ q1", "normal_chat"), true);
assert.equal(shouldUseLockedSourceForTurn("මේක රූපයක් සමඟ පැහැදිලි කරන්න", "continue_grounded_discussion"), false);
assert.equal(shouldUseLockedSourceForTurn("සංඛ්‍යානය ගණනක් දෙන්න", "continue_grounded_discussion"), false);
assert.equal(shouldUseLockedSourceForTurn("2026 al paper ekt enna puuluwn ganak guessing krl denna", "past_paper_analysis"), false);
assert.equal(shouldUseLockedSourceForTurn("[Uploaded PDF: test.pdf] q1", "uploaded_pdf_question_qa"), true);

console.log("Source selection tests passed.");
