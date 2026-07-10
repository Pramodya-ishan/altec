import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function rankTopicProbability(subject: string) {
  const db = getAdminDb();
  
  // 1. Fetch historical pattern data
  const reportSnap = await db.collection("exam_pattern_reports").doc(subject).get();
  const patternData = reportSnap.exists ? reportSnap.data() : null;
  
  // 2. Fetch syllabus data
  const syllabusSnap = await db.collection("syllabus_nodes").where("subject", "==", subject).get();
  const syllabusNodes = syllabusSnap.docs.map((d: any) => d.data());

  // 3. Prepare prompt
  const prompt = `
    Analyze the exam patterns and syllabus for ${subject}.
    
    Pattern Data: ${JSON.stringify(patternData)}
    Syllabus Structure: ${JSON.stringify(syllabusNodes)}
    
    Rank the probability of topics appearing in the 2026 exam.
    Consider:
    1. Syllabus weight
    2. Past frequency
    3. Recency
    4. Rotation pattern
    5. Not asked recently
    
    Return a list of rankings.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Use Pro for complex reasoning
    contents: prompt,
    config: {
      systemInstruction: "You are an advanced exam intelligence architect. Output evidence-based probability rankings in JSON. Do not claim exact prediction.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            subject: { type: Type.STRING },
            lesson: { type: Type.STRING },
            probability: { type: Type.STRING, enum: ["Very High", "High", "Medium", "Low"] },
            confidence: { type: Type.NUMBER },
            evidence: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  reason: { type: Type.STRING }
                }
              }
            },
            studentPriority: { type: Type.STRING, enum: ["Must study today", "This week", "Later"] },
            riskIfSkipped: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
          },
          required: ["topic", "subject", "lesson", "probability", "confidence", "evidence", "studentPriority", "riskIfSkipped"]
        }
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
