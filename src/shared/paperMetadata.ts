export type PaperCollection = "A/L Past Papers" | "Model Papers" | "Marking Schemes";

export interface InferredPaperMetadata {
  title: string;
  fileName: string;
  year: string;
  subject: "SFT" | "ET" | "ICT";
  category: PaperCollection;
  paperType: "MCQ" | "Structured" | "Essay" | "Full Paper";
  resourceType: "past_paper" | "model_paper" | "marking_scheme";
  medium: "Sinhala" | "English" | "Tamil";
  paperNumber: string;
  confidence: number;
}

function cleanName(value: unknown) {
  return String(value || "paper.pdf")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceText(fileName: unknown, sampleText: unknown) {
  return `${cleanName(fileName)}\n${String(sampleText || "").slice(0, 16_000)}`.normalize("NFKC");
}

export function inferPaperMetadata(
  fileName: unknown,
  sampleText: unknown = "",
  fallbackSubject: unknown = "SFT",
): InferredPaperMetadata {
  const originalFileName = String(fileName || "paper.pdf").trim() || "paper.pdf";
  const source = sourceText(originalFileName, sampleText);
  const lower = source.toLowerCase();

  const year = source.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/)?.[1] || String(new Date().getFullYear());
  const subject: InferredPaperMetadata["subject"] = /\bict\b|information\s+(?:and\s+)?communication|තොරතුරු\s+හා\s+සන්නිවේදන/i.test(source)
    ? "ICT"
    : /\bet\b|engineering\s+technology|ඉංජිනේරු\s+තාක්ෂණ/i.test(source)
      ? "ET"
      : /\bsft\b|science\s+for\s+technology|තාක්ෂණවේදය\s+සඳහා\s+විද්‍යාව/i.test(source)
        ? "SFT"
        : (["SFT", "ET", "ICT"].includes(String(fallbackSubject).toUpperCase())
          ? String(fallbackSubject).toUpperCase()
          : "SFT") as InferredPaperMetadata["subject"];

  const isMarking = /marking\s*scheme|answer\s*(?:key|scheme)|model\s*answer|answers?\b|ms\b|ලකුණු\s*(?:ලබා\s*)?දීමේ\s*පටිපාටිය|පිළිතුරු\s*පත්‍ර/i.test(source);
  const isModel = /model\s*paper|guess(?:in|ing)?\s*(?:paper)?|prediction\s*paper|අනුමාන\s*ප්‍රශ්න|ආදර්ශ\s*ප්‍රශ්න/i.test(source);
  const category: PaperCollection = isMarking ? "Marking Schemes" : isModel ? "Model Papers" : "A/L Past Papers";
  const resourceType = category === "Marking Schemes" ? "marking_scheme" : category === "Model Papers" ? "model_paper" : "past_paper";

  const hasMcq = /\bmcq\b|multiple\s*choice|බහුවරණ/i.test(source);
  const hasEssay = /\bessay\b|structured\s*essay|රචනා|ව්‍යුහගත/i.test(source);
  const paperType: InferredPaperMetadata["paperType"] = hasMcq && !hasEssay ? "MCQ" : hasEssay && !hasMcq ? "Essay" : "Full Paper";
  const medium: InferredPaperMetadata["medium"] = /tamil\s*medium|தமிழ்/i.test(source)
    ? "Tamil"
    : /english\s*medium/i.test(source)
      ? "English"
      : "Sinhala";
  const paperNumber = source.match(/(?:guess(?:in|ing)?|model|paper)\s*(?:no\.?\s*)?0*(\d{1,2})/i)?.[1] || "";

  const base = cleanName(originalFileName);
  const typeLabel = paperType === "Full Paper" ? "Full Paper" : paperType;
  const categoryLabel = category === "A/L Past Papers" ? "A/L Paper" : category === "Model Papers" ? "Model Paper" : "Marking Scheme";
  const genericName = /^(?:scan|document|paper|file|untitled)(?:\s*\(\d+\))?$/i.test(base);
  const title = genericName
    ? `${year} ${subject} ${categoryLabel}${paperNumber ? ` ${paperNumber.padStart(2, "0")}` : ""} · ${typeLabel}`
    : base;

  let confidence = 0.4;
  if (/(?:19|20)\d{2}/.test(source)) confidence += 0.15;
  if (/\b(?:sft|et|ict)\b|technology/i.test(source)) confidence += 0.15;
  if (isMarking || isModel) confidence += 0.15;
  if (hasMcq || hasEssay) confidence += 0.15;

  return {
    title: title.slice(0, 180),
    fileName: originalFileName.slice(0, 180),
    year,
    subject,
    category,
    paperType,
    resourceType,
    medium,
    paperNumber,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
}
