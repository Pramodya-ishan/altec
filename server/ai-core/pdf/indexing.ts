import { retryGoogleAuthOperation } from "../../utils/retry";
import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getStorage } from "firebase-admin/storage";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function buildExamIndex() {
  const db = getAdminDb();
  const storage = getStorage();
  
  // 1. Load sources (past papers, model papers, etc.)
  const sourcesSnap = await db.collection("rag_sources").get();
  const sources = sourcesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  
  const results = [];
  
  for (const source of sources) {
    // Skip if already indexed recently (optional check)
    
    try {
      // 2. Download PDF
      const file = storage.bucket().file(source.storagePath);
      const [buffer] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());
      
      // 3. Extract questions using Gemini
      const prompt = `
        Analyze this PDF which is an exam paper for ${source.subject}.
        Extract all questions including MCQ, Structured, and Essay questions.
        For each question, identify the lesson, subtopic, marks, and skill type.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { text: prompt },
          { inlineData: { data: buffer.toString('base64'), mimeType: 'application/pdf' } }
        ],
        config: {
          systemInstruction: "You are a professional exam paper digitizer. Extract questions into the specified JSON format.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionNo: { type: Type.INTEGER },
                partNo: { type: Type.STRING },
                questionType: { type: Type.STRING, enum: ["MCQ", "Structured", "Essay", "Practical", "Drawing", "Calculation", "Diagram", "Theory"] },
                marks: { type: Type.NUMBER },
                compulsory: { type: Type.BOOLEAN },
                lesson: { type: Type.STRING },
                subtopic: { type: Type.STRING },
                concept: { type: Type.STRING },
                skillType: { type: Type.STRING, enum: ["memory", "understanding", "calculation", "diagram", "application", "comparison", "explanation", "data interpretation"] },
                questionText: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                markingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                pageNumber: { type: Type.INTEGER }
              },
              required: ["questionNo", "questionType", "lesson", "questionText"]
            }
          }
        }
      });

      const questions = JSON.parse(response.text || "[]");
      
      // 4. Store in Firestore
      const batch = db.batch();
      for (const q of questions) {
        const questionId = `${source.id}_${q.questionNo}_${q.partNo || 'main'}`;
        const ref = db.collection("exam_question_index").doc(questionId);
        batch.set(ref, {
          ...q,
          sourceId: source.id,
          sourceTitle: source.title,
          subject: source.subject,
          year: source.year || "unknown",
          paperType: source.type || "past_paper",
          extractionMethod: "gemini-3.5-flash",
          confidence: 0.9,
          verified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      await batch.commit();
      
      results.push({ sourceId: source.id, count: questions.length });
    } catch (err) {
      console.error(`Failed to index source ${source.id}:`, err);
      results.push({ sourceId: source.id, error: String(err) });
    }
  }
  
  return results;
}
