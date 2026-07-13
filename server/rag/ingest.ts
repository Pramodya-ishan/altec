import { RagSource, RagChunk } from "./types";
import { saveRagChunk, saveRagSource } from "./store";
import { chunkText, extractKeywords, normalizeText, estimateTokens } from "./chunker";
import { getAdminDb } from "../firebase/admin";

export async function processAndIngestText(fullText: string, metadata: Omit<RagSource, "id" | "status" | "chunkCount" | "createdAt" | "updatedAt">, sourceId?: string): Promise<{ sourceId: string, chunkCount: number }> {
  const sid = sourceId || `src_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const source: RagSource = {
    ...metadata,
    id: sid,
    status: "processing",
    chunkCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await saveRagSource(source);
  
  try {
    const rawChunks = chunkText(fullText, 800, 100);
    const db = getAdminDb();
    const batch = db.batch();
    
    let chunkCount = 0;
    
    for (let i = 0; i < rawChunks.length; i++) {
      const text = rawChunks[i];
      if (text.trim().length < 10) continue;
      
      const chunkId = `${sid}_chunk_${i}`;
      const chunk: RagChunk = {
        id: chunkId,
        sourceId: sid,
        subject: metadata.subject,
        sourceType: metadata.sourceType,
        year: metadata.year,
        text: text,
        normalizedText: normalizeText(text),
        keywords: extractKeywords(text),
        tokenEstimate: estimateTokens(text),
        createdAt: new Date().toISOString()
      };
      
      const chunkRef = db.collection("rag_chunks").doc(chunkId);
      batch.set(chunkRef, chunk);
      chunkCount++;
      
      // Batch writes in groups of 400
      if (chunkCount % 400 === 0) {
        await batch.commit();
      }
    }
    
    if (chunkCount % 400 !== 0) {
      await batch.commit();
    }
    
    source.status = "ready";
    source.chunkCount = chunkCount;
    source.updatedAt = new Date().toISOString();
    await saveRagSource(source);
    
    return { sourceId: sid, chunkCount };
  } catch (error: any) {
    source.status = "failed";
    source.error = error.message;
    source.updatedAt = new Date().toISOString();
    await saveRagSource(source);
    throw error;
  }
}
