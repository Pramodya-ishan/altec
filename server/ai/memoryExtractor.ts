import { getAIClient, AI_MODELS } from "./client";
import { getAdminDb } from "../firebase/admin";

export async function extractStableMemoryIfUseful(params: {uid: string, prompt: string, answer: string, userContext: any}) {
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
      config: { temperature: 0.1 }
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
  } catch (e) {
    console.warn("Memory extraction failed", e);
  }
  return [];
}
