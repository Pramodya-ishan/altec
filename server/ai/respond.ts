import { getAIClient, AI_MODELS, getModelFallbackChain } from "./client";
import { classifyAIError } from "./errors";
import { classifyMode, requiresGoogleSearch } from "./modes";
import { getCloraSystemPrompt } from "./prompts";
import { loadUserAIContext } from "../firebase/userContext";
import { retrieveRelevantKnowledge } from "../rag/retrieve";
import { getAdminDb } from "../firebase/admin";
import { isSimpleGreeting, sanitizeAssistantText, simpleGreetingReply } from "./responseHygiene";
import { assessAnswerCompleteness, buildContinuationInstruction, getModelFinishReason, mergeContinuationText } from "./answerCompleteness";
import { createAnswerPlan, plannerContext } from "./answerPlanner";
import { createQualityRepairedAnswer, reviewAnswerQuality } from "./answerQuality";

export async function processAIRequest(req: any) {
  try {
    const { prompt, activeSubject, explicitMode, history, model: requestedModel } = req.body;
    const uid = req.user.uid;

    if (!prompt) throw new Error("Prompt is required");

    if (isSimpleGreeting(prompt)) {
      const greeting = simpleGreetingReply(prompt);
      void saveChatToHistory(uid, prompt, greeting, "normal_chat", activeSubject);
      return { ok: true, text: greeting, response: greeting, mode: "normal_chat", model: "deterministic", sources: [] };
    }

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
    const evidenceRequired = /(?:paper|marking|rag|pdf)/iu.test(mode);
    const answerPlan = await createAnswerPlan({ prompt, mode, sources: knowledgeChunks, evidenceRequired });
    finalPrompt += plannerContext(answerPlan);

    // 6. Select model & set up fallback chain
    let preferredModel = AI_MODELS.pro;
    let temp = 0.2;
    
    if (mode === 'today_plan' || mode === 'study_plan') {
      preferredModel = AI_MODELS.pro; temp = 0.2;
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
    let activeChat: any = null;
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
            maxOutputTokens: 12_288,
            tools: useSearch ? [{ googleSearch: {} }] : undefined
          }
        });
        response = await chat.sendMessage({ message: promptWithHistory });
        activeChat = chat;
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
    let safeResponseText = sanitizeAssistantText(response.text || "No response generated.");
    let finishReason = getModelFinishReason(response);
    let completeness = assessAnswerCompleteness({ prompt, answer: safeResponseText, finishReason, mode });
    let completionPasses = 0;
    while (activeChat && completeness.shouldContinue && completionPasses < 2) {
      completionPasses += 1;
      const continuation = await activeChat.sendMessage({
        message: buildContinuationInstruction({ originalPrompt: prompt, currentAnswer: safeResponseText, assessment: completeness }),
      });
      safeResponseText = mergeContinuationText(safeResponseText, sanitizeAssistantText(continuation.text || ""));
      finishReason = getModelFinishReason(continuation) || "STOP";
      completeness = assessAnswerCompleteness({ prompt, answer: safeResponseText, finishReason, mode });
    }
    let qualityReview = await reviewAnswerQuality({
      prompt,
      answer: safeResponseText,
      mode,
      evidenceRequired,
      sources: knowledgeChunks,
    });
    const qualityIssueCount = qualityReview.report.missingRequirements.length
      + qualityReview.report.factualRisks.length
      + qualityReview.report.numericalChecks.length
      + qualityReview.report.citationRisks.length;
    if (!qualityReview.report.passed && qualityIssueCount > 0) {
      const repaired = await createQualityRepairedAnswer({
        originalPrompt: prompt,
        currentAnswer: safeResponseText,
        report: qualityReview.report,
        modelInstruction: qualityReview.repairInstruction,
        systemInstruction,
        maxOutputTokens: 12_288,
      });
      if (repaired.answer.trim()) {
        safeResponseText = repaired.answer;
        completeness = assessAnswerCompleteness({ prompt, answer: safeResponseText, finishReason: "STOP", mode });
        qualityReview = await reviewAnswerQuality({ prompt, answer: safeResponseText, mode, evidenceRequired, sources: knowledgeChunks });
        qualityReview.report.repaired = true;
      }
    }
    const answerComplete = completeness.complete && qualityReview.report.passed;
    saveChatToHistory(uid, prompt, safeResponseText, mode, activeSubject, {
      completed: answerComplete,
      finishReason,
      completionPasses,
      missingSubparts: completeness.missingSubparts,
      reasons: completeness.reasons,
    }, qualityReview.report);

    return {
      ok: true,
      text: safeResponseText,
      response: safeResponseText,
      mode,
      model: modelUsed,
      completed: answerComplete,
      finishReason: answerComplete ? "complete" : "answer_incomplete",
      modelFinishReason: finishReason,
      completionPasses,
      canContinue: !answerComplete,
      missingSubparts: completeness.missingSubparts,
      qualityReport: qualityReview.report,
      answerPlan: { requirementCount: answerPlan.requirements.length, visualNeed: answerPlan.visualNeed, generatedBy: answerPlan.generatedBy },
      sources: knowledgeChunks,
      groundingMetadata: (response.candidates?.[0] as any)?.groundingMetadata
    };

  } catch (error: any) {
    console.error("AI Request Failed:", error);
    return classifyAIError(error);
  }
}

async function saveChatToHistory(uid: string, prompt: string, response: string, mode: string, subject?: string, completion?: { completed: boolean; finishReason?: string | null; completionPasses?: number; missingSubparts?: string[]; reasons?: string[] }, quality?: Record<string, unknown> | null) {
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
      answerCompleted: completion?.completed ?? true,
      modelFinishReason: completion?.finishReason || null,
      completionPasses: completion?.completionPasses || 0,
      missingSubparts: completion?.missingSubparts || [],
      incompleteReasons: completion?.reasons || [],
      answerQuality: quality || null,
      createdAt: new Date().toISOString()
    });

    await batch.commit();
  } catch (e) {
    console.error("Failed to save chat history", e);
  }
}
