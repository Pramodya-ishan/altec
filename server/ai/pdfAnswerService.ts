import { getAdminDb } from "../firebase/admin";
import { GoogleGenAI, Type } from "@google/genai";
import { getAIClient, AI_MODELS } from "./client";
import { sanitizeAssistantText } from "./responseHygiene";

export async function answerFromPdfEvidence({
  uid,
  chatId,
  transcriptOrPrompt,
  activeSubject,
  activeSourceId,
  recentAttachmentIds,
  questionNo,
  questionType,
  year,
  mode = "live_voice"
}: any) {
  try {
    const db = getAdminDb();
    const ai = getAIClient();
    
    // 1. Gather all chunks
    let chunks: any[] = [];
    
    // Fallback: search across user's rag_chunks if no active source
    let sourceIdsToSearch = [activeSourceId, ...(recentAttachmentIds || [])].filter(Boolean);
    
    if (sourceIdsToSearch.length > 0) {
      for (const srcId of sourceIdsToSearch) {
        const snap = await db.collection("rag_chunks").where("sourceId", "==", srcId).get();
        chunks.push(...snap.docs.map((d: any) => d.data()));
      }
    } else {
       // Search user's chunks generically by subject or all
       let query: any = db.collection("rag_chunks").where("ownerUid", "==", uid);
       if (activeSubject) {
          query = query.where("subject", "==", activeSubject);
       }
       const snap = await query.limit(50).get();
       chunks.push(...snap.docs.map((d: any) => d.data()));
    }
    
    if (chunks.length === 0) {
      return {
        ok: false,
        code: "PDF_SOURCE_REQUIRED",
        message: "මොන PDF එකෙන්ද answer කරන්න ඕනේ? PDF එක select කරන්න.",
        answer: "මොන PDF එකෙන්ද answer කරන්න ඕනේ? කරුණාකර PDF එකක් select කරන්න.",
        sources: [],
        evidenceLevel: "blocked"
      };
    }
    
    // Concatenate chunk context
    const contextLines = chunks.slice(0, 15).map(c => `[Source: ${c.title || c.fileName} | Page: ${c.pageNumber || '?'}] ${c.text}`);
    const contextStr = contextLines.join("\n\n");
    
    // 2. Query Gemini
    const systemInstruction = `You are a Sinhala-first A/L Technology tutor. 
You must answer the user's question USING ONLY the provided PDF context. 
If the evidence is not in the context, say 'PDF එකෙන් verify කරන්න බැරි නිසා answer guess කරන්නෙ නැහැ. වෙන PDF එකක් select කරන්න.'
Do not guess. Do not bring in outside knowledge if the context doesn't support it.
Output valid JSON.`;

    const prompt = `Context:\n${contextStr}\n\nQuestion: ${transcriptOrPrompt}\n\nReturn JSON: { "answer": "Sinhala answer text", "evidenceLevel": "high|medium|blocked", "sourceTitles": ["..."] }`;
    
    const response = await ai.models.generateContent({
      model: AI_MODELS.pdf || "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            evidenceLevel: { type: Type.STRING },
            sourceTitles: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["answer", "evidenceLevel", "sourceTitles"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    
    // 3. Map sources
    let finalSources: any[] = [];
    if (parsed.sourceTitles && parsed.sourceTitles.length > 0) {
       for (const title of parsed.sourceTitles) {
          const match = chunks.find(c => (c.title || c.fileName) === title);
          if (match) {
             finalSources.push({
               sourceId: match.sourceId,
               title: match.title || match.fileName,
               pageNumber: match.pageNumber,
               usedInAnswer: true,
               storagePath: match.storagePath // assuming it exists
             });
          }
       }
    }
    // De-dupe sources
    finalSources = Array.from(new Map(finalSources.map(s => [s.sourceId, s])).values());
    
    if (parsed.evidenceLevel === "blocked") {
      return {
        ok: false,
        code: "PDF_SOURCE_REQUIRED",
        message: sanitizeAssistantText(parsed.answer),
        answer: sanitizeAssistantText(parsed.answer),
        sources: finalSources,
        evidenceLevel: "blocked"
      };
    }

    return {
      ok: true,
      answer: sanitizeAssistantText(parsed.answer),
      sources: finalSources,
      evidenceLevel: parsed.evidenceLevel || "high"
    };

  } catch (err: any) {
    console.error("PDF Answer error:", err);
    return {
      ok: false,
      code: "ERROR",
      message: "The operation failed. Please try again.",
      answer: "සමාවෙන්න, PDF එක පරීක්ෂා කිරීමේදී දෝෂයක් ඇති විය.",
      sources: [],
      evidenceLevel: "blocked"
    };
  }
}
