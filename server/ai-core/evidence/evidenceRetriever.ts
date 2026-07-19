import { getAdminDb } from "../../firebase/admin";
import { validateQuestionEvidence } from "./evidenceGate";
import { QuestionEvidence } from "./evidenceTypes";

export async function retrieveEvidenceForPaperQuestion(params: {
  sourceId: string;
  questionType: string;
  questionNo: string;
  year: string;
  subject: string;
}): Promise<{ ok: boolean; evidence?: QuestionEvidence; reason?: string }> {
  const { sourceId, questionType, questionNo, year, subject } = params;
  const db = getAdminDb();
  
  // 1. Try Verified Answers First
  const verifiedId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
  const verifiedSnap = await db.collection("verified_answers").doc(verifiedId).get();
  if (verifiedSnap.exists) {
    const data = verifiedSnap.data() as any;
    const evidence: QuestionEvidence = {
      ...data,
      extractionMethod: "manual_verified",
      verified: true,
      validationStatus: "valid",
      confidence: 1.0
    };
    return { ok: true, evidence };
  }

  // 2. Try Cache
  const cacheSnap = await db.collection("pdf_question_cache").doc(verifiedId).get();
  if (cacheSnap.exists) {
    const data = cacheSnap.data() as any;
    // Version 2 caches are created only after exact question extraction. Older
    // caches may contain answers inferred from the first PDF chunks and must be
    // rebuilt instead of being trusted.
    if (data?.rejected === true || String(data?.validationStatus || "").toLowerCase() === "rejected") {
      return { ok: false, reason: "REJECTED_CACHE" };
    }
    if (Number(data?.evidenceVersion || 0) < 3) {
      return { ok: false, reason: "STALE_UNVERIFIED_CACHE" };
    }
    if (data?.verifiedEvidence !== true || String(data?.validationStatus || "").toLowerCase() !== "valid" || data?.completed === false) {
      return { ok: false, reason: "UNVERIFIED_OR_INCOMPLETE_CACHE" };
    }
    const gate = validateQuestionEvidence(data, { year, subject, questionNo, questionType });
    if (gate.ok) {
      return { ok: true, evidence: data as QuestionEvidence };
    }
  }

  return { ok: false, reason: "NO_VALID_EVIDENCE_FOUND" };
}
