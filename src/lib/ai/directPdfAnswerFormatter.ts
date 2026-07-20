import type { VisualBlock } from "../visualBlocks";
import { stripRawVisualBlocks } from "./stripVisualBlocks";
import { normalizeSinhalaDisplayText } from "../assistantTextHygiene";

export type DirectPdfAnswerFormatterInput = {
  source: {
    id?: string;
    sourceId?: string;
    title?: string;
    fileName?: string;
    year?: string | number;
  };
  year?: string | number;
  questionNo?: string | number;
  questionType?: string;
  result: any;
};

function clean(value: unknown) {
  return normalizeSinhalaDisplayText(stripRawVisualBlocks(String(value ?? "")))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(?:→\s*){2,}/g, "→ ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeMcqOption(value: unknown, index: number) {
  const text = clean(value)
    .replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/u, "")
    .trim();
  return `(${index + 1}) ${text}`.trim();
}

function normalizeAnswerText(value: unknown, optionNo?: string | number | null) {
  const text = clean(value);
  if (!text) return "";
  if (/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/u.test(text)) return text;
  return optionNo ? `(${optionNo}) ${text}` : text;
}

function safeVisualAid(value: any): VisualBlock | null {
  if (!value || typeof value !== "object") return null;

  if (value.type === "comparison_bars" && Array.isArray(value.items)) {
    const items = value.items
      .map((item: any) => ({
        label: clean(item?.label).slice(0, 90),
        value: Number(item?.value),
        displayValue: clean(item?.displayValue).slice(0, 30) || undefined,
      }))
      .filter((item: any) => item.label && Number.isFinite(item.value) && item.value >= 0)
      .slice(0, 6);
    if (items.length >= 2) {
      return {
        type: "comparison_bars",
        title: clean(value.title || "Comparison").slice(0, 120),
        items,
        caption: clean(value.caption).slice(0, 240) || undefined,
      };
    }
  }

  if (value.type === "process_flow" && Array.isArray(value.steps)) {
    const steps = value.steps.map((step: unknown) => clean(step).slice(0, 120)).filter(Boolean).slice(0, 6);
    if (steps.length >= 2) {
      return {
        type: "process_flow",
        title: clean(value.title || "Process").slice(0, 120),
        steps,
        caption: clean(value.caption).slice(0, 240) || undefined,
      };
    }
  }

  return null;
}

function buildAutomaticVisuals(params: {
  sourceTitle: string;
  year?: string | number;
  questionNo?: string | number;
  questionType?: string;
  result: any;
  answerStatus: string;
  explanation: string;
  formulaOrRule: string;
}): VisualBlock[] {
  const { result, explanation, formulaOrRule } = params;
  const blocks: VisualBlock[] = [];

  const visualAid = safeVisualAid(result?.answer?.solvedAnswer?.visualAid);
  if (visualAid) blocks.push(visualAid);

  const imagePreviewUrl = clean(result?.sourceEvidence?.imagePreviewUrl);
  const previewSourceId = clean(result?.sourceEvidence?.sourceId || result?.sourceId);
  const previewPageNumber = Number(result?.sourceEvidence?.pageNumber) || undefined;
  const hasUsablePreviewUrl = /^(?:https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(imagePreviewUrl);
  if ((hasUsablePreviewUrl || previewSourceId) && previewPageNumber) {
    blocks.push({
      type: "pdf_image_preview",
      title: `${params.year || ""} ${params.questionType || "Question"} ${params.questionNo || ""}`.trim() || "Original PDF question",
      imageUrl: hasUsablePreviewUrl ? imagePreviewUrl : "",
      sourceId: previewSourceId,
      storagePath: clean(result?.sourceEvidence?.imagePreviewStoragePath),
      pageNumber: previewPageNumber,
      crop: result?.sourceEvidence?.questionRegion || result?.sourceEvidence?.imageRegion || null,
      caption: "Original question layout from the selected PDF — tables, graphs, diagrams, labels, and marks are preserved exactly.",
      sourceTitle: params.sourceTitle,
      questionLabel: params.questionNo ? `Question ${params.questionNo}` : undefined,
      originalLayout: true,
    });
  }

  if (formulaOrRule) {
    if (/(?:→|->|⇌|↔)/u.test(formulaOrRule)) {
      blocks.push({
        type: "reaction_diagram",
        title: "Reaction relationship",
        equation: formulaOrRule.replace(/->/g, "→"),
        caption: "Use the balanced equation and its mole ratio.",
      });
    } else {
      blocks.push({
        type: "formula_card",
        title: "Rule used",
        formula: formulaOrRule,
        variables: [],
      });
    }
  }

  const combined = `${formulaOrRule}\n${explanation}`;
  const isNeutralizationComparison = /NaOH/i.test(combined)
    && /H(?:₂|2)SO(?:₄|4)/i.test(combined)
    && /(දෙගුණ|twice|double|2\s*(?:×|x))/i.test(combined);
  if (isNeutralizationComparison && !blocks.some((block) => block.type === "comparison_bars")) {
    blocks.push({
      type: "comparison_bars",
      title: "Heat comparison",
      items: [
        { label: "NaOH 1 mol", value: 1, displayValue: "1×" },
        { label: "H₂SO₄ 1 mol", value: 2, displayValue: "2×" },
      ],
      caption: "Compare the mole ratio in the balanced reaction.",
    });
  }

  return blocks;
}

export function formatDirectPdfAnswer(input: DirectPdfAnswerFormatterInput) {
  const { source, result, questionNo, questionType } = input;
  const year = input.year || source.year;
  const sourceTitle = clean(source.title || source.fileName || "PDF source");
  const questionText = clean(result?.sourceEvidence?.questionText);
  const options = Array.isArray(result?.sourceEvidence?.options)
    ? result.sourceEvidence.options.map((option: unknown, index: number) => normalizeMcqOption(option, index))
    : [];

  const answer = result?.answer || {};
  const solvedAnswer = answer.solvedAnswer || null;
  const officialAnswer = clean(answer.officialAnswer);
  const essayAnswer = clean(solvedAnswer?.answerMarkdownSinhala);
  const explanation = clean(
    solvedAnswer?.explanationSinhala
      || answer.explanationSinhala
      || (solvedAnswer && String(solvedAnswer.scopeStatus || "in_syllabus") !== "in_syllabus"
        ? solvedAnswer.answerMarkdownSinhala
        : ""),
  );
  const whyOthersWrong = Array.isArray(solvedAnswer?.whyOthersWrong)
    ? solvedAnswer.whyOthersWrong.map(clean).filter(Boolean)
    : [];
  const formulaOrRule = clean(solvedAnswer?.formulaOrRule);

  let answerStatus = "Question verified from PDF";
  let finalAnswerText = "";
  if (officialAnswer) {
    finalAnswerText = officialAnswer;
    answerStatus = "Verified from the official marking scheme";
  } else if (solvedAnswer) {
    const scopeStatus = String(solvedAnswer.scopeStatus || "in_syllabus");
    finalAnswerText = scopeStatus === "in_syllabus"
      ? (essayAnswer || normalizeAnswerText(solvedAnswer.optionText, solvedAnswer.optionNo))
      : "";
    answerStatus = scopeStatus === "in_syllabus"
      ? "Question verified · AI-solved with syllabus evidence"
      : "Question verified · outside confirmed syllabus scope";
  } else if (answer.estimatedAnswer) {
    finalAnswerText = normalizeAnswerText(answer.estimatedAnswer, answer.estimatedOptionNo);
    answerStatus = "Question verified · AI-solved from available evidence";
  } else {
    answerStatus = "Question verified · Answer generation temporarily unavailable";
  }

  const sections: string[] = [];
  if (questionText) {
    sections.push(`### ප්‍රශ්නය\n\n${questionText}`);
  }
  if (options.length) {
    sections.push(options.map((option: string) => `**${option.match(/^\([1-5]\)/)?.[0] || ""}**${option.replace(/^\([1-5]\)/, "")}`).join("\n\n"));
  }
  if (finalAnswerText) {
    const isEssay = Boolean(essayAnswer) || /ESSAY|STRUCTURED/i.test(String(questionType || ""));
    sections.push(`### පිළිතුර\n\n${isEssay ? finalAnswerText : `**${finalAnswerText}**`}`);
  }
  if (solvedAnswer?.complete === false) {
    const missing = Array.isArray(solvedAnswer?.missingSubparts)
      ? solvedAnswer.missingSubparts.map(clean).filter(Boolean).join(", ")
      : "";
    sections.push(`> පිළිතුර සම්පූර්ණ නොවීය${missing ? `: කියවීමට නොහැකි කොටස් ${missing}` : ""}. නොපෙනෙන කොටස් අනුමාන කර නැහැ.`);
  }
  if (explanation) {
    sections.push(`### පැහැදිලි කිරීම\n\n${explanation}`);
  }
  if (whyOthersWrong.length) {
    sections.push(`### අනෙක් විකල්ප නොගැළපෙන හේතු\n\n${whyOthersWrong.map((reason: string) => `- ${reason}`).join("\n")}`);
  }

  const visualBlocks = buildAutomaticVisuals({
    sourceTitle,
    year,
    questionNo,
    questionType,
    result,
    answerStatus,
    explanation,
    formulaOrRule,
  });

  return {
    markdown: sections.join("\n\n"),
    visualBlocks,
    answerStatus,
  };
}
