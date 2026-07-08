import { getAdminDb } from "../firebase/admin";
import { getAIClient } from "../ai/client";
import { pastPapersData } from "../../src/data/pastPapersData";

export async function searchPastPapers(req: any, res: any) {
  try {
    const { query: searchQuery, yearMatch, subjectMatch } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ ok: false, error: "Query is required" });
    }

    const db = getAdminDb();
    const sourceCards: any[] = [];

    // Step 1: Local Search (from pastPapersData)
    const localPapers = pastPapersData.papers || [];
    localPapers.forEach((p: any) => {
      const pSubject = p.metadata.subjectKey || "";
      const pSubjectFull = p.metadata.subject || "";
      const pExam = p.metadata.exam || "";

      const matchSubject = !subjectMatch || 
        pSubject.toLowerCase() === subjectMatch.toLowerCase() || 
        pSubjectFull.toLowerCase().includes(subjectMatch.toLowerCase());

      const matchYear = !yearMatch || pExam.includes(yearMatch.toString());

      if (matchSubject && matchYear) {
        const paperYear = pExam.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || yearMatch || "unknown";
        sourceCards.push({
          source: "Local Database",
          title: `${pExam} - ${pSubjectFull} MCQ Answer Key`,
          url: `/api/past-papers/local/${pSubject.toLowerCase()}/${paperYear}`,
          type: "Answer Sheet",
          snippet: `Official MCQ answer sheet keys for ${pExam} ${pSubjectFull} (${p.metadata.medium || "Sinhala"} medium). Contains ${p.answers.length} verified MCQ answers.`
        });
      }
    });

    // Step 2: Firestore Search (from past_papers collection)
    try {
      let fRef: any = db.collection("past_papers");
      if (subjectMatch) {
        fRef = fRef.where("subject", "==", subjectMatch.toLowerCase());
      }
      if (yearMatch) {
        fRef = fRef.where("year", "==", yearMatch.toString());
      }
      
      const fSnap = await fRef.get();
      fSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        const matchesSearch = !searchQuery || 
          data.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (data.year && data.year.toString().includes(searchQuery));

        if (matchesSearch) {
          sourceCards.push({
            source: "Firestore Storage",
            title: data.title,
            url: data.url,
            type: data.type || "PDF",
            snippet: `${data.year || ""} ${data.subject || ""} G.C.E. A/L past paper or marking scheme document uploaded to Clora storage.`
          });
        }
      });
    } catch (e) {
      console.warn("Firestore past_papers query failed:", e);
    }

    // Step 3: Google Search Grounding (Gemini API with Google Search tool)
    const yearStr = yearMatch || "";
    const subjectStr = subjectMatch || "";
    
    // Formulate clean Sinhalese target search query
    const googleQuery = `GCE A/L ${yearStr} ${subjectStr} past paper marking scheme Sinhala Medium PDF ${searchQuery}`;
    
    if (process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true") try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",
        contents: `Find official, verified download links or PDFs for G.C.E. A/L past papers or marking schemes. Query: ${googleQuery}. Target year: ${yearStr}, Subject: ${subjectStr}. Return only actual sources.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const groundingMetadata = (response.candidates?.[0] as any)?.groundingMetadata;
      if (groundingMetadata && groundingMetadata.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            const title = chunk.web.title;
            const url = chunk.web.uri;
            const snippet = chunk.web.snippet || "";

            // Strictly filter by yearMatch and subjectMatch
            let keep = true;
            if (yearMatch) {
              const yr = yearMatch.toString();
              if (!title.includes(yr) && !url.includes(yr) && !snippet.includes(yr)) {
                keep = false;
              }
            }
            if (subjectMatch) {
              const sub = subjectMatch.toLowerCase();
              const fullSubName = sub === 'sft' ? 'science' : sub === 'et' ? 'engineering' : sub === 'ict' ? 'ict' : sub;
              if (!title.toLowerCase().includes(sub) && !title.toLowerCase().includes(fullSubName) &&
                  !url.toLowerCase().includes(sub) && !url.toLowerCase().includes(fullSubName) &&
                  !snippet.toLowerCase().includes(sub) && !snippet.toLowerCase().includes(fullSubName)) {
                keep = false;
              }
            }

            // Clean generic search noise
            if (url.includes("google.com/search") || url.includes("google.lk/search")) {
              keep = false;
            }

            if (keep) {
              sourceCards.push({
                source: "Google Search",
                title,
                url,
                type: "Web Resource",
                snippet
              });
            }
          }
        });
      }
    } catch (err) {
      console.error("Google search grounding failed:", err);
    }

    // Deduplicate source cards uniquely by URL
    const uniqueSourceCards: any[] = [];
    const seenUrls = new Set<string>();
    sourceCards.forEach(card => {
      if (card.url && !seenUrls.has(card.url)) {
        seenUrls.add(card.url);
        uniqueSourceCards.push(card);
      }
    });

    res.json({
      ok: true,
      query: searchQuery,
      yearMatch: yearMatch || null,
      subjectMatch: subjectMatch || null,
      sourceCards: uniqueSourceCards,
      message: uniqueSourceCards.length
        ? "Verified source cards found."
        : "No verified PDF or local paper was found. Upload a paper/source file to index it."
    });

  } catch (error: any) {
    console.error("Past Paper Search failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
