import crypto from "node:crypto";

export type DetectedSubject = "SFT" | "ET" | "ICT" | "UNKNOWN";
export type DetectedMedium = "Sinhala" | "English" | "Mixed" | "Unknown";
export type DetectedPaperKind =
  | "past_paper"
  | "model_paper"
  | "marking_scheme"
  | "syllabus"
  | "lesson_note"
  | "question_bank"
  | "unknown";
export type DetectedQuestionType =
  "MCQ" | "Structured" | "Essay" | "Mixed" | "Unknown";

export interface DocumentMetadataInput {
  fileName?: string | null;
  title?: string | null;
  subject?: string | null;
  year?: string | number | null;
  resourceType?: string | null;
  text?: string | null;
}

export interface DocumentMetadataResult {
  cleanedTitle: string;
  subject: DetectedSubject;
  year: string | null;
  medium: DetectedMedium;
  paperKind: DetectedPaperKind;
  questionType: DetectedQuestionType;
  teacherName: string | null;
  confidence: number;
  evidence: string[];
  warnings: string[];
}

export interface DocumentPageQualityInput {
  pageNumber?: number;
  text?: string | null;
  conversionConfidence?: number | null;
}

export interface DocumentQualityInput {
  buffer: Buffer;
  text?: string | null;
  pages?: DocumentPageQualityInput[];
  ocrConfidence?: number | null;
}

export interface DocumentQualityReport {
  fileFingerprint: string;
  fileSizeBytes: number;
  validPdfHeader: boolean;
  hasEofMarker: boolean;
  pageCount: number;
  nonEmptyPageCount: number;
  textLength: number;
  averageCharactersPerPage: number;
  unicodeSinhalaRatio: number;
  replacementCharacterRatio: number;
  controlCharacterRatio: number;
  ocrConfidence: number;
  completenessScore: number;
  corruptionRisk: "low" | "medium" | "high";
  needsHumanReview: boolean;
  lowConfidencePages: number[];
  warnings: string[];
}

const clamp01 = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function normalize(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanupResourceTitle(value: unknown): string {
  const withoutExtension = normalize(value)
    .replace(/\.(pdf|docx?|pptx?|txt|jpg|jpeg|png)$/i, "")
    .replace(/\b(?:copy|final|new|edited|scan|scanned|compressed)\b/gi, "")
    .replace(/\b[0-9a-f]{16,}\b/gi, "")
    .replace(/[()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutExtension || "Untitled resource";
}

function detectSubject(
  combined: string,
  explicit?: string | null,
): DetectedSubject {
  const explicitNormalized = normalize(explicit).toUpperCase();
  if (["SFT", "ET", "ICT"].includes(explicitNormalized))
    return explicitNormalized as DetectedSubject;

  const value = combined.toLowerCase();
  if (
    /\b(?:sft|science for technology|67\s*s)\b/i.test(combined) ||
    value.includes("තාක්ෂණවේදය සඳහා විද්‍යාව")
  )
    return "SFT";
  if (
    /\b(?:engineering technology|et|65\s*e)\b/i.test(combined) ||
    value.includes("ඉංජිනේරු තාක්ෂණවේදය")
  )
    return "ET";
  if (
    /\b(?:ict|information and communication technology|66\s*i)\b/i.test(
      combined,
    ) ||
    value.includes("තොරතුරු හා සන්නිවේදන තාක්ෂණය")
  )
    return "ICT";
  return "UNKNOWN";
}

function detectYear(
  combined: string,
  explicit?: string | number | null,
): string | null {
  const explicitYear = String(explicit || "").match(/\b(20\d{2})\b/)?.[1];
  if (explicitYear) return explicitYear;
  return combined.match(/\b(20\d{2})\b/)?.[1] || null;
}

function detectMedium(text: string): DetectedMedium {
  if (!text.trim()) return "Unknown";
  const letters = [...text].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return "Unknown";
  const sinhala = letters.filter((char) =>
    /[\u0D80-\u0DFF]/u.test(char),
  ).length;
  const latin = letters.filter((char) => /[A-Za-z]/.test(char)).length;
  const siRatio = sinhala / letters.length;
  const enRatio = latin / letters.length;
  if (siRatio >= 0.55 && enRatio < 0.25) return "Sinhala";
  if (enRatio >= 0.55 && siRatio < 0.25) return "English";
  if (siRatio >= 0.15 && enRatio >= 0.15) return "Mixed";
  return siRatio > enRatio
    ? "Sinhala"
    : enRatio > siRatio
      ? "English"
      : "Unknown";
}

function detectPaperKind(
  combined: string,
  resourceType?: string | null,
): DetectedPaperKind {
  const value = combined.toLowerCase();
  const explicit = normalize(resourceType).toLowerCase();
  if (
    /marking\s*scheme|answer\s*scheme|scheme|පිළිතුරු\s*පත්‍ර|ලකුණු\s*දීමේ/.test(
      value,
    ) ||
    explicit.includes("marking")
  )
    return "marking_scheme";
  if (/syllabus|විෂය\s*නිර්දේශ/.test(value) || explicit.includes("syllabus"))
    return "syllabus";
  if (
    /model\s*paper|guess\s*paper|අනුමාන\s*ප්‍රශ්න|ආදර්ශ\s*ප්‍රශ්න/.test(
      value,
    ) ||
    explicit.includes("model")
  )
    return "model_paper";
  if (
    /question\s*bank|mcq\s*bank|ප්‍රශ්න\s*බැංකු/.test(value) ||
    explicit.includes("question_bank")
  )
    return "question_bank";
  if (
    /past\s*paper|g\.c\.e|advanced\s*level|අධ්‍යයන\s*පොදු\s*සහතික|විභාගය/.test(
      value,
    ) ||
    explicit.includes("past_paper")
  )
    return "past_paper";
  if (
    /lesson|note|tutorial|tute|පාඩම|සටහන්/.test(value) ||
    explicit.includes("note")
  )
    return "lesson_note";
  return "unknown";
}

function detectQuestionType(text: string): DetectedQuestionType {
  const value = text.toLowerCase();
  const hasMcq =
    /\(1\)[\s\S]{0,500}\(2\)/.test(text) ||
    /\bmcq\b/.test(value) ||
    /බහුවරණ/.test(value);
  const hasStructured = /structured|ව්‍යුහගත|කෙටි\s*පිළිතුරු/.test(value);
  const hasEssay = /essay|රචනා|b\s*කොටස|c\s*කොටස|d\s*කොටස/.test(value);
  const matches = [hasMcq, hasStructured, hasEssay].filter(Boolean).length;
  if (matches > 1) return "Mixed";
  if (hasMcq) return "MCQ";
  if (hasStructured) return "Structured";
  if (hasEssay) return "Essay";
  return "Unknown";
}

function detectTeacherName(combined: string): string | null {
  const patterns = [
    /(?:teacher|sir|miss|mr\.?|mrs\.?)\s*[:\-]?\s*([A-Z][A-Za-z .]{2,50})/i,
    /(?:ගුරු|සර්|මිස්|මහතා|මහත්මිය)\s*[:\-]?\s*([\u0D80-\u0DFFA-Za-z .]{2,50})/u,
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern)?.[1]?.trim();
    if (match) return match.replace(/\s+/g, " ").slice(0, 60);
  }
  return null;
}

export function classifyDocumentMetadata(
  input: DocumentMetadataInput,
): DocumentMetadataResult {
  const cleanedTitle = cleanupResourceTitle(input.title || input.fileName);
  const textSample = normalize(input.text).slice(0, 20_000);
  const combined = normalize(
    [
      input.fileName,
      input.title,
      input.resourceType,
      input.subject,
      input.year,
      textSample,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const evidence: string[] = [];
  const warnings: string[] = [];

  const subject = detectSubject(combined, input.subject);
  const year = detectYear(combined, input.year);
  const medium = detectMedium(textSample || combined);
  const paperKind = detectPaperKind(combined, input.resourceType);
  const questionType = detectQuestionType(textSample || combined);
  const teacherName = detectTeacherName(combined);

  if (subject !== "UNKNOWN") evidence.push(`subject:${subject}`);
  else warnings.push("Subject could not be detected confidently.");
  if (year) evidence.push(`year:${year}`);
  else warnings.push("Exam/resource year could not be detected.");
  if (medium !== "Unknown") evidence.push(`medium:${medium}`);
  if (paperKind !== "unknown") evidence.push(`resource:${paperKind}`);
  if (questionType !== "Unknown") evidence.push(`questionType:${questionType}`);
  if (teacherName) evidence.push(`teacher:${teacherName}`);

  const detectedFields = [
    subject !== "UNKNOWN",
    Boolean(year),
    medium !== "Unknown",
    paperKind !== "unknown",
    questionType !== "Unknown",
  ];
  const confidence = clamp01(
    0.2 +
      detectedFields.filter(Boolean).length * 0.15 +
      (textSample.length > 300 ? 0.05 : 0),
  );

  return {
    cleanedTitle,
    subject,
    year,
    medium,
    paperKind,
    questionType,
    teacherName,
    confidence,
    evidence,
    warnings,
  };
}

export function calculateDocumentQuality(
  input: DocumentQualityInput,
): DocumentQualityReport {
  const buffer = input.buffer;
  const pages = input.pages || [];
  const text = String(
    input.text || pages.map((page) => page.text || "").join("\n\n"),
  );
  const pageCount = pages.length;
  const nonEmptyPageCount = pages.filter(
    (page) => String(page.text || "").trim().length >= 20,
  ).length;
  const textLength = text.length;
  const averageCharactersPerPage =
    pageCount > 0 ? Math.round(textLength / pageCount) : textLength;
  const validPdfHeader = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const hasEofMarker = buffer
    .subarray(Math.max(0, buffer.length - 2048))
    .toString("latin1")
    .includes("%%EOF");
  const unicodeSinhalaCount = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  const controlCount = (
    text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []
  ).length;
  const unicodeSinhalaRatio =
    textLength > 0 ? unicodeSinhalaCount / textLength : 0;
  const replacementCharacterRatio =
    textLength > 0 ? replacementCount / textLength : 0;
  const controlCharacterRatio = textLength > 0 ? controlCount / textLength : 0;
  const ocrConfidence = clamp01(Number(input.ocrConfidence ?? 1));
  const lowConfidencePages = pages
    .filter((page) => {
      const pageText = String(page.text || "").trim();
      const confidence =
        page.conversionConfidence == null
          ? ocrConfidence
          : clamp01(Number(page.conversionConfidence));
      return pageText.length < 40 || confidence < 0.72;
    })
    .map((page, index) => Number(page.pageNumber || index + 1));

  const pageCoverage =
    pageCount > 0 ? nonEmptyPageCount / pageCount : textLength > 100 ? 1 : 0;
  const textDensity = clamp01(averageCharactersPerPage / 900);
  const characterHealth = clamp01(
    1 - replacementCharacterRatio * 8 - controlCharacterRatio * 12,
  );
  const structureHealth = (validPdfHeader ? 0.6 : 0) + (hasEofMarker ? 0.4 : 0);
  const completenessScore = clamp01(
    pageCoverage * 0.3 +
      textDensity * 0.2 +
      characterHealth * 0.2 +
      ocrConfidence * 0.2 +
      structureHealth * 0.1,
  );

  const warnings: string[] = [];
  if (!validPdfHeader)
    warnings.push("File header is not a valid PDF signature.");
  if (!hasEofMarker)
    warnings.push("PDF EOF marker was not found; the file may be truncated.");
  if (pageCount === 0) warnings.push("No pages were extracted.");
  if (pageCoverage < 0.7)
    warnings.push(
      "A significant number of pages contain little or no searchable text.",
    );
  if (replacementCharacterRatio > 0.02)
    warnings.push("Extracted text contains many replacement characters.");
  if (ocrConfidence < 0.75)
    warnings.push("OCR confidence is low and should be reviewed.");
  if (lowConfidencePages.length > 0)
    warnings.push(
      `${lowConfidencePages.length} page(s) require OCR/text review.`,
    );

  const corruptionRisk: DocumentQualityReport["corruptionRisk"] =
    !validPdfHeader || completenessScore < 0.35
      ? "high"
      : !hasEofMarker || completenessScore < 0.68
        ? "medium"
        : "low";

  return {
    fileFingerprint: crypto.createHash("sha256").update(buffer).digest("hex"),
    fileSizeBytes: buffer.length,
    validPdfHeader,
    hasEofMarker,
    pageCount,
    nonEmptyPageCount,
    textLength,
    averageCharactersPerPage,
    unicodeSinhalaRatio,
    replacementCharacterRatio,
    controlCharacterRatio,
    ocrConfidence,
    completenessScore,
    corruptionRisk,
    needsHumanReview:
      corruptionRisk !== "low" ||
      lowConfidencePages.length > 0 ||
      ocrConfidence < 0.75,
    lowConfidencePages,
    warnings,
  };
}

export function calculateTextOnlyQuality(params: {
  text: string;
  pages?: DocumentPageQualityInput[];
  ocrConfidence?: number | null;
  fingerprintSeed?: string;
}): DocumentQualityReport {
  const syntheticPdf = Buffer.from(`%PDF-1.7\n${params.fingerprintSeed || "text-only-finalization"}\n%%EOF`);
  const report = calculateDocumentQuality({
    buffer: syntheticPdf,
    text: params.text,
    pages: params.pages,
    ocrConfidence: params.ocrConfidence,
  });
  return {
    ...report,
    fileFingerprint: crypto.createHash("sha256").update(params.fingerprintSeed || "").update(params.text).digest("hex"),
    warnings: [
      ...report.warnings,
      "Original source buffer was unavailable during background finalization; duplicate fingerprint is text-derived.",
    ],
  };
}
