import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function generateStudentWeeklyReport(uid: string) {
  const db = getAdminDb();
  
  // 1. Fetch student data
  const profileSnap = await db.collection("users").doc(uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  
  const progressSnap = await db.collection("users").doc(uid).collection("progress").doc("data").get();
  const progress = progressSnap.exists ? progressSnap.data()?.data : {};
  
  const mockResultsSnap = await db.collection("users").doc(uid).collection("mock_results").orderBy("date", "desc").limit(10).get();
  const mocks = mockResultsSnap.docs.map((d: any) => d.data());
  
  const mistakesSnap = await db.collection("users").doc(uid).collection("mistake_notebook").orderBy("createdAt", "desc").limit(50).get();
  const mistakes = mistakesSnap.docs.map((d: any) => d.data());
  
  const prompt = `
    Generate a weekly progress report for an A/L Technology student.
    
    Student Profile: ${JSON.stringify(profile)}
    Progress Data: ${JSON.stringify(progress)}
    Recent Mock Results: ${JSON.stringify(mocks)}
    Recent Mistakes: ${JSON.stringify(mistakes)}
    
    The report should include:
    - Progress summary
    - Weak lessons
    - Next week's plan
    - High probability exam topics
    - Mock score trend
    - Mistake trend
    - Risk warning
    - A parent-friendly summary
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert A/L education analyst generating a weekly report. Format output as JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          progressSummary: { type: Type.STRING },
          weakLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          nextWeekPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          highProbabilityTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          mockScoreTrend: { type: Type.STRING },
          mistakeTrend: { type: Type.STRING },
          riskWarning: { type: Type.STRING },
          parentFriendlySummary: { type: Type.STRING }
        },
        required: [
          "progressSummary", 
          "weakLessons", 
          "nextWeekPlan", 
          "highProbabilityTopics", 
          "mockScoreTrend", 
          "mistakeTrend", 
          "riskWarning", 
          "parentFriendlySummary"
        ]
      }
    }
  });

  const report = JSON.parse(response.text || "{}");
  
  // Store report
  await db.collection("users").doc(uid).collection("weekly_reports").add({
    ...report,
    generatedAt: new Date().toISOString()
  });

  return report;
}
