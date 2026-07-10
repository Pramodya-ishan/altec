import { getAdminDb } from "../../firebase/admin";

export async function updateStudentForecast(uid: string) {
  const db = getAdminDb();
  
  // 1. Fetch current data
  const mockResultsSnap = await db.collection("users").doc(uid).collection("mock_results").orderBy("date", "desc").limit(10).get();
  const mocks = mockResultsSnap.docs.map((d: any) => d.data());
  
  const mistakesSnap = await db.collection("users").doc(uid).collection("mistake_notebook").where("mastered", "==", false).get();
  const unmasteredMistakes = mistakesSnap.docs.map((d: any) => d.data());
  
  // Basic heuristic model for forecasting
  // In a real system, you would use a more complex algorithm or AI model.
  
  let sftLatest = mocks.find((m: any) => m.subject === 'SFT')?.totalMarks || 0;
  let etLatest = mocks.find((m: any) => m.subject === 'ET')?.totalMarks || 0;
  let ictLatest = mocks.find((m: any) => m.subject === 'ICT')?.totalMarks || 0;
  
  const currentMarkEstimate = {
    sft: sftLatest,
    et: etLatest,
    ict: ictLatest
  };
  
  const forecast7Day = {
    sft: Math.min(100, sftLatest + 3),
    et: Math.min(100, etLatest + 3),
    ict: Math.min(100, ictLatest + 3)
  };
  
  const forecast30Day = {
    sft: Math.min(100, sftLatest + 15),
    et: Math.min(100, etLatest + 15),
    ict: Math.min(100, ictLatest + 15)
  };
  
  const average = (sftLatest + etLatest + ictLatest) / 3;
  let a3Chance = "Low";
  let riskLevel = "High";
  
  if (average >= 75) {
    a3Chance = "High";
    riskLevel = "Low";
  } else if (average >= 60) {
    a3Chance = "Medium";
    riskLevel = "Medium";
  }
  
  const mustFix = unmasteredMistakes.slice(0, 5).map((m: any) => m.lesson);
  
  const forecast = {
    currentMarkEstimate,
    forecast7Day,
    forecast30Day,
    a3Chance,
    riskLevel,
    mustFix: Array.from(new Set(mustFix)),
    warnings: riskLevel === "High" ? ["Target A3 is currently at risk. Need intensive daily MCQ drills."] : [],
    generatedAt: new Date().toISOString()
  };
  
  await db.collection("users").doc(uid).collection("student_forecasts").add(forecast);
  
  return forecast;
}
