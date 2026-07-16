import { getAdminDb } from "../firebase/admin";
import { getSourceInventory } from "../sources/sourceInventoryService";

function numericYear(value: unknown) {
  const parsed = Number(String(value || "").match(/\b(20\d{2})\b/)?.[1] || value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compact(value: unknown, max = 260) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sourcePayload(source: any, usedInAnswer: boolean) {
  return {
    id: source.sourceId || source.id,
    sourceId: source.sourceId || source.id,
    title: source.title,
    year: source.year,
    subject: source.subject,
    resourceType: source.resourceType,
    storagePath: source.storagePath,
    downloadUrl: source.downloadUrl,
    url: source.url || source.downloadUrl || `/api/rag/sources/${source.sourceId || source.id}/download`,
    sourceType: source.resourceType,
    badge: source.resourceType === "marking_scheme"
      ? "Marking Scheme"
      : source.resourceType === "past_paper"
        ? "Past Paper"
        : source.resourceType === "syllabus"
          ? "Syllabus"
          : "Reference",
    usedInAnswer,
  };
}

export async function retrievePastPaperAnalysisEvidence(params: {
  uid: string;
  subject: "SFT" | "ET" | "ICT";
  targetYear?: string;
  isAdmin?: boolean;
}) {
  const { uid, subject, isAdmin } = params;
  const targetYear = numericYear(params.targetYear) || 2026;
  const db = getAdminDb();
  const inventory = await getSourceInventory({ uid, subject, isAdmin });

  const relevantSources = [
    ...inventory.groups.pastPapers,
    ...inventory.groups.markingSchemes,
    ...inventory.groups.syllabus,
    ...inventory.groups.paperStructure,
  ].filter((source: any) => {
    const year = numericYear(source.year || source.title);
    return !year || year < targetYear;
  });

  const sourceById = new Map<string, any>();
  for (const source of relevantSources) {
    sourceById.set(String(source.sourceId || source.id), source);
    for (const duplicateId of source.duplicateSourceIds || []) {
      sourceById.set(String(duplicateId), source);
    }
  }

  const questionSnap = await db.collection("exam_question_index")
    .where("subject", "==", subject)
    .get()
    .catch(() => ({ docs: [] } as any));

  const indexedQuestions = (questionSnap as any).docs
    .map((document: any) => ({ id: document.id, ...document.data() }))
    .filter((question: any) => {
      const year = numericYear(question.year);
      const sourceKnown = !question.sourceId || sourceById.has(String(question.sourceId));
      return sourceKnown && (!year || year < targetYear);
    })
    .sort((a: any, b: any) => numericYear(a.year) - numericYear(b.year) || Number(a.questionNo || 0) - Number(b.questionNo || 0));

  const usedSourceIds = new Set<string>();
  let contextText = "";
  let evidenceMode: "question_index" | "rag_chunks" | "metadata_only" = "metadata_only";

  if (indexedQuestions.length > 0) {
    evidenceMode = "question_index";
    const frequency = new Map<string, number>();
    const byType = new Map<string, number>();
    const lastAsked = new Map<string, number>();
    for (const question of indexedQuestions) {
      const lesson = compact(question.lesson || question.subtopic || question.concept || "Unclassified", 90);
      const type = String(question.questionType || question.paperType || "Unknown");
      const year = numericYear(question.year);
      frequency.set(lesson, (frequency.get(lesson) || 0) + 1);
      byType.set(type, (byType.get(type) || 0) + 1);
      if (year > (lastAsked.get(lesson) || 0)) lastAsked.set(lesson, year);
    }

    const frequencyLines = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([lesson, count]) => `${lesson} | frequency=${count} | lastAsked=${lastAsked.get(lesson) || "unknown"}`);
    const typeLines = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}=${count}`);

    const records = [...indexedQuestions]
      .sort((a: any, b: any) => numericYear(b.year) - numericYear(a.year) || Number(a.questionNo || 0) - Number(b.questionNo || 0))
      .slice(0, 120)
      .map((question: any) => {
      if (question.sourceId) usedSourceIds.add(String(question.sourceId));
      return [
        question.year || "year?",
        question.questionType || question.paperType || "question",
        `Q${question.questionNo || "?"}${question.partNo ? `(${question.partNo})` : ""}`,
        question.lesson || "lesson?",
        question.subtopic || question.concept || "topic?",
        question.marks != null ? `${question.marks} marks` : "",
        compact(question.questionText, 180),
      ].filter(Boolean).join(" | ");
    });
    contextText = `\n[PREDICTION DATASET: EXAM QUESTION INDEX]\n[QUESTION TYPE COUNTS]\n${typeLines.join("\n")}\n[LESSON FREQUENCY + RECENCY]\n${frequencyLines.join("\n")}\n[RECENT QUESTION SAMPLE]\n${records.join("\n")}\n`;
  } else {
    const chunkLines: string[] = [];
    for (const source of relevantSources.slice(0, 24)) {
      const sourceId = String(source.sourceId || source.id);
      const chunksSnap = await db.collection("rag_chunks")
        .where("sourceId", "==", sourceId)
        .get()
        .catch(() => ({ docs: [] } as any));
      const chunks = (chunksSnap as any).docs
        .map((document: any) => document.data())
        .sort((a: any, b: any) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0))
        .slice(0, 3);
      if (chunks.length === 0) continue;
      usedSourceIds.add(sourceId);
      for (const chunk of chunks) {
        chunkLines.push(`${source.year || "Year N/A"} | ${source.title} | page ${chunk.pageNumber || "?"} | ${compact(chunk.text, 520)}`);
      }
    }
    if (chunkLines.length > 0) {
      evidenceMode = "rag_chunks";
      contextText = `\n[PREDICTION DATASET: INDEXED PDF CHUNKS]\n${chunkLines.join("\n")}\n`;
    }
  }

  const sourceYears = [...new Set(relevantSources.map((source: any) => numericYear(source.year || source.title)).filter(Boolean))].sort();
  const sources = relevantSources
    .filter((source: any) => usedSourceIds.size === 0 || usedSourceIds.has(String(source.sourceId || source.id)) || (source.duplicateSourceIds || []).some((id: string) => usedSourceIds.has(String(id))))
    .slice(0, 30)
    .map((source: any) => sourcePayload(source, true));

  const stats = {
    subject,
    targetYear,
    uniqueRelevantPdfs: relevantSources.length,
    pastPapers: inventory.groups.pastPapers.filter((source: any) => !numericYear(source.year) || numericYear(source.year) < targetYear).length,
    markingSchemes: inventory.groups.markingSchemes.filter((source: any) => !numericYear(source.year) || numericYear(source.year) < targetYear).length,
    indexedQuestions: indexedQuestions.length,
    yearsCovered: sourceYears,
    evidenceMode,
  };

  contextText = `\n[PREDICTION COVERAGE]\n${JSON.stringify(stats)}\n${contextText}\n`;
  return { contextText, sources, stats, hasEvidence: evidenceMode !== "metadata_only" };
}
