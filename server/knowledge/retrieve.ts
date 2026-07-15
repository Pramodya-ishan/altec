
import { getAdminDb } from "../firebase/admin";
import { getSourceInventory } from "../sources/sourceInventoryService";
import { findLessonSources, scoreLessonSource } from "./lessonResolver";

export async function retrieveRelevantKnowledge({
  query,
  uid,
  subject,
  limit = 8,
  lesson,
  strictLesson = false,
  allowedSourceIds = []
}: {
  query: string;
  uid?: string;
  subject?: string;
  limit?: number;
  lesson?: string;
  strictLesson?: boolean;
  allowedSourceIds?: string[];
}) {
  const db = getAdminDb();
  const chunks: Array<{
    sourceType: string;
    title: string;
    text: string;
    confidence: number;
    year?: string;
    lesson?: string;
    subject?: string;
    id?: string;
    url?: string;
    sourceId?: string;
    storagePath?: string;
  }> = [];

  const lowerQ = query.toLowerCase();

  if (uid && strictLesson) {
    const inventory = await getSourceInventory({ uid, subject, isAdmin: false });
    const lessonMatch = findLessonSources(inventory.all, query, lesson);
    let sources = lessonMatch.sources;

    // Older uploads did not copy the lesson from the lesson container onto the
    // source document. Recover those sources from the lesson metadata already
    // stored on their indexed chunks.
    if (lessonMatch.reference) {
      const knownIds = new Set(sources.map((source: any) => String(source.sourceId || source.id)));
      const accessibleSourceMap = new Map<string, any>(
        inventory.all.map((source: any): [string, any] => [String(source.sourceId || source.id), source]),
      );
      const [ownedChunks, sharedChunks] = await Promise.all([
        db.collection("rag_chunks").where("ownerUid", "==", uid).get().catch(() => ({ docs: [] } as any)),
        db.collection("rag_chunks").where("visibility", "in", ["official", "shared"]).get().catch(() => ({ docs: [] } as any)),
      ]);
      for (const document of [...(ownedChunks as any).docs, ...(sharedChunks as any).docs]) {
        const chunk = document.data();
        const sourceId = String(chunk.sourceId || "");
        const source = accessibleSourceMap.get(sourceId);
        if (!source || knownIds.has(sourceId)) continue;
        const score = scoreLessonSource({ lesson: chunk.lesson, title: source.title }, lessonMatch.reference);
        if (score < 40) continue;
        sources.push({ ...source, lesson: chunk.lesson || source.lesson, lessonMatchScore: score });
        knownIds.add(sourceId);
      }
      sources = sources.sort((a: any, b: any) => Number(b.lessonMatchScore || 0) - Number(a.lessonMatchScore || 0));
    }

    for (const source of sources.slice(0, 10)) {
      const sourceId = source.sourceId || source.id;
      const chunkSnapshot = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
      chunkSnapshot.docs
        .sort((a: any, b: any) => Number(a.data().chunkIndex || 0) - Number(b.data().chunkIndex || 0))
        .slice(0, 8)
        .forEach((document: any) => {
          const data = document.data();
          if (!data.text) return;
          chunks.push({
            sourceType: data.sourceType || source.sourceType || "Lesson PDF",
            title: source.title,
            text: data.text,
            confidence: Math.min(1, Number(source.lessonMatchScore || 100) / 100),
            year: data.year || source.year,
            lesson: data.lesson || source.lesson || lessonMatch.reference?.label,
            subject: data.subject || source.subject,
            id: document.id,
            sourceId,
            storagePath: source.storagePath,
            pageNumber: data.pageNumber,
          } as any);
        });
    }

    // Round-robin chunks so every matched lesson PDF contributes evidence.
    // This prevents the first large PDF from filling the context window and
    // silently excluding other PDFs in the same lesson container.
    const bySource = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
      const key = String(chunk.sourceId || "unknown");
      const list = bySource.get(key) || [];
      list.push(chunk);
      bySource.set(key, list);
    }
    const selected: typeof chunks = [];
    const maximum = Math.max(limit, Math.min(40, sources.length * 4));
    for (let index = 0; selected.length < maximum; index += 1) {
      let added = false;
      for (const source of sources) {
        const sourceChunks = bySource.get(String(source.sourceId || source.id)) || [];
        if (sourceChunks[index]) {
          selected.push(sourceChunks[index]);
          added = true;
          if (selected.length >= maximum) break;
        }
      }
      if (!added) break;
    }
    return {
      chunks: selected,
      sources: sources.map((source: any) => ({
        id: source.sourceId || source.id,
        sourceId: source.sourceId || source.id,
        title: source.title,
        lesson: source.lesson || lessonMatch.reference?.label,
        storagePath: source.storagePath,
        confidence: Math.min(1, Number(source.lessonMatchScore || 100) / 100),
        sourceType: source.sourceType || source.resourceType,
        usedInAnswer: selected.some((chunk: any) => chunk.sourceId === (source.sourceId || source.id)),
      })),
      lesson: lessonMatch.reference?.label || lesson || null,
      status: selected.length > 0 ? "success" : (sources.length > 0 ? "index_required" : "not_found"),
    };
  }

  try {
    // 0. Active chat temporary PDFs (only if intent matches)
    const isPdfQuery = query.toLowerCase().includes("pdf") || query.match(/mcq|essay|structured|prashna|q\d|ප්‍රශ්න|paper|marking|scheme|answer/i);
    let activePdfSourceIds: string[] = [];
    if (uid && isPdfQuery) {
      try {
        const chatContextDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
        if (chatContextDoc.exists) {
          const data = chatContextDoc.data();
          if (data && Array.isArray(data.temporaryPdfs)) {
            activePdfSourceIds = data.temporaryPdfs.map((pdf: any) => pdf.sourceId);
          }
        }
      } catch (err: any) {
        console.warn("Failed to retrieve temporary PDFs context:", err.message);
      }
    }

    if (uid && activePdfSourceIds.length > 0) {
      try {
        for (const sId of activePdfSourceIds) {
          const sourceSnap = await db.collection("rag_sources").doc(sId).get();
          const sourceData = sourceSnap.exists ? sourceSnap.data() : null;
          const sourceTitle = sourceData?.title || sourceData?.fileName || "Uploaded PDF";
          const storagePath = sourceData?.storagePath || "";
          
          const chunksSnap = await db.collection("rag_chunks")
            .where("sourceId", "==", sId)
            .get();
            
          chunksSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            const textLower = (data.text || "").toLowerCase();
            const matchesSearch = textLower.includes(lowerQ) || 
              (data.tags && data.tags.some((t: string) => lowerQ.includes(t.toLowerCase())));
              
            if (matchesSearch) { // Only push if matches search when from active PDF to avoid polluting
              chunks.push({
                sourceType: "Uploaded PDF",
                title: sourceTitle,
                text: data.text,
                confidence: 1.0,
                subject: data.subject,
                lesson: data.lesson,
                year: data.year,
                id: doc.id,
                sourceId: sId,
                storagePath: storagePath
              });
            }
          });
        }
      } catch (err: any) {
        console.warn("Failed to retrieve chunks for active temporary PDFs:", err.message);
      }
    }

    // 1. Explicitly check for an uploaded PDF in the chat prompt
    const uploadedPdfMatch = query.match(/\[Uploaded PDF:\s*([^\]]+)\]/i);
    if (uploadedPdfMatch && uid) {
       const uploadedFileName = uploadedPdfMatch[1].trim();
       try {
          const sourcesSnap = await db.collection("rag_sources")
             .where("ownerUid", "==", uid)
             .where("fileName", "==", uploadedFileName)
             .limit(1)
             .get();
          
          let sourceId = "";
          let sourceTitle = uploadedFileName;
          let recentSources: any = null;
          if (!sourcesSnap.empty) {
             sourceId = sourcesSnap.docs[0].id;
             sourceTitle = sourcesSnap.docs[0].data().title || uploadedFileName;
          } else {
             recentSources = await db.collection("rag_sources")
                .where("ownerUid", "==", uid)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
             if (!recentSources.empty) {
                sourceId = recentSources.docs[0].id;
                sourceTitle = recentSources.docs[0].data().title || recentSources.docs[0].data().fileName;
             }
          }
          
          if (sourceId) {
             const chunksSnap = await db.collection("rag_chunks")
                .where("sourceId", "==", sourceId)
                .limit(limit)
                .get();
             chunksSnap.docs.forEach((doc: any) => {
                const data = doc.data();
                chunks.push({
                   sourceType: "Uploaded PDF",
                   title: sourceTitle,
                   text: data.text,
                   confidence: 1.0,
                   subject: data.subject,
                   lesson: data.lesson,
                   year: data.year,
                   id: doc.id,
                   sourceId: data.sourceId || sourceId,
                   storagePath: data.storagePath || sourcesSnap?.docs[0]?.data()?.storagePath || recentSources?.docs[0]?.data()?.storagePath
                });
             });
          }
       } catch (pdfErr: any) {
          console.warn("Failed to retrieve chunks for uploaded PDF:", pdfErr.message);
       }
    }

    // 2. Syllabus owner private search first
    if (uid && chunks.length < limit) {
       const roleDoc = await db.collection("user_roles").doc(uid).get();
       const userRoles = roleDoc.exists ? (roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : [])) : [];
       const isOwner = userRoles.includes("admin") || userRoles.includes("teacher") || userRoles.includes("content_editor");
       
       if (isOwner) {
          const sylSnap = await db.collection("users").doc(uid).collection("syllabus_chunks")
             .where("subject", "==", subject || null)
             .limit(limit)
             .get();
             
          sylSnap.docs.forEach((doc: any) => {
             const data = doc.data();
             if (data.text?.toLowerCase().includes(lowerQ) || lowerQ.includes(data.subject?.toLowerCase() || "")) {
                chunks.push({
                   sourceType: "Syllabus Library",
                   title: data.tags?.[0] || data.subject || "Private Syllabus",
                   text: data.text,
                   confidence: 1,
                   subject: data.subject,
                   lesson: data.lesson,
                   year: data.year,
                   id: doc.id,
                   sourceId: data.sourceId,
                   storagePath: data.storagePath
                });
             }
          });
       }
    }

    // 3. User's own private RAG chunks search (for private PDFs/custom uploads)
    if (uid && chunks.length < limit) {
       try {
         const userChunksSnap = await db.collection("rag_chunks")
           .where("ownerUid", "==", uid)
           .limit(limit * 2)
           .get();
         userChunksSnap.docs.forEach((doc: any) => {
           const data = doc.data();
           const matchesSearch = data.text?.toLowerCase().includes(lowerQ) || 
             (data.tags && data.tags.some((t: string) => lowerQ.includes(t.toLowerCase())));
           if (matchesSearch) {
              chunks.push({
                 sourceType: data.sourceScope === "owner_syllabus" ? "Syllabus Library" : "My Uploaded PDF",
                 title: data.tags?.[0] || "My Document",
                 text: data.text,
                 confidence: 0.95,
                 subject: data.subject,
                 lesson: data.lesson,
                 year: data.year,
                 id: doc.id,
                 sourceId: data.sourceId,
                 storagePath: data.storagePath
              });
           }
         });
       } catch (err: any) {
         console.warn("User private chunks search failed:", err.message);
       }
    }

    // 4. Fallback to normal RAG chunks
    if (chunks.length < limit) {
       let ragQuery = db.collection("rag_chunks")
         .where("visibility", "in", ["official", "shared"]);
       
       const ragSnap = await ragQuery.limit(limit).get();
       ragSnap.docs.forEach((doc: any) => {
         const data = doc.data();
         if (data.text?.toLowerCase().includes(lowerQ)) {
            chunks.push({
               sourceType: data.sourceScope === "owner_syllabus" ? "Syllabus Library" : "RAG DB",
               title: data.tags?.[0] || "RAG Resource",
               text: data.text,
               confidence: 0.9,
               subject: data.subject,
               lesson: data.lesson,
               year: data.year,
               id: doc.id,
               sourceId: data.sourceId,
               storagePath: data.storagePath
            });
         }
       });
    }
    
    // Sort and return
    chunks.sort((a, b) => b.confidence - a.confidence);
    
    return {
      chunks: chunks.slice(0, limit),
      sources: chunks.slice(0, limit).map(c => ({
        id: c.sourceId || c.id,
        sourceId: c.sourceId || c.id,
        title: c.title,
        storagePath: c.storagePath,
        url: c.url,
        confidence: c.confidence,
        sourceType: c.sourceType,
        usedInAnswer: true,
        pageNumber: (c as any).pageNumber
      })),
      status: "success"
    };

  } catch (e: any) {
    console.warn("Firestore retrieve failed:", e.message);
    return {
      chunks: [],
      sources: [],
      status: "firestore_unavailable",
      errorCode: e.code || "PERMISSION_DENIED",
      usedFallback: true
    };
  }
}

export async function retrieveUploadedPdfQuestion({
  uid,
  uploadedFileName,
  sourceId,
  questionNo,
  query,
  limit = 8
}: {
  uid: string;
  uploadedFileName?: string;
  sourceId?: string;
  questionNo?: string;
  query?: string;
  limit?: number;
}) {
  const db = getAdminDb();
  let activeSourceId = sourceId;
  let sourceData: any = null;

  // Search order:
  // 1. users/{uid}/chat_context/current.activePdf.sourceId
  if (!activeSourceId) {
    try {
      const chatCtxDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
      if (chatCtxDoc.exists) {
        const data = chatCtxDoc.data();
        if (data && data.activePdf && data.activePdf.sourceId) {
          activeSourceId = data.activePdf.sourceId;
          sourceData = data.activePdf;
        }
      }
    } catch (err: any) {
      console.warn("Failed to read activePdf from chat_context/current:", err.message);
    }
  }

  // 2. temporaryPdfs matching uploadedFileName
  if (!activeSourceId && uploadedFileName) {
    try {
      const chatCtxDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
      if (chatCtxDoc.exists) {
        const data = chatCtxDoc.data();
        if (data && Array.isArray(data.temporaryPdfs)) {
          const matchedPdf = data.temporaryPdfs.find((pdf: any) => 
            (pdf.fileName && pdf.fileName.toLowerCase() === uploadedFileName.toLowerCase()) ||
            (pdf.title && pdf.title.toLowerCase() === uploadedFileName.toLowerCase())
          );
          if (matchedPdf) {
            activeSourceId = matchedPdf.sourceId;
            sourceData = matchedPdf;
          }
        }
      }
    } catch (err: any) {
      console.warn("Failed to check temporaryPdfs:", err.message);
    }
  }

  // 3. rag_sources where ownerUid == uid and fileName == uploadedFileName
  if (!activeSourceId && uploadedFileName) {
    try {
      const sourcesSnap = await db.collection("rag_sources")
        .where("ownerUid", "==", uid)
        .where("fileName", "==", uploadedFileName)
        .limit(1)
        .get();
          let recentSources: any = null;
      if (!sourcesSnap.empty) {
        activeSourceId = sourcesSnap.docs[0].id;
        sourceData = sourcesSnap.docs[0].data();
      }
    } catch (err: any) {
      console.warn("Failed to query rag_sources by fileName:", err.message);
    }
  }

  // 4. latest rag_sources ownerUid == uid only as final fallback
  if (!activeSourceId) {
    try {
             const recentSources = await db.collection("rag_sources")
        .where("ownerUid", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (!recentSources.empty) {
        activeSourceId = recentSources.docs[0].id;
        sourceData = recentSources.docs[0].data();
      }
    } catch (err: any) {
      console.warn("Failed fallback to recent rag_sources:", err.message);
    }
  }

  // Retrieve source if we only have sourceId
  if (activeSourceId && !sourceData) {
    try {
      const srcSnap = await db.collection("rag_sources").doc(activeSourceId).get();
      if (srcSnap.exists) {
        sourceData = srcSnap.data();
      }
    } catch (err) {
      console.warn("Failed to retrieve rag_source doc:", err);
    }
  }

  if (!activeSourceId) {
    return {
      chunks: [],
      source: null,
      hasExactQuestionText: false,
      needsOcr: false
    };
  }

  const needsOcr = !!sourceData?.needsOcr;

  // Retrieve chunks
  let chunks: any[] = [];
  try {
    const chunksSnap = await db.collection("rag_chunks")
      .where("sourceId", "==", activeSourceId)
      .get();
    
    chunks = chunksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("Failed to retrieve rag_chunks:", err);
  }

  // Process exact match and ranking
  let hasExactQuestionText = false;
  const scoredChunks = chunks.map(c => {
    let score = 0;
    const lowerText = (c.text || "").toLowerCase();

    // Exact question match
    if (questionNo && c.questionNo === questionNo) {
      score += 1000;
      hasExactQuestionText = true;
    } else if (questionNo) {
      // QuestionNo fallback match in text
      const isQ1 = questionNo === "Q1" && (
        lowerText.includes("q1") ||
        lowerText.includes("question 1") ||
        lowerText.includes("question 01") ||
        lowerText.includes("ප්‍රශ්නය 1") ||
        lowerText.includes("ප්‍රශ්නය 01") ||
        lowerText.includes("ප්රශ්නය 1") ||
        lowerText.includes("ප්රශ්නය 01") ||
        lowerText.includes("පළමු") ||
        lowerText.includes("පළවෙනි") ||
        /(?:^|\s|\n)0?1\.\s/.test(lowerText)
      );

      const isQ2 = questionNo === "Q2" && (
        lowerText.includes("q2") ||
        lowerText.includes("question 2") ||
        lowerText.includes("question 02") ||
        lowerText.includes("ප්‍රශ්නය 2") ||
        lowerText.includes("ප්‍රශ්නය 02") ||
        lowerText.includes("ප්රශ්නය 2") ||
        lowerText.includes("ප්රශ්නය 02") ||
        lowerText.includes("දෙවන") ||
        lowerText.includes("දෙවෙනි") ||
        /(?:^|\s|\n)0?2\.\s/.test(lowerText)
      );

      const isQ3 = questionNo === "Q3" && (
        lowerText.includes("q3") ||
        lowerText.includes("question 3") ||
        lowerText.includes("question 03") ||
        lowerText.includes("ප්‍රශ්නය 3") ||
        lowerText.includes("ප්‍රශ්නය 03") ||
        lowerText.includes("ප්රශ්නය 3") ||
        lowerText.includes("ප්රශ්නය 03") ||
        lowerText.includes("තුන්වන") ||
        lowerText.includes("තුන්වෙනි") ||
        /(?:^|\s|\n)0?3\.\s/.test(lowerText)
      );

      if (isQ1 || isQ2 || isQ3) {
        score += 500;
        hasExactQuestionText = true;
      }
    }

    // Page-based scores
    if (c.pageNumber) {
      if (c.pageNumber === 1) score += 100;
      else if (c.pageNumber === 2) score += 50;
      else if (c.pageNumber === 3) score += 20;
    } else {
      if (c.chunkIndex === 0) score += 80;
      else if (c.chunkIndex === 1) score += 40;
    }

    // Keyword relevance
    if (query) {
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      queryWords.forEach(w => {
        if (lowerText.includes(w)) {
          score += 10;
        }
      });
    }

    return { chunk: c, score };
  });

  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  // Return the top ones up to limit
  const finalChunks = scoredChunks.slice(0, limit).map(sc => ({
    sourceType: "Uploaded PDF",
    title: sourceData?.title || sourceData?.fileName || "Uploaded PDF",
    text: sc.chunk.text,
    confidence: sc.score > 0 ? 1.0 : 0.8,
    pageNumber: sc.chunk.pageNumber || null,
    questionNo: sc.chunk.questionNo || null,
    id: sc.chunk.id
  }));

  return {
    chunks: finalChunks,
    source: {
      id: activeSourceId,
      title: sourceData?.title || sourceData?.fileName || "Uploaded PDF",
      fileName: sourceData?.fileName || "uploaded_source.pdf",
      storagePath: sourceData?.storagePath || "",
      ownerUid: sourceData?.ownerUid || uid,
    },
    hasExactQuestionText,
    needsOcr
  };
}

export function checkBadTextQuality(text: string): boolean {
  if (!text) return true;
  
  // 1. Replacement char count / ratio
  const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCharCount > 3) {
    const ratio = replacementCharCount / text.length;
    if (ratio > 0.015 || replacementCharCount > 10) return true;
  }
  
  // 2. Count Sinhala unicode chars if the text contains some Sinhala indicators
  const hasSinhalaChars = /[\u0D80-\u0DFF]/.test(text);
  if (hasSinhalaChars) {
    const sinhalaCount = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
    if (sinhalaCount < 15 && replacementCharCount > 2) {
      return true;
    }
  }

  // 3. Excessive consecutive punctuation or non-alphanumeric (garbage pattern)
  const garbageSymbolsCount = (text.match(/[^a-zA-Z0-9\s\.,\?\!\"'\(\)\u0D80-\u0DFF\-\+\=\/\*]/g) || []).length;
  if (text.length > 50 && (garbageSymbolsCount / text.length > 0.25)) {
    return true;
  }

  return false;
}

export async function retrieveExactPaperQuestion({
  uid,
  sourceId,
  subject,
  year,
  questionNo,
  questionType
}: {
  uid: string;
  sourceId: string;
  subject?: string;
  year?: string;
  questionNo?: string;
  questionType?: string;
}) {
  const db = getAdminDb();
  let sourceDoc: any = null;
  let sourceData: any = null;

  // Fetch source details from past_papers or rag_sources
  try {
    const ragSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (ragSnap.exists) {
      sourceDoc = ragSnap;
      sourceData = ragSnap.data();
    } else {
      const ppSnap = await db.collection("past_papers").doc(sourceId).get();
      if (ppSnap.exists) {
        sourceDoc = ppSnap;
        sourceData = ppSnap.data();
      }
    }
  } catch (err) {
    console.warn("retrieveExactPaperQuestion: failed to fetch source document:", err);
  }

  if (!sourceData) {
    return {
      source: null,
      chunks: [],
      hasExactQuestionText: false,
      badTextQuality: false,
      needsOcr: false,
      needsLegacyConversion: false,
      reason: "Source details not found in library."
    };
  }

  const hasLegacyTextLayer = String(sourceData.textEncoding || "").startsWith("legacy_");
  const needsOcr = !hasLegacyTextLayer && (sourceData.needsOcr === true || sourceData.indexStatus === "needs_ocr");
  const needsLegacyConversion = sourceData.needsLegacyConversion === true || sourceData.indexStatus === "needs_legacy_conversion";

  if (needsOcr) {
    return {
      source: sourceData,
      chunks: [],
      hasExactQuestionText: false,
      badTextQuality: hasLegacyTextLayer,
      needsOcr,
      needsLegacyConversion,
      reason: "This source has no searchable text layer."
    };
  }

  // Query rag_chunks only where sourceId == selected sourceId
  let chunks: any[] = [];
  try {
    const chunkSnap = await db.collection("rag_chunks")
      .where("sourceId", "==", sourceId)
      .get();
    chunks = chunkSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("retrieveExactPaperQuestion: failed to fetch rag_chunks:", err);
  }

  // Filter chunks for exact MCQ matching
  let matchedChunks: any[] = [];
  let hasExactQuestionText = false;
  // Legacy font-encoded text can look like valid ASCII while representing
  // unreadable Sinhala glyph codes. Never trust it as exact question evidence;
  // force the original-PDF path instead of letting an LLM infer a question.
  let badTextQuality = hasLegacyTextLayer;

  const numOnly = questionNo ? questionNo.replace(/\D/g, "") : "";

  if (numOnly) {
    // Exact patterns requested:
    // "10." or "10)" or "(10)" or "MCQ 10" or "ප්රශ්නය 10" or "10 වන" or "10 වෙනි"
    const patterns = [
      new RegExp(`\\b${numOnly}\\.\\s`),
      new RegExp(`\\b${numOnly}\\)`),
      new RegExp(`\\(${numOnly}\\)`),
      new RegExp(`mcq\\s*${numOnly}\\b`, "i"),
      new RegExp(`(?:ප්‍රශ්නය|ප්රශ්නය)\\s*${numOnly}\\b`),
      new RegExp(`${numOnly}\\s*වන`),
      new RegExp(`${numOnly}\\s*වෙනි`)
    ];

    matchedChunks = chunks.filter(c => {
      const text = c.text || "";
      const lower = text.toLowerCase();

      // Check metadata first if present
      if (c.questionNo && String(c.questionNo).replace(/\D/g, "") === numOnly) {
        return true;
      }

      // Check text regex patterns
      const matchedText = patterns.some(p => p.test(text) || p.test(lower));
      return matchedText;
    });

    if (matchedChunks.length > 0) {
      hasExactQuestionText = true;
      // Check if matched chunks have bad quality
      const allGarbage = matchedChunks.every(c => checkBadTextQuality(c.text));
      if (allGarbage) {
        badTextQuality = true;
      }

      // The marker and MCQ options frequently cross 1,000-character chunk
      // boundaries. Include neighbouring chunks from the same pages so the
      // evidence extractor sees the complete question without guessing.
      const orderedChunks = [...chunks].sort(
        (a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0),
      );
      const selectedIds = new Set(matchedChunks.map((chunk) => String(chunk.id || chunk.chunkIndex)));
      for (const matched of [...matchedChunks]) {
        const index = orderedChunks.findIndex((chunk) =>
          String(chunk.id || chunk.chunkIndex) === String(matched.id || matched.chunkIndex),
        );
        if (index < 0) continue;
        for (let offset = -2; offset <= 2; offset += 1) {
          const neighbour = orderedChunks[index + offset];
          if (!neighbour) continue;
          const key = String(neighbour.id || neighbour.chunkIndex);
          if (selectedIds.has(key)) continue;
          selectedIds.add(key);
          matchedChunks.push(neighbour);
        }
      }
    }
  } else {
    // If no specific questionNo, return top chunks
    matchedChunks = chunks.slice(0, 5);
    if (matchedChunks.length > 0) {
      const allGarbage = matchedChunks.every(c => checkBadTextQuality(c.text));
      if (allGarbage) {
        badTextQuality = true;
      }
    }
  }

  return {
    source: {
      id: sourceId,
      ...sourceData
    },
    chunks: matchedChunks,
    hasExactQuestionText,
    badTextQuality,
    needsOcr,
    needsLegacyConversion,
    reason: matchedChunks.length > 0 ? "Exact matching chunks successfully retrieved." : "Exact question chunks missing from index."
  };
}
