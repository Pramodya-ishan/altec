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
      const lessonMatch = findLessonSources(allAvailableSources, prompt, route.entities?.lesson || activeConversationState?.activeLessonIds?.[0]);
      lessonIds = lessonMatch.reference ? [lessonMatch.reference.label] : [];
      candidates = lessonMatch.sources;
      const indexedMatches = lessonMatch.sources.filter((source: any) => source.textIndexed || Number(source.chunkCount || 0) > 0);
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
        const hasIndex = selectedSource.textIndexed === true || Number(selectedSource.chunkCount || 0) > 0;
        evidenceStatus = hasIndex
          ? "verified"
          : (selectedSource.needsOcr ? "ocr_required" : "index_required");
        allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
        allowAnswerGeneration = hasIndex;
      }
    }
    if (strictRes.selectedSource) {
      selectedSource = strictRes.selectedSource;
      evidenceStatus = "verified";
      allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
      allowAnswerGeneration = true;
    } else if (!isLessonEvidenceMode(intent)) {
      if (allAvailableSources.length > 0) {
        // Find best match manually if resolveStrictSource failed
        const matches = allAvailableSources.filter(s => {
          if (requestedYear && s.year !== requestedYear) return false;
          if (subject && s.subject !== subject) return false;
          return true;
        });
        if (matches.length > 0) {
          selectedSource = matches[0];
          evidenceStatus = "verified";
          allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
          allowAnswerGeneration = true;
        }
      }
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
