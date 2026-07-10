import { getAIClient, AI_MODELS, getModelFallbackChain } from "./client";
import { classifyAIError } from "./errors";
import { classifyMode, requiresGoogleSearch } from "./modes";
import { getCloraSystemPrompt } from "./prompts";
import { loadUserAIContext } from "../firebase/userContext";
import { retrieveRelevantKnowledge } from "../rag/retrieve";
import { getAdminDb } from "../firebase/admin";

export async function processAIRequest(req: any) {
  try {
    const { prompt, activeSubject, explicitMode, history, model: requestedModel } = req.body;
    const uid = req.user.uid;

    if (!prompt) throw new Error("Prompt is required");

    // 1. Load context
    const contextData = await loadUserAIContext(uid, req.user?.email);

    // 2. Classify mode
    const mode = classifyMode(prompt, explicitMode);

    // 3. Retrieve knowledge
    const knowledgeChunks = await retrieveRelevantKnowledge({ prompt, activeSubject, mode });

    // 4. Determine search
    const useSearch = requiresGoogleSearch(mode, prompt);

    // 5. Build prompt
    const systemInstruction = getCloraSystemPrompt(contextData, mode);
    let finalPrompt = prompt;
    if (knowledgeChunks && knowledgeChunks.length > 0) {
      finalPrompt += `\n\nReference Sources:\n${JSON.stringify(knowledgeChunks)}`;
    }

    // 6. Select model & set up fallback chain
    let preferredModel = AI_MODELS.default;
    let temp = 0.35;
    
    if (mode === 'today_plan' || mode === 'study_plan') {
      preferredModel = AI_MODELS.default; temp = 0.25;
    } else if (mode === 'past_paper_analysis' || mode === 'zscore_prediction') {
      preferredModel = AI_MODELS.pro; temp = 0.2;
    }
    
    if (requestedModel) {
       preferredModel = requestedModel;
    }

    const modelChain = getModelFallbackChain(preferredModel);

    // 7. Call Gemini with Fallback Chain
    const ai = getAIClient();
    let response: any = null;
    let modelUsed = "";
    let lastError: any = null;

    let promptWithHistory = finalPrompt;
    if (history && history.length > 0) {
       promptWithHistory = `Previous Chat History:\n${JSON.stringify(history.map((h: any) => ({ role: h.role, text: h.content || h.text })))}\n\nCurrent User Request:\n${finalPrompt}`;
    }

    for (const m of modelChain) {
      try {
        modelUsed = m;
        const chat = ai.chats.create({
          model: m,
          config: {
            systemInstruction,
            temperature: temp,
            tools: useSearch ? [{ googleSearch: {} }] : undefined
          }
        });
        response = await chat.sendMessage({ message: promptWithHistory });
        break; // Success!
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${m} failed/unavailable, trying fallback if possible. Error:`, err.message || err);
        // Continue to the next model in the chain
        continue;
      }
    }

    if (!response) {
      throw lastError || new Error("All model options in the fallback chain failed.");
    }

    // 8. Save final message (only for important modes, or handle outside)
    // We can do this asynchronously
    saveChatToHistory(uid, prompt, response.text || "", mode, activeSubject);

    return {
      ok: true,
      text: response.text || "No response generated.",
      response: response.text || "No response generated.",
      mode,
      model: modelUsed,
      sources: knowledgeChunks,
      groundingMetadata: (response.candidates?.[0] as any)?.groundingMetadata
    };

  } catch (error: any) {
    console.error("AI Request Failed:", error);
    return classifyAIError(error);
  }
}

async function saveChatToHistory(uid: string, prompt: string, response: string, mode: string, subject?: string) {
  try {
    const db = getAdminDb();
    const batch = db.batch();
    
    const userRef = db.collection("users").doc(uid);
    const historyRef = userRef.collection("chat_history");
    
    const userMsgRef = historyRef.doc();
    batch.set(userMsgRef, {
      role: "user",
      text: prompt,
      mode,
      subject: subject || null,
      createdAt: new Date().toISOString()
    });

    const aiMsgRef = historyRef.doc();
    batch.set(aiMsgRef, {
      role: "assistant",
      text: response,
      mode,
      subject: subject || null,
      createdAt: new Date().toISOString()
    });

    await batch.commit();
  } catch (e) {
    console.error("Failed to save chat history", e);
  }
}
