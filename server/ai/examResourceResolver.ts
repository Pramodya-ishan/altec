import { getAdminDb } from "../firebase/admin";
import { pastPapersData } from "../../src/data/pastPapersData";
import { SYLLABUS } from "../../src/constants/syllabus";

export type ResolvedSource = {
  id: string;
  sourceId?: string;
  title: string;
  fileName?: string;
  subject?: string;
  year?: string;
  resourceType?: string;
  sourceType?: string;
  sourceScope?: string;
  storagePath?: string;
  ownerUid?: string;
  visibility?: string;
  chunkCount?: number;
  textIndexed?: boolean;
  needsOcr?: boolean;
  needsLegacyConversion?: boolean;
  textEncoding?: string;
  indexStatus?: string;
  ocrTextPdfStoragePath?: string;
  confidence: number;
  badge?: string;
  verified?: boolean;
  candidate?: boolean;
  snippet?: string;
  text?: string;
  pageNumber?: number;
  questionNo?: string;
  url?: string;
};

export type ExamResolutionResult = {
  ok: boolean;
  sources: ResolvedSource[];
  bestTextBlocks: string[];
  paperSource?: ResolvedSource;
  markingSchemeSource?: ResolvedSource;
  syllabusSource?: ResolvedSource;
  paperStructureSource?: ResolvedSource;
  hasExactQuestionText: boolean;
  hasPdfSource: boolean;
  hasMarkingScheme: boolean;
  hasSyllabus: boolean;
  hasPaperStructure: boolean;
  needsWebSearch: boolean;
  notFoundReason?: string;
};

export function normalizeSubject(input?: string) {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return "";
  
  const isSft = /\b(SFT|SCIENCE FOR TECHNOLOGY|තාක්ෂණවේදය සඳහා විද්‍යාව|තාක්ෂණවේදය සඳහා විද්යාව|තාක්ෂණවේදය|S\.F\.T)\b/i.test(s);
  const isEt = /\b(ET|ENGINEERING TECHNOLOGY|ඉංජිනේරු තාක්ෂණවේදය|ඉංජිනේරු තාක්ෂණය|E\.T)\b/i.test(s);
  const isIct = /\b(ICT|INFORMATION AND COMMUNICATION TECHNOLOGY|තොරතුරු හා සන්නිවේදන තාක්ෂණය|තොරතුරු සන්නිවේදන තාක්ෂණය|තොරතුරු හා සන්නිවේදන|I\.C\.T)\b/i.test(s);

  if (isSft) return "SFT";
  if (isEt) return "ET";
  if (isIct) return "ICT";
  
  return s;
}

export function subjectAliases(subject: string) {
  const norm = normalizeSubject(subject);
  if (norm === "SFT") return ["sft", "science for technology", "තාක්ෂණවේදය සඳහා විද්‍යාව", "තාක්ෂණවේදය සඳහා විද්යාව", "science for tech", "තාක්ෂණවේදය", "sft"];
  if (norm === "ET") return ["et", "engineering technology", "ඉංජිනේරු තාක්ෂණවේදය", "ඉංජිනේරු තාක්ෂණය", "engineering", "et paper", "engineering tech"];
  if (norm === "ICT") return ["ict", "information and communication technology", "තොරතුරු හා සන්නිවේදන තාක්ෂණය", "තොරතුරු හා සන්නිවේදන", "information", "communication", "තොරතුරු"];
  return [];
}

export function normalizeTitleText(src: any) {
  return [
    src.title,
    src.fileName,
    src.subject,
    src.year,
    src.resourceType,
    src.sourceType,
    src.sourceScope
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isPaperLike(src: any) {
  const rt = String(src.resourceType || "").toLowerCase();
  const st = String(src.sourceType || "").toLowerCase();
  const ss = String(src.sourceScope || "").toLowerCase();
  const title = normalizeTitleText(src);
  return (
    rt.includes("past_paper") ||
    rt.includes("model_paper") ||
    st.includes("past_paper") ||
    ss.includes("past_paper") ||
    title.includes("past paper") ||
    title.includes("paper") ||
    title.includes("full")
  );
}

export function isMarkingSchemeLike(src: any) {
  const txt = normalizeTitleText(src);
  const rt = String(src.resourceType || "").toLowerCase();
  return rt.includes("marking") || txt.includes("marking") || txt.includes("scheme") || txt.includes("answers") || txt.includes(" sm ") || txt.includes("marking_scheme");
}

export function scoreSourceMatch(src: any, params: {
  subject?: string;
  year?: string;
  resourceType?: string;
  prompt: string;
  uid: string;
  isAdmin: boolean;
  activeSourceId?: string;
}) {
  const { subject, year, resourceType, prompt, uid, isAdmin, activeSourceId } = params;
  let score = 0;

  const textToScan = normalizeTitleText(src);
  const promptLower = prompt.toLowerCase();

  // 1. Normalized Subjects
  const normTargetSub = normalizeSubject(subject || prompt);
  const srcNormSub = normalizeSubject(src.subject || textToScan);
  
  // 2. Extracted Year
  let targetYear = year;
  if (!targetYear) {
    const foundYear = prompt.match(/\b(201\d|202\d)\b/);
    if (foundYear) targetYear = foundYear[0];
  }
  const targetYearStr = targetYear ? String(targetYear) : "";
  const srcYearStr = src.year ? String(src.year) : "";

  // --- SCORING ---

  // +60 active source (User is currently looking at this)
  const srcId = src.sourceId || src.id;
  if (activeSourceId && srcId === activeSourceId) score += 60;

  // +50 storagePath exists (Real files preferred)
  if (src.storagePath) score += 50;

  // SUBJECT MATCHING
  if (normTargetSub) {
    if (srcNormSub === normTargetSub) {
      score += 40; // Direct subject match
    } else {
      const otherSubs = ["SFT", "ET", "ICT"].filter(s => s !== normTargetSub);
      const hasWrongSub = otherSubs.includes(srcNormSub) || otherSubs.some(os => {
        const osAliases = subjectAliases(os);
        return osAliases.some(alias => textToScan.includes(alias));
      });
      if (hasWrongSub) {
        score -= 100; // Penalty for wrong subject
      }
    }
  }

  // YEAR MATCHING
  if (targetYearStr) {
    if (srcYearStr === targetYearStr) {
      score += 40; // Direct year match
    } else if (textToScan.includes(targetYearStr)) {
      score += 30; // Year in title
    } else if (srcYearStr && srcYearStr !== targetYearStr) {
      score -= 100; // Penalty for wrong year
    } else {
      // Check if title contains OTHER years
      const otherYears = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"].filter(y => y !== targetYearStr);
      if (otherYears.some(oy => textToScan.includes(oy))) {
        score -= 100;
      }
    }
  }

  // TITLE KEYWORD MATCHING
  if (normTargetSub) {
     const aliases = subjectAliases(normTargetSub);
     if (aliases.some(a => textToScan.includes(a))) {
        score += 30;
     }
  }

  // Exact Subject + Year in Title
  if (normTargetSub && targetYearStr && textToScan.includes(normTargetSub.toLowerCase()) && textToScan.includes(targetYearStr)) {
    score += 50;
  }

  // RESOURCE TYPE MATCHING
  if (resourceType) {
    const srcRt = String(src.resourceType || "").toLowerCase();
    if (srcRt.includes(resourceType.toLowerCase())) {
      score += 25;
    }
  }

  const isMS = isMarkingSchemeLike(src);
  const promptWantsMS = promptLower.includes("marking") || promptLower.includes("scheme") || promptLower.includes("පිළිතුරු") || promptLower.includes("අන්සර්");
  
  if (promptWantsMS && isMS) score += 50;
  if (!promptWantsMS && isMS) score -= 30; // Prefer paper if user didn't ask for MS

  // FULL PAPER VS TUTE
  const isFullPaperPrompt = promptLower.includes("paper") || promptLower.includes("past paper") || promptLower.includes("mcq") || (targetYearStr && !promptLower.includes("lesson"));
  if (isFullPaperPrompt) {
    const isTute = textToScan.includes("tute") || textToScan.includes("lesson") || textToScan.includes("පාඩම") || textToScan.includes("revision");
    if (isTute) score -= 100;
  }

  // Ownership / Privacy
  const isOwner = src.ownerUid === uid;
  if (isOwner) {
    score += 20;
  } else {
    const isPrivate = src.visibility === "private" || src.sourceScope === "owner_syllabus";
    if (isPrivate && !isAdmin) {
      score -= 500; // Cannot access
    }
  }

  return score;
}

export async function resolveExamResources(params: {
  prompt: string;
  uid: string;
  email?: string;
  isAdmin?: boolean;
  subject?: string;
  year?: string;
  resourceType?: "past_paper" | "marking_scheme";
  questionNo?: string;
  lesson?: string;
  needQuestionText?: boolean;
  needPdfLink?: boolean;
  needMarkingScheme?: boolean;
  needSyllabus?: boolean;
  needPaperStructure?: boolean;
}): Promise<ExamResolutionResult> {
  const {
    prompt,
    uid,
    email,
    subject,
    year,
    resourceType,
    questionNo,
    lesson,
  } = params;

  const db = getAdminDb();
  const sources: ResolvedSource[] = [];
  const bestTextBlocks: string[] = [];

  let activeSourceId: string | undefined = undefined;
  if (uid) {
    try {
      const chatCtxDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
      if (chatCtxDoc.exists) {
        const data = chatCtxDoc.data();
        if (data && data.activePdf && data.activePdf.sourceId) {
          activeSourceId = data.activePdf.sourceId;
        } else if (data && Array.isArray(data.temporaryPdfs) && data.temporaryPdfs.length > 0) {
          activeSourceId = data.temporaryPdfs[0].sourceId;
        }
      }
    } catch (err: any) {
      console.warn("Failed to retrieve current chat_context activeSourceId in resolver:", err.message);
    }
  }

  const normSubject = normalizeSubject(subject || prompt);
  const normYear = year ? String(year) : undefined;
  const normQuestion = questionNo ? String(questionNo).toUpperCase() : undefined;

  const isAdmin = params.isAdmin === true;

  // Local static paper keys check
  try {
    if (pastPapersData && pastPapersData.papers) {
      const matchedPaper = pastPapersData.papers.find((p: any) => {
        const pSub = normalizeSubject(p.metadata?.subjectKey || "");
        const pExam = p.metadata?.exam || "";
        const matchesSub = pSub === normSubject;
        const matchesYear = !year || pExam.includes(String(year));
        return matchesSub && matchesYear;
      });

      if (matchedPaper && normQuestion) {
        const ansObj = matchedPaper.answers.find((a: any) => String(a.question) === normQuestion.replace("Q", ""));
        if (ansObj) {
          sources.push({
            id: `local_ans_${normSubject}_${normYear || "all"}_${normQuestion}`,
            title: `${matchedPaper.metadata.exam} SFT MCQ Answer key - ${normQuestion}`,
            subject: normSubject,
            year: normYear,
            resourceType: "marking_scheme",
            questionNo: normQuestion,
            text: `Question ${normQuestion} Answer: Option ${ansObj.answer}`,
            confidence: 0.95,
            verified: true,
            candidate: false,
            badge: "Local Key",
          });
        }
      }
    }
  } catch (err) {
    console.warn("Local pastPapersData resolve failed:", err);
  }

  // Static syllabus check
  try {
    if (SYLLABUS && normSubject) {
      const sKey = normSubject.toLowerCase();
      const sDef = (SYLLABUS as any)[sKey];
      if (sDef) {
        let textStr = `Static Syllabus fallback for ${normSubject}:\n`;
        if (sDef.mcqItems) {
          textStr += `MCQ Weights:\n` + sDef.mcqItems.map((i: any) => `- ${i.q}: ${i.title} (${i.count} questions)`).join("\n") + "\n";
        }
        if (sDef.partAItems) {
          textStr += `Part A Structural Weights:\n` + sDef.partAItems.map((i: any) => `- ${i.q}: ${i.title} (${i.subTitle || i.topics?.join(", ") || ""}) max marks ${i.max}`).join("\n") + "\n";
        }
        if (sDef.bcdGroups) {
          textStr += `Part B/C/D Weights:\n` + sDef.bcdGroups.map((g: any) => `Group ${g.title} (${g.label}):\n` + g.items.map((i: any) => `  - ${i.q}: max marks ${i.max}, topics: ${i.topics?.join(", ") || ""}`).join("\n")).join("\n") + "\n";
        }

        sources.push({
          id: `static_syllabus_${normSubject}`,
          title: `Fallback static structure for ${normSubject}`,
          subject: normSubject,
          confidence: 0.7,
          verified: true,
          candidate: false,
          badge: "Static Syllabus",
          text: textStr,
        });
      }
    }
  } catch (err) {
    console.warn("Static syllabus resolve failed:", err);
  }

  // Collect raw documents from Firestore collections
  const rawCandidates: any[] = [];

  // 1. past_papers
  try {
    const ppSnap = await db.collection("past_papers").limit(100).get();
    ppSnap.forEach((doc: any) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "past_papers" });
    });
  } catch (err) {
    console.warn("Broad past_papers query failed:", err);
  }

  // 2. rag_sources (owned and public/shared)
  try {
    const ragPublicSnap = await db.collection("rag_sources").where("visibility", "in", ["public", "official", "shared"]).limit(100).get();
    ragPublicSnap.forEach((doc: any) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "rag_sources" });
    });

    const ragOwnedSnap = await db.collection("rag_sources").where("ownerUid", "==", uid).limit(100).get();
    ragOwnedSnap.forEach((doc: any) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "rag_sources" });
    });
  } catch (err) {
    console.warn("Broad rag_sources query failed:", err);
  }

  // 3. users/{uid}/syllabus_resources
  try {
    const userSyllSnap = await db.collection("users").doc(uid).collection("syllabus_resources").limit(100).get();
    userSyllSnap.forEach((doc: any) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "syllabus_resources" });
    });
  } catch (err) {
    console.warn("Broad user syllabus_resources query failed:", err);
  }

  // Deduplicate raw candidates by id
  const seenIds = new Set<string>();
  const uniqueCandidates: any[] = [];
  for (const c of rawCandidates) {
    const cid = c.sourceId || c.id;
    if (cid && !seenIds.has(cid)) {
      seenIds.add(cid);
      uniqueCandidates.push(c);
    }
  }

  // Score unique candidates and select top matches with score >= 35
  const scoredCandidates = uniqueCandidates.map(c => {
    const score = scoreSourceMatch(c, {
      subject: subject || normSubject,
      year: year || normYear,
      resourceType,
      prompt,
      uid,
      isAdmin,
      activeSourceId
    });
    return { doc: c, score };
  });

  // Filter candidates that meet threshold and privacy
  const validMatched = scoredCandidates
    .filter(sc => {
      if (sc.score < 35) return false;
      const doc = sc.doc;
      // Access check: allow if: src.ownerUid == uid OR isAdmin OR visibility in ["official","shared","public"]
      const isOwner = doc.ownerUid === uid;
      const isPublic = ["official", "shared", "public"].includes(doc.visibility);
      if (!isOwner && !isPublic && !isAdmin) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  // Map candidates to ResolvedSource objects
  const metadataSources: ResolvedSource[] = validMatched.map(m => {
    const doc = m.doc;
    const cid = doc.sourceId || doc.id;
    let badge = "Library File";
    if (doc._sourceCol === "past_papers" || doc.resourceType === "past_paper") {
      badge = isMarkingSchemeLike(doc) ? "Marking Scheme" : "Past Paper";
    } else if (doc._sourceCol === "syllabus_resources" || doc.sourceScope === "owner_syllabus") {
      badge = "My Library";
    } else if (doc.sourceScope === "paper_structure") {
      badge = "Paper Structure";
    }

    return {
      id: cid,
      sourceId: cid,
      title: doc.title || doc.fileName || "RAG Source",
      fileName: doc.fileName || doc.title || "document.pdf",
      subject: normalizeSubject(doc.subject),
      year: doc.year ? String(doc.year) : undefined,
      resourceType: doc.resourceType || doc.sourceType || "past_paper",
      sourceType: doc.sourceType || doc.resourceType || "past_paper",
      sourceScope: doc.sourceScope || "personal",
      storagePath: doc.storagePath,
      ownerUid: doc.ownerUid,
      visibility: doc.visibility || "private",
      chunkCount: Number(doc.chunkCount || 0),
      textIndexed: Number(doc.chunkCount || 0) > 0 && doc.needsOcr !== true,
      needsOcr: doc.needsOcr === true,
      needsLegacyConversion: doc.needsLegacyConversion === true,
      textEncoding: doc.textEncoding || "unknown",
      indexStatus: doc.indexStatus || "ready",
      confidence: m.score / 150, // normalize confidence roughly
      badge,
      url: doc.url || `/api/rag/sources/${cid}/download`
    };
  });

  sources.push(...metadataSources);

  // Fetch text chunks from top matched source ONLY
  try {
    const matchedSourceIds = metadataSources.map(s => s.id);
    if (matchedSourceIds.length > 0) {
      const chunkRef = db.collection("rag_chunks");
      const bestChunks: any[] = [];
      const targetSourceIds = [metadataSources[0].id];

      for (const srcId of targetSourceIds) {
        const chunkSnap = await chunkRef.where("sourceId", "==", srcId).limit(20).get();
        chunkSnap.forEach((doc: any) => {
          const data = doc.data();
          const textContent = data.text || "";
          
          const numOnly = normQuestion ? normQuestion.replace(/\D/g, "") : "";
          let matchesQuestion = false;
          if (numOnly) {
            const patterns = [
              new RegExp(`\\b${numOnly}\\.\\s`),
              new RegExp(`\\b${numOnly}\\)`),
              new RegExp(`\\(${numOnly}\\)`),
              new RegExp(`mcq\\s*${numOnly}\\b`, "i"),
              new RegExp(`(?:ප්‍රශ්නය|ප්රශ්නය)\\s*${numOnly}\\b`),
              new RegExp(`${numOnly}\\s*වන`),
              new RegExp(`${numOnly}\\s*වෙනි`),
              new RegExp(`\\bQ${numOnly}\\b`, "i"),
              new RegExp(`\\bQuestion\\s*${numOnly}\\b`, "i"),
            ];
            matchesQuestion = patterns.some(p => p.test(textContent) || p.test(textContent.toLowerCase()));
          }

          if (normQuestion && !matchesQuestion) {
            return; // Skip mismatching questions if question is explicit
          }

          bestChunks.push({
            id: doc.id,
            title: `Excerpt from: ${data.title || data.sourceId}`,
            subject: normalizeSubject(data.subject),
            year: data.year,
            resourceType: data.resourceType,
            questionNo: data.questionNo || (matchesQuestion ? normQuestion : undefined),
            text: textContent,
            pageNumber: data.pageNumber,
            confidence: matchesQuestion ? 0.95 : 0.8,
            verified: true,
            candidate: false,
            badge: "Text Chunk",
          });
        });
      }

      sources.push(...bestChunks);
      bestChunks.forEach(c => {
        if (c.text) bestTextBlocks.push(c.text);
      });
    }
  } catch (err) {
    console.warn("rag_chunks query resolve failed:", err);
  }

  // Compute overall status and sources
  const paperSource = sources.find(s => isPaperLike(s) && !!s.storagePath);
  const markingSchemeSource = sources.find(s => isMarkingSchemeLike(s) && (!!s.storagePath || s.badge === "Local Key"));
  const syllabusSource = sources.find(s => s.badge === "My Library" || s.badge === "Static Syllabus" || s.resourceType === "syllabus");
  const paperStructureSource = sources.find(s => s.badge === "Paper Structure" || s.resourceType === "paper_structure");

  let hasExactQuestionText = sources.some(s => s.badge === "Local Key");
  if (!hasExactQuestionText && normQuestion) {
    const numOnly = normQuestion.replace(/\D/g, "");
    if (numOnly) {
      const patterns = [
        new RegExp(`\\b${numOnly}\\.\\s`),
        new RegExp(`\\b${numOnly}\\)`),
        new RegExp(`\\(${numOnly}\\)`),
        new RegExp(`mcq\\s*${numOnly}\\b`, "i"),
        new RegExp(`(?:ප්‍රශ්නය|ප්රශ්නය)\\s*${numOnly}\\b`),
        new RegExp(`${numOnly}\\s*වන`),
        new RegExp(`${numOnly}\\s*වෙනි`),
        new RegExp(`\\bQ${numOnly}\\b`, "i"),
        new RegExp(`\\bQuestion\\s*${numOnly}\\b`, "i"),
      ];
      hasExactQuestionText = bestTextBlocks.some(t => patterns.some(p => p.test(t) || p.test(t.toLowerCase())));
    }
  }

  const hasPdfSource = !!(paperSource?.storagePath || paperSource?.url);
  const hasMarkingScheme = !!(markingSchemeSource?.storagePath || markingSchemeSource?.url || markingSchemeSource?.text);
  const hasSyllabus = !!syllabusSource;
  const hasPaperStructure = !!paperStructureSource || !!sources.find(s => s.badge === "Static Syllabus");

  // Determine if web candidates are required
  const userRequestedWeb = prompt.toLowerCase().includes("web") ||
                           prompt.toLowerCase().includes("search") ||
                           prompt.toLowerCase().includes("google") ||
                           prompt.toLowerCase().includes("latest") ||
                           prompt.toLowerCase().includes("internet");

  const localFailed = sources.length === 0;
  // If selected source exists, do NOT web search.
  const needsWebSearch = userRequestedWeb || (localFailed && !hasPdfSource && !hasMarkingScheme && !!normSubject && !!normYear);

  return {
    ok: sources.length > 0,
    sources,
    bestTextBlocks,
    paperSource,
    markingSchemeSource,
    syllabusSource,
    paperStructureSource,
    hasExactQuestionText,
    hasPdfSource,
    hasMarkingScheme,
    hasSyllabus,
    hasPaperStructure,
    needsWebSearch: hasPdfSource ? false : needsWebSearch,
    notFoundReason: sources.length === 0 ? "No matched database or syllabus documents found." : undefined,
  };
}
