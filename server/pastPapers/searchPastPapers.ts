import { getAdminDb } from "../firebase/admin";
import { groundedSearch } from "../ai/tools/googleSearchGrounding";

export type PastPaperSearchResult = {
  ok: boolean;
  sourceCards: Array<{
    title: string;
    url: string;
    source: string;
    type: "paper" | "marking" | "mcq" | "essay" | "structured" | "unknown";
    confidence: number;
    snippet?: string;
  }>;
};

export async function searchPastPapers(params: {
  year?: string;
  subject?: string;
  paperType?: string;
  query: string;
  uid?: string;
}): Promise<PastPaperSearchResult> {
  const { year, subject, paperType, query, uid } = params;
  
  const sourceCards: PastPaperSearchResult["sourceCards"] = [];

  // 1. Search Firestore past_papers (simulated structure)
  try {
    const db = getAdminDb();
    let fsQuery: any = db.collection("past_papers");
    
    if (year) fsQuery = fsQuery.where("year", "==", year);
    if (subject) fsQuery = fsQuery.where("subject", "==", subject);
    
    const snapshot = await fsQuery.limit(5).get();
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      sourceCards.push({
        title: data.title || `${year} ${subject} Past Paper`,
        url: data.storagePath || data.url || data.downloadUrl,
        source: "Firestore (Official)",
        type: data.paperType || "paper",
        confidence: 1.0,
      });
    });
  } catch (error) {
    console.warn("Firestore past_papers search failed:", error);
  }

  // 2. Search Uploaded user RAG for this UID
  if (uid) {
    try {
      const db = getAdminDb();
      let ragQuery: any = db.collection("rag_sources")
        .where("ownerUid", "==", uid);
        
      if (year) ragQuery = ragQuery.where("year", "==", year);
      if (subject) ragQuery = ragQuery.where("subject", "==", subject);
      
      const snapshot = await ragQuery.limit(5).get();
      
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        sourceCards.push({
          title: data.title || data.fileName,
          url: data.storagePath || data.downloadUrl || "#",
          source: "Uploaded PDF",
          type: data.paperType || "paper",
          confidence: 0.9,
        });
      });
    } catch (error: any) {
      console.warn("Firestore rag_sources search failed:", error.message || error);
    }
  }

  // 3. Fallback to Google Search Grounding if no perfect match found locally
  if (sourceCards.length === 0 && year && subject) {
    const subjectFullName = subject.toUpperCase() === "SFT" ? "Science for Technology" 
                          : subject.toUpperCase() === "ET" ? "Engineering Technology" 
                          : subject.toUpperCase() === "ICT" ? "Information and Communication Technology" : subject;
    
    const searchQueries = [
      `${year} GCE A/L ${subjectFullName} past paper PDF Sri Lanka`,
      `${year} A/L ${subject} paper filetype:pdf`
    ];
    
    if (paperType === "marking") {
      searchQueries.unshift(`${year} ${subjectFullName} marking scheme PDF Sri Lanka`);
    }
    
    try {
      const searchRes = await groundedSearch(searchQueries[0]);
      
      for (const src of searchRes.sources) {
        // Validate
        const titleLower = src.title.toLowerCase();
        const urlLower = src.url.toLowerCase();
        
        const yearMatch = titleLower.includes(year) || urlLower.includes(year);
        const subjectMatch = titleLower.includes(subject.toLowerCase()) || urlLower.includes(subject.toLowerCase());
        const urlLooksPdf = urlLower.endsWith(".pdf") || titleLower.includes("pdf");
        
        let confidence = 0.5;
        if (yearMatch && subjectMatch) confidence += 0.3;
        if (urlLooksPdf) confidence += 0.2;
        
        if (confidence > 0.6) {
          sourceCards.push({
            title: src.title,
            url: src.url,
            source: "Web Search (Candidate)",
            type: paperType as any || "paper",
            confidence,
            snippet: src.snippet,
          });
        }
      }
    } catch (error) {
      console.warn("Google Search Grounding fallback failed:", error);
    }
  }

  // Sort by confidence descending
  sourceCards.sort((a, b) => b.confidence - a.confidence);

  return {
    ok: true,
    sourceCards: sourceCards.slice(0, 5), // Return top 5
  };
}
