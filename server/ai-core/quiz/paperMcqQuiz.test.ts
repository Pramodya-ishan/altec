import assert from "node:assert/strict";
import { detectPaperMcqQuizStart, parsePaperMcqQuizAction } from "./paperMcqQuiz";
import type { PaperMcqQuizSession } from "../../knowledge/conversationState";
import { formatPaperQuestionAnswer, formatPaperQuizQuestion } from "../../../shared/text/paperAnswer";

const start = detectPaperMcqQuizStart(
  "2025 sft paper eke mcq 1 idn 50 ta krmu one by one mge wrdina ewwa save kr gnn error log ekt",
  "SFT",
);
assert.deepEqual(start, {
  isQuizStart: true,
  year: "2025",
  subject: "SFT",
  startQuestionNo: 1,
  endQuestionNo: 50,
});

const session: PaperMcqQuizSession = {
  active: true,
  sourceId: "paper-2025-sft",
  year: "2025",
  subject: "SFT",
  questionType: "MCQ",
  startQuestionNo: 1,
  endQuestionNo: 50,
  currentQuestionNo: 1,
  awaitingAnswer: true,
  expectedOptionNo: "4",
  expectedOptionText: "කන්නෙලිය ය.",
  questionText: "ශ්‍රී ලංකාවේ පිහිටි නිවර්තන වැසි වනාන්තරයකට උදාහරණයක් වනුයේ,",
  options: ["රිටිගල ය.", "පිදුරුතලාගල ය.", "හන්ගල ය.", "කන්නෙලිය ය.", "හෝර්ටන් තැන්න ය."],
  explanationSinhala: "කන්නෙලිය පහතරට තෙත් කලාපයේ වැසි වනාන්තරයකි.",
  correctCount: 0,
  wrongCount: 0,
  skippedCount: 0,
  answeredCount: 0,
  startedAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
assert.deepEqual(parsePaperMcqQuizAction("4", session), { kind: "answer", optionNo: "4" });
assert.deepEqual(parsePaperMcqQuizAction("කන්නෙලිය", session), { kind: "answer", optionNo: "4" });
assert.deepEqual(parsePaperMcqQuizAction("skip", session), { kind: "skip" });
assert.deepEqual(parsePaperMcqQuizAction("stop", session), { kind: "stop" });

const quizQuestion = formatPaperQuizQuestion({
  year: "2025",
  subject: "SFT",
  questionNo: 1,
  startQuestionNo: 1,
  endQuestionNo: 50,
  questionText: session.questionText,
  options: session.options,
});
assert.match(quizQuestion, /MCQ 1\/50/);
assert.match(quizQuestion, /\(4\) කන්නෙලිය ය\./);
assert.doesNotMatch(quizQuestion, /පිළිතුර:/);
assert.doesNotMatch(quizQuestion, /නිවැරදි පිළිතුර/);

const normalAnswer = formatPaperQuestionAnswer({
  questionText: session.questionText,
  options: session.options,
  solvedAnswer: {
    optionNo: "4",
    optionText: "(4) කන්නෙලිය ය.",
    explanationSinhala: session.explanationSinhala,
  },
});
assert.match(normalAnswer, /\*\*පිළිතුර:\*\* \(4\) කන්නෙලිය ය\./);
assert.doesNotMatch(normalAnswer, /\(4\) \(4\)/);

console.log("paper MCQ quiz tests passed");
