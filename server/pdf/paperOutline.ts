import { getAdminDb } from "../firebase/admin";
import { callGeminiWithFallback } from "../ai/modelRouter";
import { isVertexAiEnabled } from "../ai/client";
import { loadPdfSourceBuffer, storageGsUri, storageObjectPath } from "./sourceBuffer";
import { normalizeSinhalaExtractedText } from "./legacySinhala";

export type PaperOutlineSection = {
  questionLabel: string;
  lesson: string;
  points: string[];
  pageNumber: number | null;
  evidence: string;
};

export type PaperOutlineResult = {
  sourceId: string;
  sourceTitle: string;
  sections: PaperOutlineSection[];
  complete: boolean;
  warning: string | null;
  extractionMethod: "indexed_text" | "pdf_vision" | "hybrid";
};

export function isPaperOutlineIntent(value: unknown) {
  const prompt = String(value || "").normalize("NFKC").toLowerCase();
  const wantsWholeDocument = /(?:full|whole|entire|සම්පූර්ණ|මුළු)\s*(?:pdf|paper|document|පත්‍ර|ප්‍රශ්න\s*පත්‍ර)/iu.test(prompt)
    || /(?:pdf|paper).*(?:all|okkoma|ඔක්කොම|සියලු)/iu.test(prompt);
  const wantsMapping = /(?:lesson|පාඩම|unit|topic).*(?:point|කරුණු|subtopic|කොටස්|name|නම)/iu.test(prompt)
    || /(?:point|කරුණු|subtopic).*(?:lesson|පාඩම|unit|topic)/iu.test(prompt)
    || /lesson\s*name.*point\s*name/iu.test(prompt);
  return wantsWholeDocument && wantsMapping;
}

function parseJson(value: string) {
  const clean = String(value || "").trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("Paper outline model returned invalid JSON.");
  }
}

function cleanText(value: unknown, limit: number) {
  const normalized = normalizeSinhalaExtractedText(String(value || ""));
  const text = normalized.normalizedText || (normalized.textEncoding === "native_english" ? normalized.rawText : "");
  return text.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function normalizeOutline(value: any, sourceId: string, sourceTitle: string, extractionMethod: PaperOutlineResult["extractionMethod"]): PaperOutlineResult {
  const sections = (Array.isArray(value?.sections) ? value.sections : [])
    .map((section: any, index: number) => {
      const lesson = cleanText(section?.lesson, 160);
      const points = (Array.isArray(section?.points) ? section.points : [])
        .map((point: unknown) => cleanText(point, 180))
        .filter(Boolean)
        .slice(0, 12);
      return {
        questionLabel: cleanText(section?.questionLabel || `Q${index + 1}`, 40),
        lesson,
        points,
        pageNumber: Number.isFinite(Number(section?.pageNumber)) ? Math.max(1, Number(section.pageNumber)) : null,
        evidence: cleanText(section?.evidence, 260),
      };
    })
    .filter((section: PaperOutlineSection) => section.lesson && section.points.length > 0)
    .slice(0, 80);

  if (sections.length === 0) throw new Error("No verified lesson/point mapping was extracted from the selected paper.");
  return {
    sourceId,
    sourceTitle,
    sections,
    complete: value?.complete === true,
    warning: cleanText(value?.warning, 300) || null,
    extractionMethod,
  };
}

export async function analyzeSelectedPaperOutline(params: {
  uid: string;
  source: Record<string, any>;
  prompt: string;
}): Promise<PaperOutlineResult> {
  const sourceId = String(params.source.id || params.source.sourceId || "").trim();
  const sourceTitle = String(params.source.title || params.source.fileName || "Selected PDF").trim();
  if (!sourceId) throw new Error("Selected PDF has no source ID.");

  const db = getAdminDb();
  const cacheRef = db.collection("pdf_outline_cache").doc(sourceId);
  const cached = await cacheRef.get().catch(() => null);
  const cachedData = cached?.exists ? cached.data() : null;
  if (cachedData?.outlineVersion === 2 && cachedData?.complete === true && Array.isArray(cachedData?.sections) && cachedData.sections.length > 0) {
    return normalizeOutline(cachedData, sourceId, sourceTitle, cachedData.extractionMethod || "indexed_text");
  }

  const chunksSnapshot = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get().catch(() => null);
  const indexedText = (chunksSnapshot?.docs || [])
    .map((document: any) => document.data())
    .filter((chunk: any) => String(chunk?.text || "").trim())
    .sort((left: any, right: any) => Number(left.pageNumber || 0) - Number(right.pageNumber || 0)
      || Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0))
    .map((chunk: any) => `[Page ${chunk.pageNumber || "?"}]\n${String(chunk.text || "")}`)
    .join("\n\n")
    .slice(0, 100_000);
  const indexedQuality = normalizeSinhalaExtractedText(indexedText);
  const usableIndexedText = indexedQuality.normalizedText.trim().length >= 300
    ? indexedQuality.normalizedText.slice(0, 100_000)
    : "";

  let pdfPart: any = null;
  let hasPdfVision = false;
  const path = storageObjectPath(params.source.storagePath);
  if (path) {
    const loaded = await loadPdfSourceBuffer({ source: params.source, storagePath: path });
    const uri = isVertexAiEnabled() ? storageGsUri(params.source.storagePath, path) : "";
    if (uri) {
      pdfPart = { fileData: { mimeType: "application/pdf", fileUri: uri } };
      hasPdfVision = true;
    } else if (loaded.buffer.length <= 20 * 1024 * 1024) {
      pdfPart = { inlineData: { mimeType: "application/pdf", data: loaded.buffer.toString("base64") } };
      hasPdfVision = true;
    }
  }

  if (!usableIndexedText && !pdfPart) {
    throw new Error("The selected PDF has neither a usable index nor a document-vision input.");
  }

  const parts: any[] = [];
  if (pdfPart) parts.push(pdfPart);
  parts.push({
    text: `Selected source: ${sourceTitle}\n\nUser request: ${params.prompt}\n\nIndexed page text (may be incomplete; verify against the attached PDF when present):\n${usableIndexedText || "No trustworthy text index. Use the attached PDF visually."}`,
  });

  const systemInstruction = `You are mapping one locked Sri Lankan A/L Technology question paper.

Read the COMPLETE selected paper, not just one question. For every main question and every visible A/B/C or numbered section:
- identify the SFT/ET/ICT syllabus lesson name in natural Sinhala Unicode;
- list the exact concepts/skills tested as short point names;
- preserve the paper's question label and page number;
- include a short evidence phrase from the question, paraphrased if copyright-sensitive;
- never copy legacy-font gibberish into the output;
- never invent a lesson when the question is unreadable: use lesson "කියවීමට නොහැක" and explain in warning;
- do not answer the questions;
- do not stop after Q1 or the currently selected question.

Return JSON only:
{
  "complete": true|false,
  "warning": string|null,
  "sections": [
    {"questionLabel":"Q1(A)","lesson":"පාඩමේ නම","points":["කරුණ 1","කරුණ 2"],"pageNumber":1,"evidence":"short identifying phrase"}
  ]
}`;
  const extractionMethod: PaperOutlineResult["extractionMethod"] = hasPdfVision && usableIndexedText
    ? "hybrid"
    : hasPdfVision
      ? "pdf_vision"
      : "indexed_text";
  let outline: PaperOutlineResult | null = null;
  let previousOutput = "";
  let lastError: unknown = null;
  for (const task of ["direct_pdf_extract", "final_answer"] as const) {
    const requestParts = previousOutput
      ? [...parts, {
        text: `The previous mapping was incomplete or invalid. Return one COMPLETE replacement JSON object covering the entire paper. Do not continue from the middle and do not omit sections already mapped. Previous output for diagnosis:\n${previousOutput.slice(0, 60_000)}`,
      }]
      : parts;
    try {
      const { result: response } = await callGeminiWithFallback(task, {
        model: "ignored",
        contents: [{ role: "user", parts: requestParts }],
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 16_384,
          systemInstruction,
        },
      });
      previousOutput = response.text || "";
      const parsed = parseJson(previousOutput);
      outline = normalizeOutline(parsed, sourceId, sourceTitle, extractionMethod);
      if (outline.complete) break;
      lastError = new Error(outline.warning || "Paper mapping was incomplete.");
    } catch (error) {
      lastError = error;
    }
  }

  if (!outline) throw lastError || new Error("The complete paper mapping could not be generated.");
  if (outline.complete) {
    await cacheRef.set({
      ...outline,
      outlineVersion: 2,
      ownerUid: params.uid,
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => undefined);
  }
  return outline;
}

export function formatPaperOutlineMarkdown(outline: PaperOutlineResult) {
  const cell = (value: unknown) => String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  const rows = outline.sections.map((section) => {
    const points = cell(section.points.join("; "));
    const page = section.pageNumber ? String(section.pageNumber) : "—";
    return `| ${cell(section.questionLabel)} | ${cell(section.lesson)} | ${points} | ${page} |`;
  });
  const warning = outline.complete
    ? ""
    : `\n\n> සටහන: ${outline.warning || "PDF එකේ කොටසක් පැහැදිලිව කියවීමට නොහැකි නිසා mapping එක අසම්පූර්ණයි."}`;
  return `### ${outline.sourceTitle} — පාඩම් සහ කරුණු mapping\n\n| ප්‍රශ්නය | පාඩම | අසන ප්‍රධාන කරුණු | පිටුව |\n|---|---|---|---:|\n${rows.join("\n")}${warning}`;
}
