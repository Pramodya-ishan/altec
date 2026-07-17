import { getAdminDb } from "../firebase/admin";

export interface PaperMcqQuizSession {
  active: boolean;
  sourceId: string;
  storagePath?: string | null;
  downloadUrl?: string | null;
  title?: string | null;
  year: string;
  subject: string;
  questionType: "MCQ";
  startQuestionNo: number;
  endQuestionNo: number;
  currentQuestionNo: number;
  awaitingAnswer: boolean;
  expectedOptionNo: string | null;
  expectedOptionText: string | null;
  questionText: string | null;
  options: string[];
  explanationSinhala: string | null;
  lesson?: string | null;
  pageNumber?: number | null;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  answeredCount: number;
  startedAt: string;
  updatedAt: string;
}

export interface ConversationState {
  uid: string;
  conversationId: string;
  activeSubject?: string;
  activeLessonIds: string[];
  activeSourceIds: string[];
  selectedSourceId: string | null;
  selectedQuestionId: string | null;
  currentQuestionIndex: number | null;
  requestedResourceType: string | null;
  evidenceMode: "strict" | "relaxed" | "none";
  allowGeneratedContent: boolean;
  quizSession?: PaperMcqQuizSession | null;
  lastIntent: string | null;
  updatedAt: string;
}

export async function getConversationState(uid: string): Promise<ConversationState> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("state").doc("conversation");
  const doc = await ref.get();
  
  if (doc.exists) {
    return doc.data() as ConversationState;
  }
  
  const defaultState: ConversationState = {
    uid,
    conversationId: "conv_" + Date.now(),
    activeLessonIds: [],
    activeSourceIds: [],
    selectedSourceId: null,
    selectedQuestionId: null,
    currentQuestionIndex: null,
    requestedResourceType: null,
    evidenceMode: "strict",
    allowGeneratedContent: false,
    quizSession: null,
    lastIntent: null,
    updatedAt: new Date().toISOString()
  };
  
  await ref.set(defaultState);
  return defaultState;
}

export async function updateConversationState(uid: string, updates: Partial<ConversationState>): Promise<ConversationState> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("state").doc("conversation");
  
  const currentState = await getConversationState(uid);
  const newState = {
    ...currentState,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await ref.set(newState);
  return newState;
}

export async function resetConversationState(uid: string): Promise<ConversationState> {
  const defaultState: ConversationState = {
    uid,
    conversationId: "conv_" + Date.now(),
    activeLessonIds: [],
    activeSourceIds: [],
    selectedSourceId: null,
    selectedQuestionId: null,
    currentQuestionIndex: null,
    requestedResourceType: null,
    evidenceMode: "strict",
    allowGeneratedContent: false,
    quizSession: null,
    lastIntent: null,
    updatedAt: new Date().toISOString()
  };
  
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("state").doc("conversation");
  await ref.set(defaultState);
  return defaultState;
}
