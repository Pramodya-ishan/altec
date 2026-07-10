import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function buildPatternReport(subject: string) {
  const db = getAdminDb();
  
  // 1. Get all questions for subject
  const questionsSnap = await db.collection("exam_question_index").where("subject", "==", subject).get();
  const questions = questionsSnap.docs.map((d: any) => d.data());
  
  // 2. Prepare prompt
  const prompt = `
    Analyze the following exam questions for subject ${subject} to build a pattern report.
    
    Questions: ${JSON.stringify(questions.map((q: any) => ({
      year: q.year,
      questionType: q.questionType,
      lesson: q.lesson,
      subtopic: q.subtopic,
      marks: q.marks,
      concept: q.concept
    })))}
    
    Identify:
    - Lesson frequency
    - Marks by lesson
    - MCQ/Structured/Essay frequency
    - Repeated concepts
    - Rare concepts
    - Not asked recently
    - Trend changes in the last 5 years
    - High probability topics
    - Low probability topics
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert A/L exam pattern analyst. Format your report as JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          yearsAnalyzed: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          lessonFrequencyTable: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          marksByLesson: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          mcqFrequency: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          structuredFrequency: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          essayFrequency: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          repeatedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          rareConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          notAskedRecently: { type: Type.ARRAY, items: { type: Type.STRING } },
          trendChangesLastFiveYears: { type: Type.ARRAY, items: { type: Type.STRING } },
          highProbabilityTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          lowProbabilityTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER }
        },
        required: ["subject"]
      }
    }
  });

  const report = JSON.parse(response.text || "{}");
  report.generatedAt = new Date().toISOString();
  report.version = "1.0";
  
  await db.collection("exam_pattern_reports").doc(`${subject}_${report.version}`).set(report);
  
  return report;
}
