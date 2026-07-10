import fs from 'fs';

let code = fs.readFileSync('server/ai/respondStream.ts', 'utf-8');

// Replace saveFinalChat
const startIdx = code.indexOf('async function saveFinalChat');
const endIdx = code.indexOf('export async function aiRespondStream');

const newSaveFinalChat = `export type SaveChatResult = {
  chatSaved: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

async function saveFinalChat(params: {uid: string, email?: string, userText: string, assistantText: string, mode: string, subject?: string, sources?: any[]}): Promise<SaveChatResult> {
  try {
    const db = getAdminDb();
    const batch = db.batch();
    
    const timestamp = new Date().toISOString();
    const requestId = Date.now().toString() + Math.random().toString(36).substring(7);
    
    const historyRef = db.collection("users").doc(params.uid).collection("chat_history").doc(requestId);
    batch.set(historyRef, { 
      requestId,
      userPrompt: params.userText,
      assistantAnswer: params.assistantText,
      mode: params.mode,
      subject: params.subject || null,
      sources: params.sources || [],
      createdAt: timestamp,
      chatSaved: true
    });
    
    if (params.email) {
      const emailRef = db.collection("users").doc(params.email.toLowerCase()).collection("chat_history").doc(requestId);
      batch.set(emailRef, {
        requestId,
        userPrompt: params.userText,
        assistantAnswer: params.assistantText,
        mode: params.mode,
        subject: params.subject || null,
        sources: params.sources || [],
        createdAt: timestamp,
        chatSaved: true
      });
    }
    
    await batch.commit();
    return { chatSaved: true, messageId: requestId };
  } catch (e: any) {
    console.warn("CHAT_SAVE_SKIPPED", e.message || e);
    return { chatSaved: false, errorCode: "SAVE_FAILED", errorMessage: e.message || String(e) };
  }
}

`;

code = code.substring(0, startIdx) + newSaveFinalChat + code.substring(endIdx);
fs.writeFileSync('server/ai/respondStream.ts', code);
