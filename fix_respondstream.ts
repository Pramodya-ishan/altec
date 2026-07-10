import fs from 'fs';

let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');
const lines = content.split('\n');

const correctHead = `import { getAIClient, AI_MODELS, getModelFallbackChain } from "./client";
import { classifyAIError } from "./errors";
import { classifyMode, requiresGoogleSearch } from "./modes";
import { getCloraSystemPrompt } from "./prompts";
import { loadUserAIContext } from "../firebase/userContext";
import { retrieveRelevantKnowledge } from "../knowledge/retrieve";
import { getAdminDb } from "../firebase/admin";
import { sendSSE, AI_WORKFLOW_STAGES } from "./workflow";
import { extractStableMemoryIfUseful } from "./memoryExtractor";

function getTemperature(mode: string) {
  switch (mode) {
    case 'today_plan': return 0.25;
    case 'study_plan': return 0.25;
    case 'tutor_explanation': return 0.35;
    case 'notes_generation': return 0.3;
    case 'quiz_generation': return 0.35;
    case 'past_paper_analysis': return 0.25;
    case 'zscore_prediction': return 0.2;
    default: return 0.4;
  }
}

function getMaxTokens(mode: string) {
  switch (mode) {
    case 'tutor_explanation': return 2500;
    case 'study_plan': return 3500;
    case 'past_paper_analysis':
    case 'zscore_prediction':
    case 'mark_analysis': return 4500;
    default: return 1200;
  }
}

function chooseModel(mode: string) {
  switch (mode) {
    case 'general_chat':
    case 'today_plan':
    case 'tutor_explanation': return AI_MODELS.fast || AI_MODELS.default;
    case 'study_plan': return AI_MODELS.pro || AI_MODELS.default;
    case 'past_paper_analysis':
    case 'zscore_prediction':
    case 'mark_analysis': return AI_MODELS.pro || AI_MODELS.default;
    case 'image_generation': return AI_MODELS.image;
    default: return AI_MODELS.default;
  }
}

async function saveFinalChat(params: {uid: string, email?: string, userText: string, assistantText: string, mode: string, subject?: string}) {
  try {
    const db = getAdminDb();
    const batch = db.batch();
    
    const uidId1 = db.collection("users").doc().id;
    const uidId2 = db.collection("users").doc().id;
    
    const historyRef = db.collection("users").doc(params.uid).collection("chat_history");
    batch.set(historyRef.doc(uidId1), { role: "user", text: params.userText, mode: params.mode, subject: params.subject || null, createdAt: new Date().toISOString() });
    batch.set(historyRef.doc(uidId2), { role: "assistant", text: params.assistantText, mode: params.mode, subject: params.subject || null, createdAt: new Date().toISOString() });
    
    if (params.email) {
      const emailRef = db.collection("users").doc(params.email.toLowerCase()).collection("chat_history");
      batch.set(emailRef.doc(uidId1), { role: "user", text: params.userText, mode: params.mode, subject: params.subject || null, createdAt: new Date().toISOString() });
      batch.set(emailRef.doc(uidId2), { role: "assistant", text: params.assistantText, mode: params.mode, subject: params.subject || null, createdAt: new Date().toISOString() });
    }
    
    await batch.commit();
  } catch (e: any) {
    console.warn("saveFinalChat error", e.message || e);
  }
}`;

const remainingLines = lines.slice(133).join('\n');
fs.writeFileSync('server/ai/respondStream.ts', correctHead + '\n' + remainingLines);
