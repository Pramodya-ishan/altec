import { getAIClient, AI_MODELS, getModelFallbackChain } from "./client";
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
    case 'study_plan': return AI_MODELS.default; // or pro for deep
    case 'past_paper_analysis':
    case 'zscore_prediction':
    case 'mark_analysis': return AI_MODELS.pro;
    case 'image_generation': return AI_MODELS.image;
    default: return AI_MODELS.default;
  }
}

async function saveFinalChat(params: {uid: string, userText: string, assistantText: string, mode: string, subject?: string, sources?: any[], model?: string, safeSummary?: string[]}) {
  try {
    const db = getAdminDb();
    const batch = db.batch();
    const historyRef = db.collection("users").doc(params.uid).collection("chat_history");
    
    batch.set(historyRef.doc(), {
      role: "user",
      text: params.userText,
      content: params.userText,
      mode: params.mode,
      subject: params.subject || null,
      createdAt: new Date().toISOString()
    });
    batch.set(historyRef.doc(), {
      role: "assistant",
      text: params.assistantText,
      content: params.assistantText,
      mode: params.mode,
      subject: params.subject || null,
      sources: params.sources || [],
      model: params.model || null,
      safeSummary: params.safeSummary || [],
      createdAt: new Date().toISOString()
    });
    
    await batch.commit();
  } catch (e) {
    console.warn("saveFinalChat error", e);
  }
}

export async function aiRespondStream(req: any, res: any) {
  const startedAt = Date.now();

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    const { prompt, activeSubject, mode = "auto", history = [] } = req.body;
    const user = req.user; // Already authenticated by middleware

    sendSSE(res, "status", { stage: "thinking", label: AI_WORKFLOW_STAGES.thinking, startedAt, timestamp: Date.now() });
    
    sendSSE(res, "status", { stage: "profile", label: AI_WORKFLOW_STAGES.profile, startedAt, timestamp: Date.now() });
    const userContext = await loadUserAIContext(user.uid, user.email);

    sendSSE(res, "status", { stage: "progress", label: AI_WORKFLOW_STAGES.progress, startedAt, timestamp: Date.now() });
    const selectedMode = classifyMode(prompt, mode);

    if (selectedMode === "image_generation") {
      sendSSE(res, "status", { stage: "generating", label: "Generating Educational Diagram...", startedAt, timestamp: Date.now() });
      const { generateEducationalImage } = await import("../image/generate");
      const imgResult = await generateEducationalImage(req);
      
      if (imgResult.ok && imgResult.imageUrl) {
        const imageMarkdown = `\n\n![Generated Educational Diagram](${imgResult.imageUrl})\n\n*(Model used: ${imgResult.model})*\n\n`;
        sendSSE(res, "chunk", { text: imageMarkdown });
        
        await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: imageMarkdown, mode: selectedMode, subject: activeSubject, model: imgResult.model });
        
        sendSSE(res, "done", {
          ok: true,
          totalSeconds: Math.round((Date.now() - startedAt) / 1000),
          totalMs: Date.now() - startedAt,
        });
        return;
      } else {
        throw new Error(imgResult.error || "Failed to generate diagram.");
      }
    }

    if (selectedMode === "past_paper_search") {
      sendSSE(res, "status", { stage: "search", label: "Searching past papers database...", startedAt, timestamp: Date.now() });
      const { searchPastPapers } = await import("../pastPapers/search");
      
      let searchResult: any = null;
      const mockRes = {
        status: () => mockRes,
        json: (val: any) => { searchResult = val; }
      };

      let yearMatch = "";
      const yearMatches = prompt.match(/\b(201\d|202\d)\b/);
      if (yearMatches) yearMatch = yearMatches[1];
      
      let subjectMatch = activeSubject || "";
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes("sft") || lowerPrompt.includes("technology")) subjectMatch = "sft";
      else if (lowerPrompt.includes("et") || lowerPrompt.includes("engineering")) subjectMatch = "et";
      else if (lowerPrompt.includes("ict")) subjectMatch = "ict";

      await searchPastPapers({
        body: { query: prompt, yearMatch, subjectMatch }
      }, mockRes);

      if (searchResult && searchResult.ok && searchResult.sourceCards && searchResult.sourceCards.length > 0) {
        let responseMarkdown = `### 📚 Found Verified Past Papers & Resources\n\n`;
        responseMarkdown += `මෙන්න ඔබ සෙවූ ප්‍රශ්න පත්‍ර සහ පිළිතුරු පත්‍ර සබැඳි (Direct Download Links):\n\n`;
        
        searchResult.sourceCards.forEach((card: any) => {
          responseMarkdown += `#### 📎 **${card.title}**\n`;
          responseMarkdown += `- **ප්‍රභවය (Source):** ${card.source} | **වර්ගය (Type):** ${card.type}\n`;
          if (card.snippet) {
            responseMarkdown += `- **විස්තරය (Description):** *${card.snippet}*\n`;
          }
          responseMarkdown += `- 📥 **Download Link:** [මත ක්ලික් කරන්න (${card.type})](${card.url})\n\n`;
        });
        
        sendSSE(res, "chunk", { text: responseMarkdown });
        
        await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: responseMarkdown, mode: selectedMode, subject: activeSubject, sources: searchResult.sourceCards || [] });
        
        sendSSE(res, "done", {
          ok: true,
          totalSeconds: Math.round((Date.now() - startedAt) / 1000),
          totalMs: Date.now() - startedAt,
        });
        return;
      } else {
        const fallbackMsg = `⚠️ සමාවන්න, ඔබ සෙවූ **"${prompt}"** සඳහා සෘජු ප්‍රශ්න පත්‍ර සබැඳියක් අපගේ පද්ධතියෙන් සොයාගත නොහැකි විය.\n\nකරුණාකර නිවැරදි වර්ෂය සහ විෂය (උදා: SFT 2024 past paper) ඇතුළත් කර නැවත උත්සාහ කරන්න.`;
        sendSSE(res, "chunk", { text: fallbackMsg });
        
        await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: fallbackMsg, mode: selectedMode, subject: activeSubject });
        
        sendSSE(res, "done", {
          ok: true,
          totalSeconds: Math.round((Date.now() - startedAt) / 1000),
          totalMs: Date.now() - startedAt,
        });
        return;
      }
    }

    sendSSE(res, "status", { stage: "sources", label: AI_WORKFLOW_STAGES.sources, startedAt, timestamp: Date.now() });
    const chunks = await retrieveRelevantKnowledge({
      prompt,
      activeSubject,
      mode: selectedMode,
      limit: 8,
      uid: user.uid,
      email: user.email,
      userContext,
    });

    const searchEnabled = requiresGoogleSearch(selectedMode, prompt);
    if (searchEnabled) {
      sendSSE(res, "status", { stage: "search", label: AI_WORKFLOW_STAGES.search, startedAt, timestamp: Date.now() });
    }

    const modelChain = getModelFallbackChain(chooseModel(selectedMode));

    sendSSE(res, "status", { stage: "planning", label: AI_WORKFLOW_STAGES.planning, startedAt, timestamp: Date.now() });
    const finalPrompt = getCloraSystemPrompt(userContext, selectedMode) + 
      (chunks?.length ? `\n\nReference Sources:\n${JSON.stringify(chunks)}` : '') + 
      (history?.length ? `\n\nPrevious Chat History:\n${JSON.stringify(history)}` : '') + 
      `\n\nCurrent User Request:\n${prompt}`;

    sendSSE(res, "status", { stage: "generating", label: AI_WORKFLOW_STAGES.generating, startedAt, timestamp: Date.now() });
    
    const ai = getAIClient();
    let stream: any = null;
    let modelUsed = "";
    let lastError: any = null;

    for (const m of modelChain) {
      try {
        modelUsed = m;
        stream = await ai.models.generateContentStream({
          model: m,
          contents: finalPrompt,
          config: {
            temperature: getTemperature(selectedMode),
            maxOutputTokens: getMaxTokens(selectedMode),
            tools: searchEnabled ? [{ googleSearch: {} }] : undefined
          },
        });
        break; // Successfully started streaming!
      } catch (err: any) {
        lastError = err;
        console.warn(`Streaming with model ${m} failed/unavailable, trying fallback. Error:`, err.message || err);
        continue;
      }
    }

    if (!stream) {
      throw lastError || new Error("All model streaming options failed.");
    }

    let fullText = "";
    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        fullText += text;
        sendSSE(res, "chunk", { text });
      }
    }

    sendSSE(res, "status", { stage: "saving", label: AI_WORKFLOW_STAGES.saving, startedAt, timestamp: Date.now() });
    
    const safeSummary = [
      "Profile loaded",
      `${userContext?.recentProgress?.length || 0} progress records checked`,
      `${chunks?.length || 0} lesson source chunks retrieved`,
      `Google Search used: ${searchEnabled ? "yes" : "no"}`,
      `Model: ${modelUsed}`,
    ];

    await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: fullText, mode: selectedMode, subject: activeSubject, sources: chunks, model: modelUsed, safeSummary });
    await extractStableMemoryIfUseful({ uid: user.uid, prompt, answer: fullText, userContext });

    sendSSE(res, "safe_summary", { items: safeSummary });
    sendSSE(res, "done", { ok: true, totalMs: Date.now() - startedAt, totalSeconds: Math.round((Date.now() - startedAt) / 1000) });
    res.end();
  } catch (error) {
    console.error("Stream Error", error);
    const classified = classifyAIError(error);
    sendSSE(res, "error", { ok: false, error: classified.error, hint: classified.hint, code: classified.code });
    sendSSE(res, "done", { ok: false, totalMs: Date.now() - startedAt, totalSeconds: Math.round((Date.now() - startedAt) / 1000) });
    res.end();
  }
}
