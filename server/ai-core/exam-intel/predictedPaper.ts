import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { callGeminiWithFallback } from "../../ai/modelRouter";
import { getAIClient } from "../../ai/client";
import { generateEducationalImage } from "../../image/generate";
import { getSourceInventory } from "../../sources/sourceInventoryService";
import { calculateCalibratedForecast } from "./calibratedForecast";
import { buildPredictionFallbackVisual, ensureVisualQuestionIntegrity } from "./predictionVisual";
import { getSubjectPredictionProfile, isEligiblePredictionSource, mergePredictionSettings, normalizePredictionSubject, sourceReliability, type PredictionMode, type PredictionPaperType } from "./predictionPolicy";
import { loadSubjectSyllabusCorpus, syllabusCorpusParts } from "./syllabusCorpus";

function safeJson(value: unknown) {
  const text = String(value || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(text); } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { return {}; }
    }
    return {};
  }
}

function normalizedMode(value: unknown): PredictionMode {
  return ["safe", "balanced", "surprise"].includes(String(value)) ? value as PredictionMode : "balanced";
}

function normalizedPaperType(value: unknown): PredictionPaperType {
  const text = String(value || "Full Paper").toLowerCase();
  if (text.includes("mcq")) return "MCQ";
  if (text.includes("structured")) return "Structured";
  if (text.includes("essay")) return "Essay";
  return "Full Paper";
}

async function runPredictionCommittee(params: {
  subject: string;
  targetYear: number;
  committeeSize: number;
  rankings: any[];
  patternData: any;
  syllabusSources: any[];
}) {
  const roles = [
    "historical frequency, marks and examiner-format analyst",
    "official syllabus coverage and rotation-gap auditor",
    "adversarial reviewer looking for overfitting, circular guessing evidence and neglected syllabus points",
    "diagram/visual-question pattern specialist",
    "calibration and historical-backtest reviewer",
  ];
  const compactRankings = params.rankings.slice(0, 60).map((item) => ({
    lesson: item.lesson,
    topic: item.topic,
    probabilityPercent: item.probabilityPercent,
    confidence: item.confidence,
    lastSeenYear: item.lastSeenYear,
    formats: item.formatLikelihood,
    evidenceYears: item.distinctEvidenceYears,
  }));
  const tasks = Array.from({ length: params.committeeSize }, (_, index) => callGeminiWithFallback("fast_background", {
    model: "ignored",
    contents: `You are the ${roles[index % roles.length]} on a Sri Lankan A/L Technology revision committee. Independently review the evidence for a ${params.targetYear} ${params.subject} revision forecast. Reject certainty claims. Select up to 15 topics and explain risks.\n\nCALIBRATED RANKINGS:\n${JSON.stringify(compactRankings)}\n\nPATTERN REPORT:\n${JSON.stringify(params.patternData || {})}\n\nOFFICIAL SYLLABUS SOURCES:\n${JSON.stringify(params.syllabusSources)}`,
    config: {
      temperature: 0.2 + index * 0.05,
      maxOutputTokens: 1800,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          topics: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
            lesson: { type: Type.STRING }, score: { type: Type.NUMBER }, reason: { type: Type.STRING }, expectedFormat: { type: Type.STRING }, requiresVisual: { type: Type.BOOLEAN },
          }, required: ["lesson", "score", "reason", "expectedFormat", "requiresVisual"] } },
          risks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["role", "topics", "risks"],
      },
    },
  }, getAIClient()).then(({ result }) => safeJson(result.text)).catch((error) => ({ role: roles[index % roles.length], topics: [], risks: [`Committee member unavailable: ${String(error?.message || error)}`] })));
  return Promise.all(tasks);
}

function attachCalibratedEvidence(question: any, index: number, rankings: any[], sourceById: Map<string, any>) {
  const lessonText = String(question?.lesson || "").normalize("NFKC").toLowerCase();
  const ranking = rankings.find((item) => item.lesson.toLowerCase() === lessonText)
    || rankings.find((item) => lessonText.includes(item.lesson.toLowerCase()) || item.lesson.toLowerCase().includes(lessonText))
    || null;
  const proposedIds = Array.isArray(question?.evidenceSourceIds) ? question.evidenceSourceIds.map(String) : [];
  const rankingIds = ranking?.evidence?.map((item: any) => String(item.sourceId || "")).filter(Boolean) || [];
  const evidenceSourceIds = [...new Set([...proposedIds, ...rankingIds])].filter((sourceId) => sourceById.has(sourceId)).slice(0, 12);
  return {
    ...question,
    questionNo: Number(question?.questionNo || index + 1),
    text: String(question?.text || question?.questionText || "").trim(),
    section: String(question?.section || "Revision Forecast"),
    questionType: String(question?.questionType || "Structured"),
    marks: Math.max(1, Number(question?.marks || 1)),
    lesson: String(question?.lesson || ranking?.lesson || "Syllabus topic"),
    subtopic: String(question?.subtopic || ranking?.topic || ""),
    options: Array.isArray(question?.options) ? question.options.map(String).slice(0, 5) : [],
    answer: question?.answer == null ? "" : String(question.answer),
    markingPoints: Array.isArray(question?.markingPoints) ? question.markingPoints.map(String).slice(0, 20) : [],
    predictionProbability: ranking?.probabilityPercent ?? Math.min(60, Math.max(10, Number(question?.predictionProbability || 30))),
    predictionConfidence: ranking?.confidence ?? Math.min(55, Math.max(10, Number(question?.predictionConfidence || 25))),
    predictionReasons: ranking?.why || ["Generated from approved syllabus scope with limited indexed pattern evidence."],
    confidenceInterval: ranking?.confidenceInterval || [10, 50],
    evidenceSourceIds,
    evidence: evidenceSourceIds.map((sourceId) => ({ sourceId, title: sourceById.get(sourceId)?.title || sourceId })),
    officialQuestion: false,
  };
}

async function attachQuestionImages(questions: any[], params: { user?: any; subject: string; maximumImages: number }) {
  const output = [...questions];
  const indexes = output.map((question, index) => question.requiresImage === true ? index : -1).filter((index) => index >= 0).slice(0, params.maximumImages);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(2, indexes.length) }, async () => {
    while (cursor < indexes.length) {
      const position = cursor++;
      const index = indexes[position];
      const question = output[index];
      let image: any = null;
      if (params.user?.uid) {
        const result = await generateEducationalImage({
          user: params.user,
          body: {
            prompt: question.visualSpec.prompt,
            subject: params.subject,
            lesson: question.lesson,
            style: "clean examination diagram with exact geometry and no decorative content",
            mode: "pro",
            quality: "high",
            aspectRatio: "4:3",
            referenceText: `Question: ${question.text}\nMust show: ${(question.visualSpec.mustShow || []).join(", ")}\nAllowed short labels: ${(question.visualSpec.labels || []).join(", ")}`,
          },
        }).catch(() => null);
        if (result?.ok && result?.imageUrl) {
          image = {
            url: result.imageUrl,
            storagePath: result.storagePath || null,
            mimeType: result.mimeType || "image/png",
            model: result.model || null,
            altText: question.visualSpec.altText,
            caption: question.visualSpec.caption,
            generatedBy: "ai_image_model",
          };
        }
      }
      output[index] = { ...question, image: image || buildPredictionFallbackVisual(question) };
    }
  });
  await Promise.all(workers);
  return output;
}

export async function generatePredictedPaper(params: {
  subject: string;
  mode?: PredictionMode;
  targetMarks?: number;
  includeAnswers?: boolean;
  studentUid?: string;
  uid?: string;
  user?: any;
  targetYear?: number;
  paperType?: PredictionPaperType | string;
  questionCount?: number;
  includeImages?: boolean;
  maxImageQuestions?: number;
  committeeSize?: number;
  settings?: any;
}) {
  const db = getAdminDb();
  const subject = normalizePredictionSubject(params.subject);
  const uid = params.studentUid || params.uid || params.user?.uid || "system";
  const canManagePredictionSettings = params.user?.admin === true || params.user?.roles?.includes?.("admin");
  const settingsSnapshot = await db.collection("prediction_settings").doc(subject).get().catch(() => null);
  const storedSettings = settingsSnapshot?.exists ? settingsSnapshot.data() : {};
  const settings = mergePredictionSettings(subject, storedSettings, {
    ...(canManagePredictionSettings ? (params.settings || {}) : {}),
    targetYear: params.targetYear || storedSettings?.targetYear || 2026,
    committeeSize: params.committeeSize ?? storedSettings?.committeeSize,
    includeImages: params.includeImages ?? storedSettings?.includeImages,
    maxImageQuestions: params.maxImageQuestions ?? storedSettings?.maxImageQuestions,
  });
  const targetYear = settings.targetYear;
  const mode = normalizedMode(params.mode);
  const paperType = normalizedPaperType(params.paperType);
  const profile = getSubjectPredictionProfile(subject);

  const [reportSnap, questionSnap, syllabusNodeSnap, forecastSnap, inventory, syllabusCorpus] = await Promise.all([
    db.collection("exam_pattern_reports").where("subject", "==", subject).limit(5).get().catch(() => null),
    db.collection("exam_question_index").where("subject", "==", subject).limit(2500).get(),
    db.collection("syllabus_nodes").where("subject", "==", subject).limit(1000).get().catch(() => null),
    uid !== "system" ? db.collection("users").doc(uid).collection("forecasts").orderBy("updatedAt", "desc").limit(1).get().catch(() => null) : Promise.resolve(null),
    getSourceInventory({ uid, subject, isAdmin: canManagePredictionSettings }),
    loadSubjectSyllabusCorpus({ uid, subject, isAdmin: canManagePredictionSettings }),
  ]);

  const patternData = reportSnap && !reportSnap.empty ? reportSnap.docs[0].data() : null;
  const studentWeakness = forecastSnap && !forecastSnap.empty ? forecastSnap.docs[0].data()?.mustFix : null;
  const eligibleSources = (inventory.all || []).filter((source: any) => isEligiblePredictionSource(source, settings));
  const sourceById = new Map<string, any>(eligibleSources.map((source: any) => [String(source.sourceId || source.id), source] as [string, any]));
  const rawQuestions = questionSnap.docs.map((document: any) => ({ id: document.id, ...document.data() }));
  const indexedEvidence = rawQuestions
    .filter((question: any) => Number(question?.year || 0) < targetYear)
    .filter((question: any) => sourceById.has(String(question.sourceId || "")) || (question.verified === true && question.sourceId))
    .map((question: any) => {
      const source = sourceById.get(String(question.sourceId || ""));
      return {
        ...question,
        sourceTitle: source?.title || question.sourceTitle || null,
        resourceType: source?.resourceType || question.resourceType || null,
        sourceScope: source?.sourceScope || question.sourceScope || null,
        sourceReliability: source ? sourceReliability(source) : 0.72,
      };
    });
  const storedSyllabusNodes = syllabusNodeSnap ? syllabusNodeSnap.docs.map((document: any) => ({ id: document.id, ...document.data() })) : [];
  const syllabusNodes = [...storedSyllabusNodes, ...syllabusCorpus.syllabusNodes];
  const rankings = calculateCalibratedForecast({ subject, questions: indexedEvidence, syllabusNodes, targetYear, settings });
  const committee = await runPredictionCommittee({
    subject,
    targetYear,
    committeeSize: settings.committeeSize,
    rankings,
    patternData,
    syllabusSources: syllabusCorpus.sources,
  });

  const defaultQuestionCount = paperType === "Full Paper"
    ? Math.max(12, Math.round(Number(params.targetMarks || 80) / 4))
    : Math.max(5, Math.round(Number(params.targetMarks || 40) / 4));
  const questionCount = Math.max(1, Math.min(50, Number(params.questionCount || defaultQuestionCount)));
  const targetMarks = Math.max(5, Math.min(200, Number(params.targetMarks || 80)));
  const maximumImages = settings.includeImages && params.includeImages !== false
    ? Math.max(0, Math.min(questionCount, Number(params.maxImageQuestions ?? settings.maxImageQuestions ?? profile.minimumVisualsForFullPaper)))
    : 0;
  const parts: any[] = [
    ...syllabusCorpusParts(syllabusCorpus),
    { text: `
Create a ${targetYear} ${subject} evidence-based REVISION FORECAST paper. It is not the real examination and is never guaranteed.

SUBJECT PROFILE: ${profile.systemFocus}
PAPER TYPE: ${paperType}
MODE: ${mode}
QUESTION COUNT: exactly ${questionCount}
TARGET MARKS: approximately ${targetMarks}
VISUAL REQUIREMENT: Mark image/diagram-dependent questions with requiresImage=true and give a precise visualSpec. Aim for up to ${maximumImages} genuinely useful visual questions; never attach an irrelevant decorative image. Every question marked requiresImage will receive an actual image asset after text generation.

OFFICIAL SYLLABUS COVERAGE:
${JSON.stringify(syllabusCorpus.coverage)}

INDEXED SYLLABUS TEXT:
${syllabusCorpus.indexedText.slice(0, 60_000)}

CALIBRATED TOPIC RANKINGS:
${JSON.stringify(rankings.slice(0, 80))}

INDEPENDENT COMMITTEE REVIEWS:
${JSON.stringify(committee)}

INDEXED APPROVED QUESTION EVIDENCE (${indexedEvidence.length} items):
${JSON.stringify(indexedEvidence.slice(0, 550).map((question: any) => ({ year: question.year, questionNo: question.questionNo, paperType: question.paperType, questionType: question.questionType, lesson: question.lesson, subtopic: question.subtopic, concept: question.concept, marks: question.marks, questionText: String(question.questionText || "").slice(0, 500), sourceId: question.sourceId, sourceTitle: question.sourceTitle, sourceReliability: question.sourceReliability })))}

STUDENT WEAK AREAS:
${JSON.stringify(studentWeakness)}

STRICT RULES:
- Stay inside every attached approved ${subject} syllabus PDF. Do not import content from another A/L subject merely because it seems related.
- Use official past papers and marking schemes more strongly than model papers. Never use guessing papers as circular proof unless settings explicitly included them.
- Generate new revision questions; do not copy a full copyrighted paper verbatim.
- Include section, questionType, lesson, subtopic, marks, answer, markingPoints, evidenceSourceIds, requiresImage, visualOpportunity and visualSpec.
- evidenceSourceIds must come from the supplied indexed evidence. Never invent a source ID.
- Visual specifications must describe exact geometry/components and use only short English/symbol labels inside the image; Sinhala explanation belongs in altText/caption outside the image.
- For an image-based question, the text must explicitly tell the student to use the supplied image.
- Use natural Sinhala Unicode where appropriate.
- includeAnswers=${Boolean(params.includeAnswers)}. When false, keep answer empty but still create private markingPoints for the marking scheme data.
- A prediction score is revision priority, not the chance of an exact future question. Never claim 100%, guaranteed, leaked, or official.
` },
  ];

  const generationRequest: any = {
    model: "ignored",
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: `You are an evidence-calibrated Sri Lankan G.C.E. A/L Technology revision-paper adjudicator. Subject=${subject}. Read every attached approved syllabus PDF. Reconcile deterministic rankings with independent committee reviews. Output JSON only. Never claim certainty about the real examination.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          paperMode: { type: Type.STRING },
          paperType: { type: Type.STRING },
          title: { type: Type.STRING },
          disclaimer: { type: Type.STRING },
          questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
            questionNo: { type: Type.INTEGER }, section: { type: Type.STRING }, questionType: { type: Type.STRING }, text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } }, marks: { type: Type.NUMBER }, lesson: { type: Type.STRING }, subtopic: { type: Type.STRING },
            answer: { type: Type.STRING }, markingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }, evidenceSourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            requiresImage: { type: Type.BOOLEAN }, visualOpportunity: { type: Type.BOOLEAN },
            visualSpec: { type: Type.OBJECT, properties: {
              kind: { type: Type.STRING }, prompt: { type: Type.STRING }, altText: { type: Type.STRING }, caption: { type: Type.STRING }, labels: { type: Type.ARRAY, items: { type: Type.STRING } }, mustShow: { type: Type.ARRAY, items: { type: Type.STRING } },
            }, required: ["kind", "prompt", "altText", "caption", "labels", "mustShow"] },
          }, required: ["questionNo", "section", "questionType", "text", "marks", "lesson", "subtopic", "markingPoints", "evidenceSourceIds", "requiresImage", "visualOpportunity", "visualSpec"] } },
          confidenceReport: { type: Type.ARRAY, items: { type: Type.STRING } },
          committeeSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["paperMode", "paperType", "title", "disclaimer", "questions", "confidenceReport", "committeeSummary"],
      },
      temperature: mode === "safe" ? 0.12 : mode === "surprise" ? 0.38 : 0.22,
      maxOutputTokens: 16_000,
    },
  };
  let parsed: any = {};
  let lastGenerationError: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const request = attempt === 0
        ? generationRequest
        : {
            ...generationRequest,
            contents: [{ role: "user", parts: [
              ...parts,
              { text: `REPAIR PASS: The previous response was missing, truncated, or contained fewer than ${questionCount} questions. Return one complete JSON object with exactly ${questionCount} fully formed questions. Keep every required field and stay concise enough to finish.` },
            ] }],
          };
      const { result } = await callGeminiWithFallback("final_answer", request, getAIClient());
      const candidate = safeJson(result.text);
      if ((candidate?.questions?.length || 0) > (parsed?.questions?.length || 0)) parsed = candidate;
      if (candidate?.questions?.length >= questionCount) break;
    } catch (error) {
      lastGenerationError = error;
    }
  }
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw Object.assign(new Error(lastGenerationError?.message || "The forecast model did not return a usable question set after an automatic repair pass."), { code: "PREDICTION_EMPTY_RESULT" });
  }
  const calibratedQuestions = parsed.questions.slice(0, questionCount).map((question: any, index: number) => attachCalibratedEvidence(question, index, rankings, sourceById));
  const visualQuestions = ensureVisualQuestionIntegrity(calibratedQuestions, maximumImages);
  const questions = maximumImages > 0
    ? await attachQuestionImages(visualQuestions, { user: params.user, subject, maximumImages })
    : visualQuestions;
  const answerKey = questions.map((question: any) => ({ questionNo: question.questionNo, answer: question.answer, markingPoints: question.markingPoints, marks: question.marks }));
  const totalMarks = questions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);

  return {
    ok: true,
    ...parsed,
    title: parsed.title || `${targetYear} ${subject} Evidence-based Revision Forecast`,
    paperMode: mode,
    paperType,
    subject,
    targetYear,
    forecastYear: targetYear,
    questions,
    answerKey,
    markingScheme: answerKey,
    totalMarks,
    generatedAt: new Date().toISOString(),
    disclaimer: `${targetYear} evidence-based revision forecast only. This is AI-generated practice material, not a leaked, official, guaranteed, or 100%-certain examination paper.`,
    evidenceSummary: {
      indexedQuestions: indexedEvidence.length,
      eligibleSources: eligibleSources.length,
      syllabus: syllabusCorpus.coverage,
      committeeMembers: committee.length,
      generatedImages: questions.filter((question: any) => question.image?.url).length,
      targetYear,
    },
    topForecasts: rankings.slice(0, 20),
    committee,
    settings,
  };
}

export function formatPredictedPaperForChat(paper: any, includeAnswers = false) {
  const lines = [
    `## ${paper.title || `${paper.targetYear} ${paper.subject} Revision Forecast`}`,
    "",
    `> ${paper.disclaimer}`,
    "",
  ];
  for (const question of paper.questions || []) {
    lines.push(`### ${question.questionNo}. ${question.lesson || "Syllabus question"} (${question.marks} marks)`, "", String(question.text || ""), "");
    if (question.image?.url) lines.push(`![${question.image.altText || `Question ${question.questionNo} diagram`}](${question.image.url})`, `*${question.image.caption || "Question image"}*`, "");
    if (Array.isArray(question.options)) question.options.forEach((option: string, index: number) => lines.push(`${index + 1}. ${option}`));
    if (question.options?.length) lines.push("");
    lines.push(`Prediction priority: **${question.predictionProbability}%** · Evidence confidence: **${question.predictionConfidence}%**`, "");
    if (includeAnswers) {
      lines.push(`**Answer:** ${question.answer || "See marking points."}`);
      if (question.markingPoints?.length) lines.push(...question.markingPoints.map((point: string) => `- ${point}`));
      lines.push("");
    }
  }
  lines.push(`Evidence used: ${paper.evidenceSummary?.indexedQuestions || 0} indexed questions, ${paper.evidenceSummary?.syllabus?.attachedDocuments || 0} syllabus PDF(s), ${paper.evidenceSummary?.committeeMembers || 0} independent analysis passes.`);
  return lines.join("\n");
}
