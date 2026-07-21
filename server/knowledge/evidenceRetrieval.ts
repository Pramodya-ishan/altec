import { getAdminDb } from "../firebase/admin";
import { resolveStrictSource } from "../ai-core/sources/sourceResolver";
import { getSourceInventory } from "../sources/sourceInventoryService";
import { findLessonSources, isLessonEvidenceMode } from "./lessonResolver";

export interface EvidenceResult {
  intent: string;
  subject?: string;
  lessonIds: string[];
  selectedSource: any | null;
  selectedQuestion: any | null;
  candidates: any[];
  evidenceStatus: "verified" | "source_found_text_missing" | "ocr_required" | "index_required" | "not_found";
  exactTextBlocks: string[];
  allowedSourceIds: string[];
  allowAnswerGeneration: boolean;
  allowModelQuestionGeneration: boolean;
}

export function sourceEvidenceReadiness(source: any): { ready: boolean; status: EvidenceResult["evidenceStatus"]; reason: string | null } {
  const hasIndex = source?.textIndexed === true || Number(source?.chunkCount || 0) > 0;
  if (!hasIndex) return { ready: false, status: source?.needsOcr ? "ocr_required" : "index_required", reason: "No searchable text index is ready." };
  if (source?.needsOcr === true || source?.indexStatus === "needs_ocr") {
    return { ready: false, status: "ocr_required", reason: "OCR is required before source-locked answering." };
  }
  const confidence = Number(source?.ocrConfidence);
  const lowConfidencePages = Array.isArray(source?.lowConfidencePages) ? source.lowConfidencePages : [];
  if ((Number.isFinite(confidence) && confidence < 0.65) || lowConfidencePages.length > 0 || source?.needsTextReview === true) {
    return { ready: false, status: "source_found_text_missing", reason: "Indexed text is below the strict evidence confidence threshold." };
  }
  return { ready: true, status: "verified", reason: null };
}

export async function retrieveEvidence(
  uid: string,
  prompt: string,
  route: any,
  policy: any,
  activeConversationState: any
): Promise<EvidenceResult> {
  const lower = prompt.toLowerCase();
  
  let intent = policy.intent || route.mode;
  let subject = route.entities?.subject || activeConversationState?.activeSubject || "SFT";
  let lessonIds: string[] = activeConversationState?.activeLessonIds || [];
  
  let selectedSource: any = null;
  let selectedQuestion: any = null;
  let candidates: any[] = [];
  let evidenceStatus: any = "not_found";
  let exactTextBlocks: string[] = [];
  let allowedSourceIds: string[] = activeConversationState?.activeSourceIds || [];
  let allowAnswerGeneration = !policy.requireEvidence;
  let allowModelQuestionGeneration = intent === "model_question_generation";

  if (policy.requireEvidence) {
    const inventory = await getSourceInventory({ uid, subject, isAdmin: false });
    const allAvailableSources = [...inventory.groups.pastPapers, ...inventory.groups.markingSchemes, ...inventory.groups.syllabus, ...inventory.groups.uploadedPdfs, ...inventory.groups.paperStructure];
    if (isLessonEvidenceMode(intent)) {
      const lessonMatch = findLessonSources(allAvailableSources, prompt, route.entities?.lesson || activeConversationState?.activeLessonIds?.[0], subject);
      lessonIds = lessonMatch.reference ? [lessonMatch.reference.label] : [];
      candidates = lessonMatch.sources;
      const indexedMatches = lessonMatch.sources.filter((source: any) => sourceEvidenceReadiness(source).ready);
      if (indexedMatches.length > 0) {
        selectedSource = indexedMatches[0];
        allowedSourceIds = indexedMatches.map((source: any) => source.sourceId || source.id).filter(Boolean);
        evidenceStatus = "verified";
        allowAnswerGeneration = true;
      } else if (lessonMatch.sources.length > 0) {
        selectedSource = lessonMatch.sources[0];
        allowedSourceIds = lessonMatch.sources.map((source: any) => source.sourceId || source.id).filter(Boolean);
        evidenceStatus = lessonMatch.sources.some((source: any) => source.needsOcr) ? "ocr_required" : "index_required";
        allowAnswerGeneration = false;
      }
    }
    
    const requestedYear = route.entities?.year;
    
    const strictRes = isLessonEvidenceMode(intent) ? { selectedSource: null } : resolveStrictSource(allAvailableSources, {
      year: requestedYear,
      subject,
      activeSourceId: activeConversationState?.selectedSourceId || null,
      prompt
    });
    
    const activeSourceId = route.entities?.activeSourceId
      || activeConversationState?.selectedSourceId
      || activeConversationState?.activeSourceIds?.[0];
    if (["continue_grounded_discussion", "official_paper_question"].includes(intent) && activeSourceId) {
      selectedSource = allAvailableSources.find(s => s.id === activeSourceId || s.sourceId === activeSourceId);
      if (selectedSource) {
        const readiness = sourceEvidenceReadiness(selectedSource);
        evidenceStatus = readiness.status;
        allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
        allowAnswerGeneration = readiness.ready;
      }
    }
    if (strictRes.selectedSource) {
      selectedSource = strictRes.selectedSource;
      const readiness = sourceEvidenceReadiness(selectedSource);
      evidenceStatus = readiness.status;
      allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
      allowAnswerGeneration = readiness.ready;
    } else if (!isLessonEvidenceMode(intent)) {
      // Evidence-required requests must never fall back to the first PDF in an
      // inventory. A source is usable only when it is explicitly selected or
      // strictly locked by title/year/subject metadata.
      selectedSource = null;
      allowedSourceIds = [];
      allowAnswerGeneration = false;
      evidenceStatus = "not_found";
    }
  }

  return {
    intent,
    subject,
    lessonIds,
    selectedSource,
    selectedQuestion,
    candidates,
    evidenceStatus,
    exactTextBlocks,
    allowedSourceIds,
    allowAnswerGeneration,
    allowModelQuestionGeneration
  };
}
