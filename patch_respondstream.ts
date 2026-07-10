import fs from 'fs';
let code = fs.readFileSync('server/ai/respondStream.ts', 'utf-8');

code = code.replace(/async function saveFinalChat.*?\{[\s\S]*?catch \(e: any\) \{[\s\S]*?console.warn\("saveFinalChat error", e.message \|\| e\);\n  \}\n\}/, 
`async function saveFinalChat(params: {uid: string, email?: string, userText: string, assistantText: string, mode: string, subject?: string, sources?: any[]}): Promise<{chatSaved: boolean}> {
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
    return { chatSaved: true };
  } catch (e: any) {
    console.warn("saveFinalChat error", e.message || e);
    return { chatSaved: false };
  }
}`);

code = code.replace(/await saveFinalChat\(([\s\S]*?)\);\n\s*sendSSE\(res, "done", \{ chatSaved: true/g, 'const chatRes = await saveFinalChat($1);\n      sendSSE(res, "done", { chatSaved: chatRes.chatSaved');

fs.writeFileSync('server/ai/respondStream.ts', code);
