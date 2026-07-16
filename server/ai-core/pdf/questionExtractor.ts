import { normalizeSinhalaUnicode } from "../../../shared/text/assistantText";

export type IndexedPaperChunk = {
  text?: string;
  pageNumber?: number | string | null;
  chunkIndex?: number | string | null;
  questionNo?: string | number | null;
};

export type ExtractedPaperQuestion = {
  found: boolean;
  questionNo: string;
  pageNumber: number | null;
  questionText: string | null;
  options: string[];
  rawBlock: string | null;
  scanTextLength: number;
  reason: string;
};

function normalizeQuestionNo(value: unknown): string {
  const match = String(value ?? "").match(/\d{1,3}/);
  return match?.[0] ? String(Number(match[0])) : "";
}

function cleanOcrText(value: unknown): string {
  return normalizeSinhalaUnicode(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B\u2060]/g, "")
    // A Sinhala word cannot legitimately start with an orphan virama. OCR
    // occasionally emits this before the first consonant (for example ්ප්‍ර...).
    .replace(/(^|[\s\n])\u0DCA+(?=[\u0D80-\u0DFF])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mergeWithOverlap(current: string, next: string): string {
  if (!current) return next;
  if (!next) return current;
  if (current.includes(next)) return current;
  if (next.includes(current)) return next;

  const max = Math.min(260, current.length, next.length);
  for (let overlap = max; overlap >= 24; overlap -= 1) {
    if (current.slice(-overlap) === next.slice(0, overlap)) {
      return `${current}${next.slice(overlap)}`;
    }
  }
  return `${current}\n${next}`;
}

export function rebuildFullPaperText(chunks: IndexedPaperChunk[]): Array<{ pageNumber: number | null; text: string }> {
  const ordered = [...chunks]
    .filter((chunk) => String(chunk?.text || "").trim().length > 0)
    .sort((a, b) => {
      const pageA = Number(a.pageNumber || 0);
      const pageB = Number(b.pageNumber || 0);
      if (pageA !== pageB) return pageA - pageB;
      return Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0);
    });

  const pages = new Map<string, { pageNumber: number | null; text: string }>();
  for (const chunk of ordered) {
    const numericPage = Number(chunk.pageNumber || 0);
    const pageNumber = Number.isFinite(numericPage) && numericPage > 0 ? numericPage : null;
    const key = pageNumber === null ? "unknown" : String(pageNumber);
    const text = cleanOcrText(chunk.text);
    if (!text) continue;
    const existing = pages.get(key);
    pages.set(key, {
      pageNumber,
      text: existing ? mergeWithOverlap(existing.text, text) : text,
    });
  }

  return [...pages.values()].sort((a, b) => Number(a.pageNumber || 0) - Number(b.pageNumber || 0));
}

function markerPatterns(questionNo: string): RegExp[] {
  const escaped = questionNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    new RegExp(`(?:^|\\n)\\s*(?:Q(?:uestion)?|MCQ)\\s*0*${escaped}\\s*(?:[.):-]|$)`, "i"),
    new RegExp(`(?:^|\\n)\\s*0*${escaped}\\s*[.]\\s+`, "i"),
    new RegExp(`(?:^|\\n)\\s*0*${escaped}\\s*[)]\\s+(?=[^\\n]{8,})`, "i"),
    new RegExp(`(?:^|\\n)\\s*(?:ප්‍රශ්නය|ප්රශ්නය)\\s*0*${escaped}\\s*(?:[.):-]|$)`, "i"),
  ];
}

function findMarker(text: string, questionNo: string, from = 0): { index: number; length: number } | null {
  let best: { index: number; length: number } | null = null;
  const slice = text.slice(from);
  for (const pattern of markerPatterns(questionNo)) {
    const match = pattern.exec(slice);
    if (!match) continue;
    const index = from + match.index + (match[0].startsWith("\n") ? 1 : 0);
    const length = match[0].length - (match[0].startsWith("\n") ? 1 : 0);
    if (!best || index < best.index) best = { index, length };
  }
  return best;
}

function findNextQuestionBoundary(text: string, start: number, currentNo: number): number {
  const next = findMarker(text, String(currentNo + 1), start);
  if (next) return next.index;

  // Fallback for OCR that skipped the immediately following number. Only accept
  // a line-leading number followed by a dot, so option labels such as (1) do not
  // become false question boundaries.
  const tail = text.slice(start);
  const generic = /(?:^|\n)\s*(\d{1,3})\.\s+/g;
  let match: RegExpExecArray | null;
  while ((match = generic.exec(tail))) {
    const candidate = Number(match[1]);
    if (candidate > currentNo && candidate <= currentNo + 4) {
      return start + match.index + (match[0].startsWith("\n") ? 1 : 0);
    }
  }
  return Math.min(text.length, start + 6500);
}

function splitMcqOptions(rawBlock: string): { questionText: string; options: string[] } {
  const normalized = cleanOcrText(rawBlock);
  const optionPattern = /(?:^|\n|\s)(\([1-5]\)|[1-5]\))\s*/g;
  const matches = [...normalized.matchAll(optionPattern)];
  if (matches.length < 4) {
    return { questionText: normalized, options: [] };
  }

  // Select the first monotonically increasing 1→4/5 sequence. This avoids
  // accidentally using numbers inside formulas or diagram labels.
  let sequenceStart = -1;
  let sequence: RegExpMatchArray[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const number = Number(matches[i][1].replace(/\D/g, ""));
    if (number !== 1) continue;
    const candidate: RegExpMatchArray[] = [matches[i]];
    let expected = 2;
    for (let j = i + 1; j < matches.length && expected <= 5; j += 1) {
      const nextNumber = Number(matches[j][1].replace(/\D/g, ""));
      if (nextNumber === expected) {
        candidate.push(matches[j]);
        expected += 1;
      } else if (nextNumber === 1) {
        break;
      }
    }
    if (candidate.length >= 4) {
      sequenceStart = i;
      sequence = candidate;
      break;
    }
  }

  if (sequenceStart < 0 || sequence.length < 4) {
    return { questionText: normalized, options: [] };
  }

  const first = sequence[0];
  const firstIndex = first.index ?? 0;
  const questionText = cleanOcrText(normalized.slice(0, firstIndex));
  const options = sequence.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < sequence.length ? (sequence[index + 1].index ?? normalized.length) : normalized.length;
    const label = match[1].replace(/\D/g, "");
    return `(${label}) ${cleanOcrText(normalized.slice(start, end))}`.trim();
  }).filter((option) => option.length > 4);

  return { questionText, options };
}

export function extractQuestionFromFullPaper(
  chunks: IndexedPaperChunk[],
  requestedQuestionNo: unknown,
  questionType: unknown = "MCQ",
): ExtractedPaperQuestion {
  const questionNo = normalizeQuestionNo(requestedQuestionNo);
  if (!questionNo) {
    return {
      found: false,
      questionNo: "",
      pageNumber: null,
      questionText: null,
      options: [],
      rawBlock: null,
      scanTextLength: 0,
      reason: "QUESTION_NUMBER_MISSING",
    };
  }

  const pages = rebuildFullPaperText(chunks);
  const sections: Array<{ pageNumber: number | null; start: number; end: number; text: string }> = [];
  let fullText = "";
  for (const page of pages) {
    const prefix = fullText ? "\n\n" : "";
    const start = fullText.length + prefix.length;
    fullText += `${prefix}${page.text}`;
    sections.push({ pageNumber: page.pageNumber, start, end: fullText.length, text: page.text });
  }

  const marker = findMarker(fullText, questionNo);
  if (!marker) {
    return {
      found: false,
      questionNo,
      pageNumber: null,
      questionText: null,
      options: [],
      rawBlock: null,
      scanTextLength: fullText.length,
      reason: "QUESTION_MARKER_NOT_FOUND_IN_FULL_PAPER_SCAN",
    };
  }

  const currentNo = Number(questionNo);
  const end = findNextQuestionBoundary(fullText, marker.index + marker.length, currentNo);
  const rawBlock = cleanOcrText(fullText.slice(marker.index, end));
  const page = sections.find((section) => marker.index >= section.start && marker.index <= section.end)?.pageNumber ?? null;
  const isMcq = String(questionType || "").toLowerCase().includes("mcq");
  const parsed = isMcq ? splitMcqOptions(rawBlock) : { questionText: rawBlock, options: [] };
  const hasRequiredEvidence = parsed.questionText.length >= 12 && (!isMcq || parsed.options.length >= 4);

  return {
    found: hasRequiredEvidence,
    questionNo,
    pageNumber: page,
    questionText: hasRequiredEvidence ? parsed.questionText : null,
    options: hasRequiredEvidence ? parsed.options : [],
    rawBlock,
    scanTextLength: fullText.length,
    reason: hasRequiredEvidence ? "FULL_PAPER_OCR_SCAN_MATCH" : "QUESTION_BLOCK_INCOMPLETE_AFTER_FULL_SCAN",
  };
}
