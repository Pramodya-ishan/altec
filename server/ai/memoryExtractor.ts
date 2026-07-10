import { getAIClient, AI_MODELS } from "./client";
import { getAdminDb } from "../firebase/admin";

export async function extractStableMemoryIfUseful(params: {uid: string, email?: string, prompt: string, answer: string, userContext: any}) {
  if (process.env.ENABLE_MEMORY_EXTRACTION !== "true") {
    return {
      ok: false,
      skipped: true,
      reason: "MEMORY_EXTRACTION_DISABLED"
    };
  }

  try {
    const ai = getAIClient();
    const extractionPrompt = `
Extract only stable, useful study-related facts from the conversation.
Return ONLY a JSON array. Do not return markdown blocks like ` + '```json' + `.
If nothing useful, return [].
Do not extract sensitive personal information.
Do not extract temporary emotions.
Only extract facts that help future A/L study support.

Types allowed: "stable_preference" | "weakness" | "target" | "study_pattern" | "mistake"

User Prompt: ${params.prompt}
Assistant Answer: ${params.answer}
`;

    const response = await ai.models.generateContent({
      model: AI_MODELS.default,
      contents: extractionPrompt,
      config: { 
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    let text = response.text || "[]";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const items = JSON.parse(text);
    if (Array.isArray(items) && items.length > 0) {
      const db = getAdminDb();
      const batch = db.batch();
      for (const item of items) {
        if (item.type && item.value) {
          const ref = db.collection("users").doc(params.uid).collection("ai_memory").doc();
          batch.set(ref, {
            type: item.type,
            value: item.value,
            confidence: item.confidence || 0.8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      await batch.commit();
      return items;
    }
  } catch (e: any) {
    if (e?.status === 429 || e?.code === 429) {
      console.warn("MEMORY_EXTRACTION_SKIPPED_QUOTA");
      return { ok: false, skipped: true, reason: "RESOURCE_EXHAUSTED" };
    }
    console.warn("MEMORY_EXTRACTION_FAILED", e?.message || e);
    return { ok: false, skipped: true, reason: "FAILED" };
  }
  return [];
}
