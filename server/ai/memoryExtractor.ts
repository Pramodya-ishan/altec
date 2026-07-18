import { createHash } from "node:crypto";
import { getAIClient, AI_MODELS } from "./client";
import { getAdminDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

type MemoryKind = "stable_preference" | "weakness" | "target" | "study_pattern" | "mistake";

function normalizeValue(value: unknown) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 800);
}

function memoryDocumentId(type: string, value: string) {
  return createHash("sha256").update(`${type}:${value.toLowerCase()}`).digest("hex").slice(0, 32);
}

function collectionForType(type: MemoryKind) {
  if (type === "weakness") return "weak_points";
  if (type === "mistake") return "mistake_notebook";
  return "ai_memory";
}

export async function extractStableMemoryIfUseful(params: { uid: string; email?: string; prompt: string; answer: string; userContext: any }) {
  if (process.env.ENABLE_MEMORY_EXTRACTION === "false") {
    return { ok: false, skipped: true, reason: "MEMORY_EXTRACTION_DISABLED" };
  }

  try {
    const ai = getAIClient();
    const extractionPrompt = `
Extract only durable, useful G.C.E. A/L study information from this conversation.
Return only a JSON array. Return [] when nothing should be saved.
Never save passwords, contact details, precise location, health information, religion, politics, or temporary emotions.
Do not save facts merely quoted from a PDF. Save only information about the learner that improves future tutoring.
Allowed types: stable_preference, weakness, target, study_pattern, mistake.
Each item must be: {"type":"...","value":"...","confidence":0.0-1.0,"subject":"SFT|ET|ICT|null","lessonId":"string|null"}.
Keep values concise and factual. Merge repeated facts conceptually.

User message:
${params.prompt.slice(0, 5000)}

Assistant answer:
${params.answer.slice(0, 7000)}
`;

    const response = await ai.models.generateContent({
      model: AI_MODELS.default,
      contents: extractionPrompt,
      config: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 900 },
    });

    const raw = String(response.text || "[]").replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const db = getAdminDb();
    const batch = db.batch();
    const now = new Date().toISOString();
    const accepted: any[] = [];
    const aggregateSignals = new Map<string, { type: string; subject: string | null; lessonId: string | null }>();

    for (const candidate of parsed.slice(0, 8)) {
      const type = String(candidate?.type || "") as MemoryKind;
      if (!["stable_preference", "weakness", "target", "study_pattern", "mistake"].includes(type)) continue;
      const value = normalizeValue(candidate?.value);
      if (!value || value.length < 4) continue;
      const collection = collectionForType(type);
      const id = memoryDocumentId(type, value);
      const ref = db.collection("users").doc(params.uid).collection(collection).doc(id);
      batch.set(ref, {
        id,
        type,
        value,
        subject: candidate?.subject || null,
        lessonId: candidate?.lessonId || null,
        confidence: Math.max(0, Math.min(1, Number(candidate?.confidence ?? 0.8))),
        source: "assistant_conversation",
        updatedAt: now,
        createdAt: now,
      }, { merge: true });
      accepted.push({ id, type, value, collection });
      if (type === "weakness" || type === "mistake") {
        const subject = candidate?.subject ? String(candidate.subject).toUpperCase() : null;
        const lessonId = candidate?.lessonId ? String(candidate.lessonId).normalize("NFKC").slice(0, 160) : null;
        const aggregateId = memoryDocumentId(type, `${subject || "all"}:${lessonId || "general"}`);
        aggregateSignals.set(aggregateId, { type, subject, lessonId });
      }
    }

    for (const [aggregateId, signal] of aggregateSignals) {
      const ref = db.collection("learning_signal_aggregates").doc(aggregateId);
      batch.set(ref, {
        id: aggregateId,
        ...signal,
        count: FieldValue.increment(1),
        updatedAt: now,
      }, { merge: true });
    }

    if (accepted.length > 0) await batch.commit();
    return accepted;
  } catch (error: any) {
    if (error?.status === 429 || error?.code === 429) {
      console.warn("MEMORY_EXTRACTION_SKIPPED_QUOTA");
      return { ok: false, skipped: true, reason: "RESOURCE_EXHAUSTED" };
    }
    console.warn("MEMORY_EXTRACTION_FAILED", error?.message || error);
    return { ok: false, skipped: true, reason: "FAILED" };
  }
}
