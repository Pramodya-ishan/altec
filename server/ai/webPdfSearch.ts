import { groundedSearch } from "./tools/googleSearchGrounding";

export type WebCandidate = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  subject?: string;
  year?: string;
  resourceType?: string;
  confidence: number;
  verified: boolean;
  candidate: boolean;
  badge: string;
  reason?: string;
};

export async function searchWebPdfCandidates(params: {
  subject: string;
  year: string;
  resourceType?: "past_paper" | "marking_scheme" | "syllabus" | string;
  questionNo?: string;
  medium?: string;
  prompt?: string;
}): Promise<WebCandidate[]> {
  const { subject, year, resourceType, questionNo, medium } = params;

  const subjectFullName = subject.toUpperCase() === "SFT" ? "Science for Technology"
                        : subject.toUpperCase() === "ET" ? "Engineering Technology"
                        : subject.toUpperCase() === "ICT" ? "Information and Communication Technology" : subject;

  const sinhalaSubjectName = subject.toUpperCase() === "SFT" ? "තාක්ෂණවේදය සඳහා විද්‍යාව"
                           : subject.toUpperCase() === "ET" ? "ඉංජිනේරු තාක්ෂණවේදය"
                           : subject.toUpperCase() === "ICT" ? "තොරතුරු හා සන්නිවේදන තාක්ෂණය" : subject;

  const queries: string[] = [];

  const typeLabel = resourceType === "marking_scheme" ? "marking scheme" : "past paper";
  const sinhalaTypeLabel = resourceType === "marking_scheme" ? "පිළිතුරු පත්‍රය" : "ප්‍රශ්න පත්‍රය";

  queries.push(`${year} GCE A/L ${subjectFullName} ${typeLabel} PDF Sri Lanka`);
  queries.push(`${year} A/L ${subject} ${typeLabel} Sinhala PDF`);
  queries.push(`${year} G.C.E. A/L ${sinhalaSubjectName} ${sinhalaTypeLabel} PDF`);

  const candidates: WebCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const q of queries) {
    try {
      const searchRes = await groundedSearch(q, { language: "si" });
      
      for (const src of searchRes.sources) {
        if (seenUrls.has(src.url)) continue;
        
        const titleLower = src.title.toLowerCase();
        const urlLower = src.url.toLowerCase();
        const snippetLower = (src.snippet || "").toLowerCase();

        // Check verification constraints
        const matchesYear = titleLower.includes(String(year)) || urlLower.includes(String(year)) || snippetLower.includes(String(year));
        const matchesSubject = titleLower.includes(subject.toLowerCase()) || 
                             urlLower.includes(subject.toLowerCase()) || 
                             titleLower.includes(subjectFullName.toLowerCase()) || 
                             titleLower.includes(sinhalaSubjectName.toLowerCase()) ||
                             snippetLower.includes(sinhalaSubjectName.toLowerCase());

        let confidence = 0.45;
        if (matchesYear) confidence += 0.15;
        if (matchesSubject) confidence += 0.15;
        if (urlLower.endsWith(".pdf")) confidence += 0.15;

        // Ensure we avoid search index landing pages that are just noise
        if (urlLower.includes("google.com") || urlLower.includes("google.lk")) {
          continue;
        }

        seenUrls.add(src.url);

        candidates.push({
          id: `web_cand_${Date.now()}_${Math.random().toString(36).substring(4, 8)}`,
          title: src.title || `${year} ${subject} ${resourceType} PDF Candidate`,
          url: src.url,
          snippet: src.snippet,
          subject,
          year,
          resourceType,
          confidence: Math.min(confidence, 0.9),
          verified: false,
          candidate: true,
          badge: "Candidate Web PDF",
          reason: `Matches ${year} ${subject} based on search relevance.`,
        });
      }
    } catch (e) {
      console.warn(`Web candidate search query failed: "${q}"`, e);
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates.slice(0, 5); // Return top 5 candidates
}
