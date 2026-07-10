import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function generatePredictedPaper(params: {
  subject: string,
  mode: "safe" | "balanced" | "surprise",
  targetMarks: number,
  includeAnswers: boolean,
  studentUid?: string
}) {
  const db = getAdminDb();
  
  // 1. Fetch patterns and syllabus
  const reportSnap = await db.collection("exam_pattern_reports").doc(params.subject).get();
  const patternData = reportSnap.exists ? reportSnap.data() : null;
  
  // 2. Fetch student weakness if uid provided
  let studentWeakness = null;
  if (params.studentUid) {
    const forecastSnap = await db.collection("users").doc(params.studentUid).collection("forecasts").orderBy("updatedAt", "desc").limit(1).get();
    if (!forecastSnap.empty) {
      studentWeakness = forecastSnap.docs[0].data().mustFix;
    }
  }

  // 3. Prepare prompt
  const prompt = `
    Generate a Predicted Exam Paper for ${params.subject} in ${params.mode} mode.
    
    Pattern Data: ${JSON.stringify(patternData)}
    Student Weakness: ${JSON.stringify(studentWeakness)}
    
    Modes:
    - safe: high frequency + syllabus weight
    - balanced: high frequency + medium rotation + student weak areas
    - surprise: rare but syllabus-important topics
    
    Include:
    - questions
    - answer key
    - evidence citation for each prediction
    - confidence report
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert exam predictor. Generate a simulated revision paper in JSON. Always cite evidence. Do not claim it will appear exactly.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          paperMode: { type: Type.STRING },
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
                subtopic: { type: Type.STRING }
              }
            } 
          },
          answerKey: { type: Type.ARRAY, items: { type: Type.STRING } },
          evidenceMap: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                questionNo: { type: Type.INTEGER },
                evidence: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              }
            } 
          },
          confidenceReport: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["paperMode", "questions", "answerKey", "evidenceMap", "confidenceReport"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
