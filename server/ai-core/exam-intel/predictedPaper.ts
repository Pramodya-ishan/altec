import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { callGeminiWithFallback } from "../../ai/modelRouter";
import { getSubjectSyllabusGroundingPdf } from "../../pdf/syllabusGrounding";

function normalizeSubject(value: unknown) {
  const subject = String(value || "").trim().toUpperCase();
  if (!["SFT", "ET", "ICT"].includes(subject)) throw new Error("Subject must be SFT, ET, or ICT.");
  return subject;
}

export async function generatePredictedPaper(params: {
  subject: string,
  mode: "safe" | "balanced" | "surprise",
  targetMarks: number,
  includeAnswers: boolean,
  studentUid?: string,
  uid?: string,
}) {
  const db = getAdminDb();
  const subject = normalizeSubject(params.subject);
  const uid = params.studentUid || params.uid || "system";

  const [reportSnap, questionSnap, sourceSnap, forecastSnap] = await Promise.all([
    db.collection("exam_pattern_reports").doc(subject).get(),
    db.collection("exam_question_index").where("subject", "==", subject).limit(600).get(),
    db.collection("rag_sources").where("subject", "==", subject).limit(400).get(),
    uid !== "system"
      ? db.collection("users").doc(uid).collection("forecasts").orderBy("updatedAt", "desc").limit(1).get().catch(() => ({ empty: true, docs: [] } as any))
      : Promise.resolve({ empty: true, docs: [] } as any),
  ]);

  const patternData = reportSnap.exists ? reportSnap.data() : null;
  const questions = questionSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const sources = sourceSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const studentWeakness = !forecastSnap.empty ? forecastSnap.docs[0].data().mustFix : null;

  const eligibleSources = sources.filter((source: any) => {
    const identity = `${source.resourceType || ""} ${source.sourceScope || ""} ${source.title || ""}`.toLowerCase();
    return source.published !== false && /(past.?paper|marking|model.?paper|guess|prediction|syllabus|reference.?book|paper_structure)/i.test(identity);
  });
  const sourceById = new Map(eligibleSources.map((source: any) => [String(source.id || source.sourceId), source]));
  const indexedEvidence = questions
    .filter((question: any) => sourceById.has(String(question.sourceId)) || question.verified === true)
    .slice(0, 450)
    .map((question: any) => ({
      year: question.year,
      paperType: question.paperType,
      questionType: question.questionType,
      lesson: question.lesson,
      subtopic: question.subtopic,
      concept: question.concept,
      marks: question.marks,
      questionText: String(question.questionText || "").slice(0, 500),
      sourceId: question.sourceId,
    }));

  const syllabusPdf = await getSubjectSyllabusGroundingPdf(uid, subject).catch(() => null);
  const parts: any[] = [];
  if (syllabusPdf?.gcsUri) parts.push({ fileData: { fileUri: syllabusPdf.gcsUri, mimeType: "application/pdf" } });
  else if (syllabusPdf?.buffer?.length) parts.push({ inlineData: { mimeType: "application/pdf", data: syllabusPdf.buffer.toString("base64") } });

  parts.push({ text: `
Create a 2026 ${subject} revision forecast paper in ${params.mode} mode.

This is revision guidance, not a claim about the real 2026 examination.
Use only concepts inside the attached official syllabus and the indexed evidence below.
For SFT, do not import separate A/L Biology, Chemistry, Physics, or Mathematics content unless it appears in the attached SFT syllabus or approved SFT reference sources.

Evidence sources (${eligibleSources.length}):
${JSON.stringify(eligibleSources.slice(0, 120).map((source: any) => ({ id: source.id, title: source.title, year: source.year, resourceType: source.resourceType, sourceScope: source.sourceScope })))}

Indexed past/model/guessing questions (${indexedEvidence.length}):
${JSON.stringify(indexedEvidence)}

Pattern report:
${JSON.stringify(patternData)}

Student weak areas:
${JSON.stringify(studentWeakness)}

Rules:
- Balance syllabus weight, past frequency, recency, rotation, unasked areas, and student weakness.
- Every generated question must include lesson, subtopic, marks, markingPoints, evidenceSourceIds, and confidence.
- Never copy a copyrighted full paper verbatim. Generate new revision questions based on patterns.
- Never say a predicted question will definitely appear.
- Use natural Sinhala Unicode for Sinhala-medium questions.
- Target approximately ${Number(params.targetMarks || 80)} marks.
- Include answers only when includeAnswers=${Boolean(params.includeAnswers)}.
` });

  const { result: response } = await callGeminiWithFallback("final_answer", {
    model: "ignored",
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: "You are the project's evidence-based study assistant, created by Pramodya Ishan. Build evidence-based Sri Lankan A/L Technology revision forecasts. Stay inside the official syllabus. Output JSON only and never claim certainty about the real 2026 paper.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          paperMode: { type: Type.STRING },
          disclaimer: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNo: { type: Type.INTEGER },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                marks: { type: Type.NUMBER },
                lesson: { type: Type.STRING },
                subtopic: { type: Type.STRING },
                answer: { type: Type.STRING },
                markingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                evidenceSourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                confidence: { type: Type.NUMBER },
              },
              required: ["questionNo", "text", "marks", "lesson", "subtopic", "markingPoints", "evidenceSourceIds", "confidence"],
            },
          },
          answerKey: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidenceMap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNo: { type: Type.INTEGER },
                evidence: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          confidenceReport: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["paperMode", "disclaimer", "questions", "answerKey", "evidenceMap", "confidenceReport"],
      },
      temperature: 0.25,
      maxOutputTokens: 8192,
    },
  } as any);

  const parsed = JSON.parse(response.text || "{}");
  return {
    ...parsed,
    subject,
    forecastYear: 2026,
    evidenceSummary: {
      indexedQuestions: indexedEvidence.length,
      eligibleSources: eligibleSources.length,
      syllabusAttached: Boolean(syllabusPdf),
    },
  };
}
