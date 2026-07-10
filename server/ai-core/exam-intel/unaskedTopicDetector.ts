import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function detectUnaskedTopics(subject: string) {
  const db = getAdminDb();
  
  // 1. Get all syllabus nodes
  const syllabusSnap = await db.collection("syllabus_nodes").where("subject", "==", subject).get();
  const syllabus = syllabusSnap.docs.map((d: any) => d.data());
  
  // 2. Get all questions indexed
  const questionsSnap = await db.collection("exam_question_index").where("subject", "==", subject).get();
  const coveredQuestions = questionsSnap.docs.map((d: any) => d.data());

  const prompt = `
    Compare the syllabus with the questions asked in the past.
    
    Syllabus: ${JSON.stringify(syllabus)}
    Covered Questions: ${JSON.stringify(coveredQuestions)}
    
    Identify topics or subtopics that have NEVER been asked or are RARELY asked.
    Assess their importance based on syllabus weight.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are a senior syllabus auditor. Identify unasked and rare topics in JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          unaskedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          rarelyAskedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          lastAppeared: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topic: { type: Type.STRING }, year: { type: Type.STRING } } } },
          syllabusImportance: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topic: { type: Type.STRING }, weight: { type: Type.NUMBER } } } },
          predictionWeight: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topic: { type: Type.STRING }, weight: { type: Type.NUMBER } } } }
        },
        required: ["subject", "unaskedTopics", "rarelyAskedTopics", "lastAppeared", "syllabusImportance", "predictionWeight"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
