import { getAdminDb } from "../../firebase/admin";
import { calculateCalibratedForecast } from "./calibratedForecast";

export async function rankTopicProbability(subject: string, targetYear = 2026) {
  const db = getAdminDb();
  const [questionSnap, syllabusSnap] = await Promise.all([
    db.collection("exam_question_index").where("subject", "==", subject).limit(2500).get(),
    db.collection("syllabus_nodes").where("subject", "==", subject).limit(500).get(),
  ]);
  const questions = questionSnap.docs.map((document: any) => ({ id: document.id, ...document.data() }));
  const syllabusNodes = syllabusSnap.docs.map((d: any) => d.data());
  return calculateCalibratedForecast({ subject, questions, syllabusNodes, targetYear });
}
