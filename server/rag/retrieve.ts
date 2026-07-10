import { getAdminDb } from "../firebase/admin";
import { RagChunk, Subject, SourceType } from "./types";
import { extractKeywords, normalizeText } from "./chunker";
import { SYLLABUS } from "../../src/constants/syllabus";

export async function retrieveRelevantKnowledge(params: { prompt: string, activeSubject: string, mode: string, limit?: number, uid?: string }) {
  const { prompt, activeSubject, mode, limit = 6, uid } = params;
  
  const db = getAdminDb();
  const chunksResult: RagChunk[] = [];
  
  const lowerPrompt = prompt.toLowerCase();
  let detectedSubject = activeSubject;
  if (lowerPrompt.includes("sft") || lowerPrompt.includes("science for technology") || lowerPrompt.includes("තාක්ෂණවේදය සඳහා විද්‍යාව")) detectedSubject = "sft";
  else if (lowerPrompt.includes("et") || lowerPrompt.includes("engineering technology") || lowerPrompt.includes("ඉංජිනේරු තාක්ෂණවේදය")) detectedSubject = "et";
  else if (lowerPrompt.includes("ict") || lowerPrompt.includes("information technology") || lowerPrompt.includes("තොරතුරු තාක්ෂණය")) detectedSubject = "ict";
  
  let yearMatch = prompt.match(/\b(201[0-9]|202[0-9]|203[0-9])\b/);
  const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let queryKeywords = extractKeywords(prompt).slice(0, 10);
  
  try {
    let query: any = db.collection("rag_chunks");
    
    if (detectedSubject && detectedSubject !== "general") {
      query = query.where("subject", "==", detectedSubject);
    }
    
    if (detectedYear) {
      const exactYearQuery = query.where("year", "==", detectedYear).limit(limit * 3);
      const yearSnap = await exactYearQuery.get();
      yearSnap.forEach((doc: any) => chunksResult.push(doc.data() as RagChunk));
    }
    
    if (chunksResult.length < limit && queryKeywords.length > 0) {
      // array-contains-any on keywords
      const keywordQuery = query.where("keywords", "array-contains-any", queryKeywords).limit(limit * 3);
      const kwSnap = await keywordQuery.get();
      kwSnap.forEach((doc: any) => {
        const chunk = doc.data() as RagChunk;
        if (!chunksResult.find(c => c.id === chunk.id)) {
          chunksResult.push(chunk);
        }
      });
    }

  } catch (error) {
    console.warn("RAG Firestore query failed", error);
  }

  // Fallback to syllabus if no chunks found
  if (chunksResult.length === 0 && detectedSubject && detectedSubject !== "general") {
    console.warn("RAG_FIRESTORE_EMPTY_USING_SYLLABUS_FALLBACK");
    const syllabus = (SYLLABUS as any)[detectedSubject.toLowerCase()];
    if (syllabus) {
      const searchItems = [
        ...(syllabus.mcqItems || []),
        ...(syllabus.partAItems || []),
        ...(syllabus.partBCDItems || [])
      ];
      searchItems.forEach(item => {
        const lessonTitle = item.title.toLowerCase();
        let confidence = 0;
        if (lowerPrompt.includes(lessonTitle)) confidence += 0.8;
        else {
          const words = lessonTitle.split(' ');
          let matchCount = 0;
          words.forEach((w: string) => {
            if (w.length > 2 && lowerPrompt.includes(w)) matchCount++;
          });
          if (matchCount > 0) confidence += (matchCount / words.length) * 0.5;
        }
        
        if (confidence > 0) {
          chunksResult.push({
            id: "fallback_" + Math.random(),
            sourceId: "fallback_syllabus",
            subject: detectedSubject as Subject,
            lesson: item.title,
            sourceType: "syllabus",
            text: `Lesson: ${item.title}. Question weight: ${item.count} questions. Type: ${item.q.includes('Q') ? 'MCQ' : 'Structured/Essay'}.`,
            normalizedText: "",
            keywords: [],
            tokenEstimate: 20,
            createdAt: new Date().toISOString()
          } as RagChunk);
        }
      });
    }
  }

  // Scoring
  const scoredChunks = chunksResult.map(c => {
    let score = 0.5;
    const chunkLower = c.normalizedText || c.text.toLowerCase();
    
    if (detectedSubject && c.subject === detectedSubject) score += 0.2;
    if (detectedYear && c.year === detectedYear) score += 0.4;
    
    let kwMatch = 0;
    queryKeywords.forEach(kw => {
      if (c.keywords?.includes(kw)) kwMatch++;
      else if (chunkLower.includes(kw)) kwMatch += 0.5;
    });
    if (queryKeywords.length > 0) {
      score += (kwMatch / queryKeywords.length) * 0.4;
    }

    return { ...c, __score: score };
  });

  scoredChunks.sort((a, b) => b.__score - a.__score);
  
  // Format the output
  const uniqueSources = new Map<string, any>();
  
  const finalChunks = [];
  for (const c of scoredChunks.slice(0, limit)) {
    let sourceMeta: any = { title: "Knowledge Base", sourceType: c.sourceType };
    if (!c.id.startsWith("fallback_")) {
      if (!uniqueSources.has(c.sourceId)) {
        let sourceDoc: any = { exists: false };
        try { sourceDoc = await db.collection("rag_sources").doc(c.sourceId).get(); } catch (e) { console.warn("Failed to get sourceDoc", e); }
        if (sourceDoc.exists) {
          uniqueSources.set(c.sourceId, sourceDoc.data());
        }
      }
      sourceMeta = uniqueSources.get(c.sourceId) || sourceMeta;
    } else {
       sourceMeta = { title: "A/L Syllabus Details", sourceType: "syllabus" };
    }

    finalChunks.push({
      id: c.id,
      subject: c.subject,
      lesson: c.lesson,
      sourceType: c.sourceType,
      title: sourceMeta.title,
      text: c.text,
      year: c.year,
      confidence: Math.min(1.0, c.__score),
      citationLabel: `[${sourceMeta.title}${c.year ? ` ${c.year}` : ''}]`
    });
  }

  return finalChunks;
}
