import { getAdminDb } from "../../firebase/admin";

export async function addMistake(uid: string, mistakeData: any) {
  const db = getAdminDb();
  
  const mistakeId = `${mistakeData.subject}_${Date.now()}`;
  
  const record = {
    ...mistakeData,
    retryDate: getNextRetryDate(0),
    repeatCount: 0,
    mastered: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await db.collection("users").doc(uid).collection("mistake_notebook").doc(mistakeId).set(record);
  return { id: mistakeId, ...record };
}

export async function getTodayRetries(uid: string) {
  const db = getAdminDb();
  const today = new Date().toISOString(); // Simple string compare works if ISO format is consistent
  
  const snap = await db.collection("users").doc(uid).collection("mistake_notebook")
    .where("mastered", "==", false)
    .where("retryDate", "<=", today)
    .get();
    
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}

export async function markMistakeMastered(uid: string, mistakeId: string) {
  const db = getAdminDb();
  await db.collection("users").doc(uid).collection("mistake_notebook").doc(mistakeId).update({
    mastered: true,
    updatedAt: new Date().toISOString()
  });
}

export async function scheduleRetry(uid: string, mistakeId: string, currentRepeatCount: number) {
  const db = getAdminDb();
  const nextRetryDate = getNextRetryDate(currentRepeatCount + 1);
  
  await db.collection("users").doc(uid).collection("mistake_notebook").doc(mistakeId).update({
    retryDate: nextRetryDate,
    repeatCount: currentRepeatCount + 1,
    updatedAt: new Date().toISOString()
  });
}

function getNextRetryDate(repeatCount: number): string {
  const date = new Date();
  
  switch (repeatCount) {
    case 0: date.setDate(date.getDate() + 1); break; // 1 day
    case 1: date.setDate(date.getDate() + 3); break; // 3 days
    case 2: date.setDate(date.getDate() + 7); break; // 7 days
    default: date.setDate(date.getDate() + 14); break; // 14 days
  }
  
  return date.toISOString();
}
