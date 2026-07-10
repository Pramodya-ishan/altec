import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function diagnoseStudent(uid: string, subject: string) {
  const db = getAdminDb();
  
  // 1. Fetch student data
  const progressSnap = await db.collection("users").doc(uid).collection("progress").doc("data").get();
  const progressData = progressSnap.exists ? progressSnap.data()?.data?.[subject.toLowerCase()] : null;
  
  const mockResultsSnap = await db.collection("users").doc(uid).collection("mock_results").where("subject", "==", subject).orderBy("date", "desc").limit(5).get();
  const mockResults = mockResultsSnap.docs.map((d: any) => d.data());
  
  const mistakesSnap = await db.collection("users").doc(uid).collection("mistake_notebook").where("subject", "==", subject).limit(50).get();
  const mistakes = mistakesSnap.docs.map((d: any) => d.data());

  // 2. Prepare prompt for AI
  const prompt = `
    Analyze the following student data for subject: ${subject}.
    
    Student Progress: ${JSON.stringify(progressData)}
    Recent Mock Results: ${JSON.stringify(mockResults)}
    Mistake History: ${JSON.stringify(mistakes)}
    
    Identify:
    - Weak lessons (low completion or low marks)
    - High-yield weak lessons (important lessons where student is weak)
    - Urgent repair lessons (lessons with frequent mistakes)
    - Already strong lessons
    - Recommended daily focus
    - Risk reasons
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert A/L education analyst. Provide a detailed diagnosis in JSON format.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          weakLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          highYieldWeakLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          urgentRepairLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          alreadyStrongLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedDailyFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
          riskReasons: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["subject", "weakLessons", "highYieldWeakLessons", "urgentRepairLessons", "alreadyStrongLessons", "recommendedDailyFocus", "riskReasons"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
