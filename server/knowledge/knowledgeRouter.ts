import { getAIClient } from "../ai/client";
import { checkAiBillingCircuit, handleAiError } from "../ai/aiCircuitBreaker";
import { classifyAiError } from "../ai/aiErrorClassifier";
import { GoogleGenAI } from "@google/genai";

export type KnowledgeRouterResult = {
  mode:
    | "normal_chat"
    | "past_paper_search"
    | "web_search"
    | "url_context"
    | "uploaded_pdf_qa"
    | "uploaded_pdf_question_qa"
    | "rag_qa"
    | "image_generation"
    | "pdf_link_request"
    | "paper_question_qa"
    | "marking_scheme_request"
    | "lesson_marks_intent"
    | "pdf_inventory_request"
    | "zscore_prediction";

  entities: {
    year?: string;
    subject?: "SFT" | "ET" | "ICT";
    paperType?: "paper" | "marking" | "mcq" | "essay" | "structured" | "unknown";
    urls?: string[];
    needsClarification?: boolean;
    clarificationQuestion?: string;
    questionNo?: string;
    resourceType?: "past_paper" | "marking_scheme" | "uploaded_pdf";
    lesson?: string;
    uploadedFileName?: string;
    requestedAnswerType?: "essay" | "mcq";
  };

  contextBlocks: Array<{
    sourceType: "firestore" | "rag" | "web" | "url" | "uploaded_pdf" | "syllabus";
    title: string;
    url?: string;
    text: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;

  answerHints: {
    mustUseGoogleSearch: boolean;
    mustUseUrlContext: boolean;
    mustUseRag: boolean;
    mustAskClarification: boolean;
  };
};

function parseDeterministicIntent(prompt: string, activeSubject?: string): Partial<KnowledgeRouterResult> | null {
  const lower = prompt.toLowerCase();

  // PDF Inventory request check
  const isPdfInventory = lower.includes("give all pdfs") ||
    lower.includes("all pdfs") ||
    lower.includes("mage pdf") ||
    lower.includes("thiyena pdf") ||
    lower.includes("firebase eke") ||
    lower.includes("uploaded pdfs") ||
    lower.includes("past papers list") ||
    lower.includes("syllabus pdf") ||
    lower.includes("paper structure pdf") ||
    lower.includes("pdf list") ||
    lower.includes("පීඩීඑෆ් ලිස්ට්") ||
    lower.includes("පීඩීඑෆ් ටික") ||
    lower.includes("tika denna") ||
    lower.includes("tika ko");
  
  if (isPdfInventory) {
    return {
      mode: "pdf_inventory_request" as any,
      entities: {
        subject: activeSubject as any,
      },
      answerHints: {
        mustUseRag: true,
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustAskClarification: false
      }
    };
  }

  // Uploaded PDF Question Q&A Intent check
  const pdfMatch = prompt.match(/\[Uploaded PDF:\s*([^\]]+)\]/i);
  if (pdfMatch) {
    const uploadedFileName = pdfMatch[1].trim();
    
    let questionNo: string | undefined = undefined;
    if (lower.includes("1st") || lower.includes("first") || lower.includes("q1") || lower.includes("question 1") || lower.includes("question 01") || lower.includes("palaweni") || lower.includes("පළවෙනි") || lower.includes("පළමු")) {
      questionNo = "Q1";
    } else if (lower.includes("2nd") || lower.includes("second") || lower.includes("q2") || lower.includes("question 2") || lower.includes("question 02") || lower.includes("deweni") || lower.includes("දෙවෙනි") || lower.includes("දෙවන")) {
      questionNo = "Q2";
    } else if (lower.includes("3rd") || lower.includes("third") || lower.includes("q3") || lower.includes("question 3") || lower.includes("question 03") || lower.includes("thunweni") || lower.includes("තුන්වෙනි") || lower.includes("තුන්වන")) {
      questionNo = "Q3";
    }

    let requestedAnswerType: "essay" | "mcq" | undefined = undefined;
    if (lower.includes("essay") || lower.includes("structured essay") || lower.includes("රචනා")) {
      requestedAnswerType = "essay";
    } else if (lower.includes("mcq")) {
      requestedAnswerType = "mcq";
    }

    const hasQ = questionNo || requestedAnswerType || lower.includes("question") || lower.includes("ප්‍රශ්නය") || lower.includes("ප්‍රශ්න") || lower.includes("hdn") || lower.includes("hadana") || lower.includes("hadanna") || lower.includes("essay");
    if (hasQ) {
      return {
        mode: "uploaded_pdf_question_qa",
        entities: {
          uploadedFileName,
          questionNo,
          requestedAnswerType,
          subject: activeSubject as any,
          resourceType: "uploaded_pdf"
        },
        answerHints: {
          mustUseRag: true,
          mustUseGoogleSearch: false,
          mustUseUrlContext: false,
          mustAskClarification: false
        }
      };
    }
  }

  // 1. Z-Score / Rank Check
  if (
    lower.includes("zscore") ||
    lower.includes("z score") ||
    lower.includes("zcore") ||
    lower.includes("rank") ||
    lower.includes("district rank") ||
    lower.includes("island rank") ||
    lower.includes("z-score") ||
    lower.includes("මගේ z") ||
    lower.includes("target z")
  ) {
    return {
      mode: "zscore_prediction",
      entities: {
        subject: undefined,
        year: undefined,
      }
    };
  }

  // 2. Extract Subject
  let subject: "SFT" | "ET" | "ICT" | undefined = undefined;
  if (lower.includes("sft") || lower.includes("science for technology") || lower.includes("තාක්ෂණවේදය සඳහා විද්‍යාව") || lower.includes("විද්‍යාව")) {
    subject = "SFT";
  } else if (lower.includes("et") || lower.includes("engineering technology") || lower.includes("ඉංජිනේරු තාක්ෂණවේදය") || lower.includes("ඉංජිනේරු")) {
    subject = "ET";
  } else if (lower.includes("ict") || lower.includes("information technology") || lower.includes("තොරතුරු හා සන්නිවේදන") || lower.includes("තොරතුරු තාක්ෂණය") || lower.includes("තොරතුරු")) {
    subject = "ICT";
  }

  if (!subject && activeSubject) {
    const sUpper = activeSubject.toUpperCase();
    if (sUpper === "SFT") subject = "SFT";
    else if (sUpper === "ET") subject = "ET";
    else if (sUpper === "ICT") subject = "ICT";
  }

  // 3. Extract Year (2015 - 2026)
  let year: string | undefined = undefined;
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // 4. Extract Question Number
  let questionNo: string | undefined = undefined;
  const mcqMatch = lower.match(/\bmcq\s*[-_]?\s*(\d+)\b/);
  const qMatch = lower.match(/\b(?:q|question)\s*[-_]?\s*(\d+)\b/);
  const sinhalaNoMatch = lower.match(/\b(\d+)\s*(?:වෙනි|වැනි|th|st|nd|rd)\b/i);

  if (mcqMatch) {
    questionNo = parseInt(mcqMatch[1]).toString();
  } else if (qMatch) {
    questionNo = parseInt(qMatch[1]).toString();
  } else if (sinhalaNoMatch) {
    questionNo = parseInt(sinhalaNoMatch[1]).toString();
  } else if (lower.includes("palaweni") || lower.includes("first") || lower.includes("1st") || lower.includes("පළවෙනි") || lower.includes("පළමු")) {
    questionNo = "1";
  } else if (lower.includes("deweni") || lower.includes("second") || lower.includes("2nd") || lower.includes("දෙවෙනි") || lower.includes("දෙවන")) {
    questionNo = "2";
  } else if (lower.includes("thunweni") || lower.includes("third") || lower.includes("3rd") || lower.includes("තුන්වෙනි") || lower.includes("තුන්වන")) {
    questionNo = "3";
  } else if (lower.includes("හතරවෙනි") || lower.includes("fourth") || lower.includes("4th")) {
    questionNo = "4";
  } else if (lower.includes("පස්වෙනි") || lower.includes("fifth") || lower.includes("5th")) {
    questionNo = "5";
  }

  // 5. Lesson marks intent
  const isLessonMarks = lower.includes("marks") || lower.includes("ලකුණු") || lower.includes("lkunu") || lower.includes("weighting");
  const isSyllabusOrLesson = lower.includes("lesson") || lower.includes("පාඩම") || lower.includes("විද්‍යුතය") || lower.includes("electrical") || lower.includes("electronics") || lower.includes("python") || lower.includes("networking") || lower.includes("civil");
  
  if (isLessonMarks && isSyllabusOrLesson && !questionNo && !year) {
    return {
      mode: "lesson_marks_intent",
      entities: {
        subject,
        lesson: prompt,
      }
    };
  }

  // 6. Paper question QA
  const isPastPaperTerm = lower.includes("past paper") || lower.includes("paper") || lower.includes("ප්‍රශ්න පත්‍ර");
  const isMarkingSchemeTerm = lower.includes("marking scheme") || lower.includes("marking") || lower.includes("පිළිතුරු පත්‍රය") || lower.includes("marking schem");

  if (questionNo && (year || isPastPaperTerm || isMarkingSchemeTerm)) {
    if (isMarkingSchemeTerm) {
      return {
        mode: "marking_scheme_request",
        entities: {
          subject,
          year,
          questionNo,
          resourceType: "marking_scheme",
          paperType: "marking"
        }
      };
    }
    return {
      mode: "paper_question_qa",
      entities: {
        subject,
        year,
        questionNo,
        resourceType: "past_paper",
        paperType: "paper"
      }
    };
  }

  // 7. PDF Link Request
  const isDownloadOrLink = lower.includes("download") || lower.includes("link") || lower.includes("pdf") || lower.includes("ලින්ක්") || lower.includes("ඩවුන්ලෝඩ්") || lower.includes("පීඩීඑෆ්");
  if (isDownloadOrLink && (year || isPastPaperTerm || isMarkingSchemeTerm)) {
    return {
      mode: "pdf_link_request",
      entities: {
        subject,
        year,
        resourceType: isMarkingSchemeTerm ? "marking_scheme" : "past_paper",
        paperType: isMarkingSchemeTerm ? "marking" : "paper"
      }
    };
  }

  return null;
}

export async function routeKnowledgeRequest({
  prompt,
  uid,
  email,
  subject,
  activeSubject,
  files,
  conversationHistory,
}: {
  prompt: string;
  uid?: string;
  email?: string;
  subject?: string;
  activeSubject?: string;
  files?: any[];
  conversationHistory?: any[];
}): Promise<KnowledgeRouterResult> {
  const deterministic = parseDeterministicIntent(prompt, activeSubject || subject);
  if (deterministic) {
    return {
      mode: deterministic.mode as any,
      entities: deterministic.entities as any,
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: deterministic.mode === "web_search",
        mustUseUrlContext: false,
        mustUseRag: true,
        mustAskClarification: false,
      }
    };
  }

  
  if (process.env.ENABLE_LLM_ROUTER !== "true") {
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false,
      },
    };
  }

  try {
    checkAiBillingCircuit();
  } catch (err) {
    console.warn("Skipping LLM knowledge routing due to AI billing circuit open.");
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false,
      },
    };
  }
  
  const ai = getAIClient();
  const systemInstruction = `
You are an intent extractor for a Sri Lankan A/L study assistant. 
Extract the user's intent, requested year (2015-2026), subject (SFT/ET/ICT), paperType, and URLs.
Return a valid JSON object matching the requested schema.

Subject mapping:
- SFT = Science for Technology / SFT / තාක්ෂණවේදය සඳහා විද්‍යාව
- ET = Engineering Technology / ET / ඉංජිනේරු තාක්ෂණවේදය
- ICT = Information and Communication Technology / ICT / තොරතුරු හා සන්නිවේදන තාක්ෂණය

Rules:
- If past paper intent is detected but subject is missing, set needsClarification = true and subject = undefined.
- paperType can be: "paper", "marking", "mcq", "essay", "structured", "unknown"
- modes: "normal_chat", "past_paper_search", "web_search", "url_context", "uploaded_pdf_qa", "rag_qa", "image_generation", "pdf_link_request"
- Set mode to "pdf_link_request" if the user explicitly asks for a PDF file download, file link, or download link of a paper/syllabus.
- If a URL is in the prompt, extract it to urls array and set mode to url_context.
- If asking about current events or general knowledge outside syllabus, mode = web_search.
- If normal subject question, mode = normal_chat or rag_qa.
  `;

  const promptText = `
User Prompt: "${prompt}"
Active Subject Context: "${activeSubject || subject || ""}"

Respond strictly in this JSON format:
{
  "mode": "...",
  "entities": {
    "year": "YYYY",
    "subject": "SFT",
    "paperType": "paper",
    "urls": [],
    "needsClarification": false,
    "clarificationQuestion": ""
  }
}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    
    let { mode, entities } = result;
    if (!entities) entities = {};

    const lowerPrompt = prompt.toLowerCase();
    const isSft = lowerPrompt.includes("sft") || lowerPrompt.includes("තාක්ෂණවේදය සඳහා විද්‍යාව");
    const isEt = lowerPrompt.includes("et") || lowerPrompt.includes("ඉංජිනේරු තාක්ෂණවේදය");
    const isIct = lowerPrompt.includes("ict") || lowerPrompt.includes("තොරතුරු හා සන්නිවේදන");

    const yearMatch = lowerPrompt.match(/\b(20\d{2})\b/);
    const extractedYear = yearMatch ? yearMatch[1] : undefined;

    const isDownloadRequest = lowerPrompt.includes("download") || lowerPrompt.includes("link") || lowerPrompt.includes("pdf") || lowerPrompt.includes("ලින්ක්") || lowerPrompt.includes("ඩවුන්ලෝඩ්") || lowerPrompt.includes("පීඩීඑෆ්") || lowerPrompt.includes("ප්‍රශ්න පත්‍ර");
    if (isDownloadRequest && (mode === "past_paper_search" || mode === "normal_chat")) {
      mode = "pdf_link_request";
    }

    if (mode === "pdf_link_request") {
      if (!entities.subject && activeSubject) {
        entities.subject = activeSubject as any;
      }
      if (isSft) entities.subject = "SFT";
      if (isEt) entities.subject = "ET";
      if (isIct) entities.subject = "ICT";

      if (extractedYear) entities.year = extractedYear;

      if (!entities.subject) {
        entities.needsClarification = true;
        entities.clarificationQuestion = "🔍 කරුණාකර subject එක කියන්න. SFT, ET, ICT අතරින් මොකක්ද?";
      } else if (!entities.year) {
        entities.needsClarification = true;
        entities.clarificationQuestion = "ඔයාට අවශ්‍ය paper year එක මොකක්ද? (උදා: 2025, 2023 වගේ)";
      }
    }
    
    if (entities.needsClarification && !entities.clarificationQuestion) {
      entities.clarificationQuestion = "🔍 කරුණාකර ඔබ සොයන ප්‍රශ්න පත්‍රයේ විෂය සඳහන් කරන්න. SFT, ET, ICT අතරින් මොන subject එකද?";
    }

    return {
      mode: mode || "normal_chat",
      entities,
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: mode === "web_search",
        mustUseUrlContext: mode === "url_context" || (entities.urls && entities.urls.length > 0),
        mustUseRag: mode === "rag_qa",
        mustAskClarification: !!entities.needsClarification,
      },
    };
  } catch (err: any) {
    console.error("Knowledge router error:", err);
    try {
      const classification = classifyAiError(err);
      if (classification.code === "AI_BILLING_EXHAUSTED") {
         handleAiError(err); // This will open the circuit
      }
    } catch (e) {}
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false,
      },
    };
  }
}
