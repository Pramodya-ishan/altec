import { Type } from "@google/genai";
import { getAdminDb } from "../../firebase/admin";
import { getAIClient } from "../../ai/client";

const ai = getAIClient();

export async function generateWarPlan(params: {
  uid: string,
  target: string,
  days: number,
  dailyHours: number,
  subjects: string[],
  examDates: Record<string, string>
}) {
  const db = getAdminDb();
  
  // 1. Fetch student context
  const progressSnap = await db.collection("users").doc(params.uid).collection("progress").doc("data").get();
  const progress = progressSnap.exists ? progressSnap.data()?.data : {};
  
  const mockResultsSnap = await db.collection("users").doc(params.uid).collection("mock_results").orderBy("date", "desc").limit(10).get();
  const mocks = mockResultsSnap.docs.map((d: any) => d.data());

  // 2. Prepare prompt
  const prompt = `
    Generate a 30-Day A3 Recovery War Plan for a student.
    
    Target: ${params.target}
    Daily Hours: ${params.dailyHours}
    Subjects: ${params.subjects.join(", ")}
    Exam Dates: ${JSON.stringify(params.examDates)}
    
    Student Progress: ${JSON.stringify(progress)}
    Mock Performance: ${JSON.stringify(mocks)}
    
    Rules:
    - Daily schedule with morning/afternoon/night tasks.
    - Prioritize 80% mark-return lessons.
    - Include MCQ drills, past paper blocks, and mistake repair.
    - Use forgetting-curve repeats (3-day, 7-day).
    - Give a realistic forecast and risk assessment.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are a top-tier A/L exam coach. Output a strict but motivating 30-day war plan in JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          target: { type: Type.STRING },
          daysRemaining: { type: Type.INTEGER },
          currentRisk: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          realisticForecast: { type: Type.OBJECT },
          dailyPlan: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER },
                morning: { type: Type.STRING },
                afternoon: { type: Type.STRING },
                night: { type: Type.STRING },
                mock: { type: Type.STRING },
                targetScore: { type: Type.INTEGER }
              }
            } 
          },
          weeklyMilestones: { type: Type.ARRAY, items: { type: Type.STRING } },
          mustDoLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          skipOrLowPriorityLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          mockTestSchedule: { type: Type.ARRAY, items: { type: Type.STRING } },
          revisionCycles: { type: Type.ARRAY, items: { type: Type.STRING } },
          warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["target", "daysRemaining", "currentRisk", "realisticForecast", "dailyPlan", "weeklyMilestones", "mustDoLessons", "skipOrLowPriorityLessons", "mockTestSchedule", "revisionCycles", "warnings"]
      }
    }
  });

  const plan = JSON.parse(response.text || "{}");
  
  // Store plan
  await db.collection("users").doc(params.uid).collection("war_plans").add({
    ...plan,
    createdAt: new Date().toISOString()
  });

  return plan;
}
