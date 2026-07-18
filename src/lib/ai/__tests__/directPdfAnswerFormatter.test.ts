import assert from "node:assert/strict";
import { formatDirectPdfAnswer, normalizeMcqOption } from "../directPdfAnswerFormatter";

assert.equal(normalizeMcqOption("(1) NaOH 1 mol", 0), "(1) NaOH 1 mol");
assert.equal(normalizeMcqOption("1. NaOH 1 mol", 0), "(1) NaOH 1 mol");
assert.equal(normalizeMcqOption("NaOH 1 mol", 0), "(1) NaOH 1 mol");

const formatted = formatDirectPdfAnswer({
  source: { id: "sft-2025", title: "2025 Science for Technology Full SM.pdf", year: "2025" },
  year: "2025",
  questionNo: "7",
  questionType: "MCQ",
  result: {
    ok: true,
    found: true,
    sourceEvidence: {
      pageNumber: 4,
      questionText: "NaOH සහ H₂SO₄ අතර ප්‍රතික්‍රියාවේ ප්‍රතික්‍රියා තාපයට සමාන තාපයක් නිදහස් කරනුයේ,",
      options: [
        "(1) NaOH 1 mol ක් සමග H₂SO₄ සම්පූර්ණයෙන්ම ප්‍රතික්‍රියා කිරීමේ දී ය.",
        "(2) NaOH හි 1 mol dm⁻³ ද්‍රාවණයක් H₂SO₄ සමග සම්පූර්ණයෙන්ම ප්‍රතික්‍රියා කිරීමේ දී ය.",
        "(3) NaOH සහ H₂SO₄ ද්‍රාවණ දෙක සමාන සාන්ද්‍රණයකින් ප්‍රතික්‍රියා කිරීමේ දී ය.",
        "(4) H₂SO₄ 1 mol ක් සමග NaOH සම්පූර්ණයෙන්ම ප්‍රතික්‍රියා කිරීමේ දී ය.",
        "(5) H₂SO₄ ද්‍රාවණයක් NaOH සමග ප්‍රතික්‍රියා කිරීමේ දී ය.",
      ],
    },
    answer: {
      solvedAnswer: {
        optionNo: "1",
        optionText: "NaOH 1 mol ක් සමග H₂SO₄ සම්පූර්ණයෙන්ම ප්‍රතික්‍රියා කිරීමේ දී ය.",
        formulaOrRule: "2NaOH + H₂SO₄ → Na₂SO₄ + 2H₂O",
        explanationSinhala: "NaOH මවුල 1ක් H₂O මවුල 1ක් සාදයි. H₂SO₄ මවුල 1ක් H₂O මවුල 2ක් සාදන නිසා දෙගුණ තාපයක් පිටවේ.",
        whyOthersWrong: ["සාන්ද්‍රණය පමණක් දී ඇති විකල්පවල පරිමාව නොදන්නා නිසා මවුල ප්‍රමාණය තීරණය කළ නොහැක."],
      },
    },
  },
});

assert.match(formatted.markdown, /^### ප්‍රශ්නය/m);
assert.match(formatted.markdown, /\*\*\(1\)\*\* NaOH 1 mol/);
assert.doesNotMatch(formatted.markdown, /1\. \(1\)/);
assert.match(formatted.markdown, /^### පිළිතුර/m);
assert.equal(formatted.visualBlocks.some((block) => block.type === "source_evidence"), false);
assert.ok(formatted.visualBlocks.some((block) => block.type === "reaction_diagram"));
assert.ok(formatted.visualBlocks.some((block) => block.type === "comparison_bars"));
assert.doesNotMatch(formatted.markdown, /confirmed answer was not available/i);
assert.doesNotMatch(formatted.markdown, /^>\s/m, "answers must not be rendered as blue blockquotes");
assert.equal(formatted.answerStatus, "Question verified · AI-solved with syllabus evidence");

console.log("Direct PDF answer formatter tests passed.");

const essayFormatted = formatDirectPdfAnswer({
  source: { id: "guess-essay", title: "Guessing 01 Essay" },
  questionNo: "1",
  questionType: "ESSAY",
  result: {
    ok: true,
    found: true,
    sourceEvidence: {
      questionText: "1. (a) සෛලයක ව්‍යුහය පිළිබඳ පහත ප්‍රශ්නවලට පිළිතුරු සපයන්න.\n(i) කොටස නම් කරන්න.",
      options: null,
    },
    answer: {
      solvedAnswer: {
        answerMarkdownSinhala: "**(a) (i)** නිවැරදි පිළිතුර මෙහි ලියන්න.\n\nමෙය → → නොව එක් ඊතලයකින් පෙන්විය යුතුය.",
        keyPoints: ["නිවැරදි කරුණ"],
        confidence: 0.9,
      },
    },
  },
});
assert.match(essayFormatted.markdown, /^### පිළිතුර/m);
assert.match(essayFormatted.markdown, /\*\*\(a\) \(i\)\*\*/);
assert.doesNotMatch(essayFormatted.markdown, /→\s*→/);
assert.doesNotMatch(essayFormatted.markdown, /Question verified ·/);


const outsideScope = formatDirectPdfAnswer({
  source: { id: "guess-essay", title: "Guessing 01 Essay" },
  questionNo: "1",
  questionType: "ESSAY",
  result: {
    ok: true,
    found: true,
    sourceEvidence: { questionText: "1. නිල SFT විෂය නිර්දේශයෙන් පිටත කරුණක් පැහැදිලි කරන්න.", options: null },
    answer: {
      solvedAnswer: {
        answerMarkdownSinhala: "මෙම ප්‍රශ්නය නිල SFT විෂය නිර්දේශයට අයත් බව සනාථ කරගත නොහැකි නිසා පිළිතුරක් අනුමාන කරන්නේ නැහැ.",
        keyPoints: [],
        confidence: 0.5,
        scopeStatus: "out_of_syllabus",
        answerStatus: "unknown",
      },
    },
  },
});
assert.equal(outsideScope.answerStatus, "Question verified · outside confirmed syllabus scope");
assert.doesNotMatch(outsideScope.markdown, /^### පිළිතුර/m);
assert.match(outsideScope.markdown, /^### පැහැදිලි කිරීම/m);
