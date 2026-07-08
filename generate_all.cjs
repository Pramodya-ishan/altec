const fs = require('fs');
const path = require('path');

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content.trim() + '\n');
}

// 2. SINGLE AI CLIENT
write('server/ai/client.ts', `
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

export function prepareGoogleCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = "/tmp/google-credentials.json";
    try {
      let credStr = raw.trim();
      if (!credStr.startsWith('{')) credStr = '{' + credStr;
      if (!credStr.endsWith('}')) credStr = credStr + '}';
      JSON.parse(credStr);
      fs.writeFileSync(filePath, credStr, { mode: 0o600 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
    } catch (e) {
      console.error("Failed to parse and write GOOGLE_APPLICATION_CREDENTIALS_JSON", e);
    }
  }
}

export function getAIClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;

  prepareGoogleCredentials();

  let location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (location === "global") location = "us-central1"; // Global doesn't support all models yet

  cachedClient = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || "al-ai-chat",
    location: location,
  });

  return cachedClient;
}

function mapModel(model: string) {
  if (!model) return "gemini-1.5-flash";
  if (model.includes("gemini-3") || model.includes("gemini-2")) {
     if (model.includes("image")) return "imagen-3.0-generate-001";
     if (model.includes("pro")) return "gemini-1.5-pro";
     return "gemini-1.5-flash";
  }
  return model;
}

export const AI_MODELS = {
  default: mapModel(process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash"),
  pro: mapModel(process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview"),
  fast: mapModel(process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"),
  image: mapModel(process.env.NANO_BANANA_MODEL || "gemini-3.1-flash-image"),
  imagePro: mapModel(process.env.NANO_BANANA_PRO_MODEL || "gemini-3-pro-image"),
};
`);

// 3. AI ERROR CLASSIFIER
write('server/ai/errors.ts', `
export function classifyAIError(error: any) {
  let errMsg = error?.message || 'Internal server error';
  let code = "UNKNOWN_ERROR";
  let hint = "Please try again later.";

  if (errMsg.includes('Prepayment Credits Depleted')) {
    code = "CREDITS_DEPLETED";
    errMsg = "Wrong AI Studio API key path is still being used. Use Vertex AI auth.";
    hint = "The server is still using AI Studio Developer API key, which is wrong for our billing setup. Please ensure Google Cloud ADC is configured.";
  } else if (errMsg.includes('Could not load the default credentials')) {
    code = "CREDENTIALS_MISSING";
    errMsg = "Missing Google Cloud service account credentials.";
    hint = "Missing service account / ADC configuration.";
  } else if (error?.status === 403 || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('aiplatform.endpoints.predict')) {
    code = "PERMISSION_DENIED";
    errMsg = "Service account lacks roles/aiplatform.user or API is not enabled.";
    hint = "Service account lacks roles/aiplatform.user or Vertex AI API is not enabled.";
  } else if (error?.status === 429 || errMsg.includes('quota') || errMsg.includes('rate limit')) {
    code = "QUOTA_EXCEEDED";
    errMsg = "Quota or rate limit exceeded.";
    hint = "Too many requests. Please try again in a minute.";
  } else if (error?.status === 404 || errMsg.includes('not found') || errMsg.includes('NOT_FOUND')) {
    code = "MODEL_NOT_FOUND";
    errMsg = "Model not available in selected project/location.";
    hint = "Check model access or change region location.";
  } else if (errMsg.includes('safety') || errMsg.includes('blocked')) {
    code = "SAFETY_BLOCK";
    errMsg = "Response blocked by safety settings.";
    hint = "Please adjust your prompt and try again.";
  } else if (errMsg.includes('timeout') || errMsg.includes('network')) {
    code = "NETWORK_TIMEOUT";
    errMsg = "Network timeout.";
    hint = "The network is slow, please try again.";
  }

  return {
    ok: false,
    error: errMsg,
    code,
    hint,
    raw: errMsg
  };
}
`);

// 4. WORKFLOW EVENT SYSTEM
write('server/ai/workflow.ts', `
export const AI_WORKFLOW_STAGES = {
  thinking: "Thinking",
  auth: "Verifying account",
  profile: "Reading your profile",
  progress: "Checking your progress",
  memory: "Loading study memory",
  sources: "Checking lesson sources",
  search: "Searching web",
  planning: "Planning answer",
  generating: "Writing answer",
  saving: "Saving memory",
  done: "Thought",
  error: "Stopped",
};

export function sendSSE(res: any, event: string, data: any) {
  try {
    res.write(\`event: \${event}\\n\`);
    res.write(\`data: \${JSON.stringify(data)}\\n\\n\`);
    if (res.flush) res.flush();
  } catch (e) {
    // Client disconnected
  }
}
`);

// 5. STREAMING AI ENDPOINT
write('server/ai/respondStream.ts', `
import { getAIClient, AI_MODELS } from "./client";
import { classifyAIError } from "./errors";
import { classifyMode, requiresGoogleSearch } from "./modes";
import { getCloraSystemPrompt } from "./prompts";
import { loadUserAIContext } from "../firebase/userContext";
import { retrieveRelevantKnowledge } from "../knowledge/retrieve";
import { getFirestore } from "firebase-admin/firestore";
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

async function saveFinalChat(params: {uid: string, userText: string, assistantText: string, mode: string, subject?: string}) {
  try {
    const db = getFirestore();
    const batch = db.batch();
    const historyRef = db.collection("users").doc(params.uid).collection("chat_history");
    
    batch.set(historyRef.doc(), { role: "user", text: params.userText, mode: params.mode, subject: params.subject || null, createdAt: new Date().toISOString() });
    batch.set(historyRef.doc(), { role: "assistant", text: params.assistantText, mode: params.mode, subject: params.subject || null, createdAt: new Date().toISOString() });
    
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
    const userContext = await loadUserAIContext(user.uid);

    sendSSE(res, "status", { stage: "progress", label: AI_WORKFLOW_STAGES.progress, startedAt, timestamp: Date.now() });
    const selectedMode = classifyMode(prompt, mode);

    sendSSE(res, "status", { stage: "sources", label: AI_WORKFLOW_STAGES.sources, startedAt, timestamp: Date.now() });
    const chunks = await retrieveRelevantKnowledge({ prompt, activeSubject, mode: selectedMode, limit: 8 });

    const searchEnabled = requiresGoogleSearch(selectedMode, prompt);
    if (searchEnabled) {
      sendSSE(res, "status", { stage: "search", label: AI_WORKFLOW_STAGES.search, startedAt, timestamp: Date.now() });
    }

    const selectedModel = chooseModel(selectedMode);

    sendSSE(res, "status", { stage: "planning", label: AI_WORKFLOW_STAGES.planning, startedAt, timestamp: Date.now() });
    const finalPrompt = getCloraSystemPrompt(userContext, selectedMode) + 
      (chunks?.length ? \`\\n\\nReference Sources:\\n\${JSON.stringify(chunks)}\` : '') + 
      (history?.length ? \`\\n\\nPrevious Chat History:\\n\${JSON.stringify(history)}\` : '') + 
      \`\\n\\nCurrent User Request:\\n\${prompt}\`;

    sendSSE(res, "status", { stage: "generating", label: AI_WORKFLOW_STAGES.generating, startedAt, timestamp: Date.now() });
    
    const ai = getAIClient();
    const stream = await ai.models.generateContentStream({
      model: selectedModel,
      contents: finalPrompt,
      config: {
        temperature: getTemperature(selectedMode),
        maxOutputTokens: getMaxTokens(selectedMode),
        tools: searchEnabled ? [{ googleSearch: {} }] : undefined
      },
    });

    let fullText = "";
    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        fullText += text;
        sendSSE(res, "chunk", { text });
      }
    }

    sendSSE(res, "status", { stage: "saving", label: AI_WORKFLOW_STAGES.saving, startedAt, timestamp: Date.now() });
    
    await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: fullText, mode: selectedMode, subject: activeSubject });
    await extractStableMemoryIfUseful({ uid: user.uid, prompt, answer: fullText, userContext });

    const safeSummary = [
      "Profile loaded",
      \`\${userContext?.recentProgress?.length || 0} progress records checked\`,
      \`\${chunks?.length || 0} lesson source chunks retrieved\`,
      \`Google Search used: \${searchEnabled ? "yes" : "no"}\`,
      \`Model: \${selectedModel}\`,
    ];

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
`);

// 8. PERSONAL CONNECTION AI MEMORY
write('server/ai/memoryExtractor.ts', `
import { getAIClient, AI_MODELS } from "./client";
import { getFirestore } from "firebase-admin/firestore";

export async function extractStableMemoryIfUseful(params: {uid: string, prompt: string, answer: string, userContext: any}) {
  try {
    const ai = getAIClient();
    const extractionPrompt = \`
Extract only stable, useful study-related facts from the conversation.
Return ONLY a JSON array. Do not return markdown blocks like \` + '\`\`\`json' + \`.
If nothing useful, return [].
Do not extract sensitive personal information.
Do not extract temporary emotions.
Only extract facts that help future A/L study support.

Types allowed: "stable_preference" | "weakness" | "target" | "study_pattern" | "mistake"

User Prompt: \${params.prompt}
Assistant Answer: \${params.answer}
\`;

    const response = await ai.models.generateContent({
      model: AI_MODELS.default,
      contents: extractionPrompt,
      config: { temperature: 0.1 }
    });

    let text = response.text || "[]";
    text = text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
    
    const items = JSON.parse(text);
    if (Array.isArray(items) && items.length > 0) {
      const db = getFirestore();
      const batch = db.batch();
      for (const item of items) {
        if (item.type && item.value) {
          const ref = db.collection("users").doc(params.uid).collection("ai_memory").doc();
          batch.set(ref, {
            type: item.type,
            value: item.value,
            confidence: item.confidence || 0.8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      await batch.commit();
      return items;
    }
  } catch (e) {
    console.warn("Memory extraction failed", e);
  }
  return [];
}
`);

// 7. FIREBASE USER CONTEXT
write('server/firebase/userContext.ts', `
import { getFirestore } from "firebase-admin/firestore";

const contextCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000;

export async function loadUserAIContext(uid: string) {
  const now = Date.now();
  const cached = contextCache.get(uid);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    
    const [profileSnap, progressSnap, marksSnap, memorySnap, chatSnap] = await Promise.all([
      userRef.get(),
      userRef.collection("progress").limit(20).get().catch(() => ({ docs: [] })),
      userRef.collection("marks").orderBy("date", "desc").limit(10).get().catch(() => ({ docs: [] })),
      userRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })),
      userRef.collection("chat_history").orderBy("createdAt", "desc").limit(10).get().catch(() => ({ docs: [] }))
    ]);

    const profile = profileSnap.data() || {};
    const recentProgress = (progressSnap as any).docs.map((d: any) => d.data());
    const latestMarks = (marksSnap as any).docs.map((d: any) => d.data());
    const aiMemory = (memorySnap as any).docs.map((d: any) => d.data());
    const chatHistoryLast10 = (chatSnap as any).docs.map((d: any) => d.data()).reverse();

    const weakLessons = recentProgress.filter((p: any) => p.coveragePercent < 50 || (p.weakPoints && p.weakPoints.length > 0));
    const wrongQuestions = recentProgress.flatMap((p: any) => p.wrongQuestions || []);

    const contextData = {
      profile: {
        uid,
        name: profile.name || profile.username,
        email: profile.email,
        stream: profile.stream,
        district: profile.district,
      },
      preferences: profile.preferences || {},
      latestMarks,
      weakLessons,
      recentProgress,
      wrongQuestions,
      aiMemory,
      chatHistoryLast10,
      examDates: profile.examDates || {},
      targetZ: profile.targetZ,
      targetMarks: profile.targetMarks,
      currentTimeAsiaColombo: new Date().toLocaleString("en-US", {timeZone: process.env.APP_TIME_ZONE || "Asia/Colombo"})
    };

    contextCache.set(uid, { data: contextData, timestamp: now });
    return contextData;
  } catch (e) {
    console.error("loadUserAIContext error", e);
    return {};
  }
}
`);

// 9. CLORA X SYSTEM PROMPT
write('server/ai/prompts.ts', `
export function getCloraSystemPrompt(contextData: any, mode: string) {
  return \`
You are Clora X, a Sinhala-first personal AI tutor for Sri Lankan G.C.E. A/L Engineering Technology stream.

You are not a generic assistant. You are the user's personal study partner.

You must answer using:
1. logged-in user's Firebase profile,
2. actual user progress,
3. actual marks,
4. actual weak lessons,
5. actual wrong questions,
6. AI memory,
7. recent chat history,
8. retrieved syllabus / NotebookLM mirrored source chunks,
9. verified Google Search results only when search is enabled.

User Context:
Name: \${contextData?.profile?.name || 'Unknown'}
Stream: \${contextData?.profile?.stream || 'Unknown'}
Current Time (Colombo): \${contextData?.currentTimeAsiaColombo || ''}
Target Z-Score: \${contextData?.targetZ || 'Not set'}
Weak Lessons: \${JSON.stringify(contextData?.weakLessons?.map((w: any) => w.lesson) || [])}
Recent Progress: \${JSON.stringify(contextData?.recentProgress?.slice(0, 3) || [])}
Latest Marks: \${JSON.stringify(contextData?.latestMarks?.slice(0, 3) || [])}
AI Memory: \${JSON.stringify(contextData?.aiMemory || [])}

Never invent:
- user marks
- progress
- Z-score
- district rank
- island rank
- past-paper links
- NotebookLM content
- syllabus facts
- sources

If data is missing, say it is missing and continue with a safe answer.

PERSONAL CONNECTION RULES:
- Make the user feel understood from previous data.
- Use the user's name naturally, not every message.
- Refer to actual goal, weak lessons, recent progress, and marks only when available.
- Keep continuity across conversations.
- Remember stable preferences only.
- Do not sound robotic.
- Do not overdo emotional language.
- Be direct, calm, and exam-focused.
- The user prefers Sinhala, fast answers, exact schedules, target marks, and weak-area repair.
- The user studies A/L Technology: SFT, ET, ICT.
- If user says "අද මොනවද?", use current Sri Lanka time and show only remaining hours.
- If user asks for two subjects per day, output exactly two subjects.
- If user asks short, answer short.
- If user asks deep, explain deeply.

STYLE:
Sinhala first. English only for technical terms. Clean markdown. Minimal emojis. No fake motivation paragraphs. No long intro. Answer directly first.

FOR STUDY PLANS:
- exactly two subjects per day unless user overrides
- weak lessons first
- high Z-impact topics first
- lesson-wise past papers
- active recall
- wrong-answer repair
- spaced repetition
- target after the session

FOR EXPLANATIONS:
- direct answer first
- step-by-step explanation
- formula only when relevant
- exam tip
- 1-3 practice questions max

FOR PAST PAPER / PREDICTION:
- never claim exact paper prediction
- use evidence, frequency, recency, syllabus weighting, mark distribution
- show confidence level

FOR WEB/LINKS:
- never fabricate links
- use Google Search only when needed

Do not reveal hidden reasoning.
You may show only a safe reasoning summary.
Current Mode: \${mode}
\`;
}
`);

// 14. FRONTEND STREAM HOOK
write('src/hooks/useAIWorkflowStream.ts', `
import { useState, useRef } from "react";
import { auth } from "../lib/firebase";

export function useAIWorkflowStream() {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [safeSummary, setSafeSummary] = useState<string[]>([]);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function sendAIMessage({ prompt, activeSubject, mode = "auto", history = [] }: any) {
    setAnswer("");
    setError("");
    setSafeSummary([]);
    setTotalSeconds(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/ai/respond-stream", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${token || ""}\`,
        },
        body: JSON.stringify({ prompt, activeSubject, mode, history }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.message || \`AI failed \${response.status}\`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\\n\\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const eventName = raw.match(/^event:\\s*(.+)$/m)?.[1]?.trim();
          const dataText = raw.match(/^data:\\s*(.+)$/m)?.[1];
          if (!eventName || !dataText) continue;

          let data;
          try {
            data = JSON.parse(dataText);
          } catch(e) { continue; }

          if (eventName === "status") setStatus(data);
          if (eventName === "chunk") setAnswer(prev => prev + data.text);
          if (eventName === "safe_summary") setSafeSummary(data.items || []);
          if (eventName === "error") setError(data.error || "AI error");
          if (eventName === "done") {
            setIsStreaming(false);
            setTotalSeconds(data.totalSeconds);
            setStatus({
              stage: data.ok ? "done" : "error",
              label: data.ok ? "Thought" : "Stopped",
              startedAt: Date.now() - (data.totalMs || 0),
            });
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || "Network error");
        setIsStreaming(false);
        setStatus({ stage: "error", label: "Stopped" });
      }
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStatus({ stage: "error", label: "Stopped" });
  }

  return { answer, status, isStreaming, totalSeconds, safeSummary, error, sendAIMessage, cancel };
}
`);

// 15. CHATGPT-LIKE STATUS COMPONENT
write('src/components/ai/AIWorkflowStatus.tsx', `
import React, { useEffect, useState } from "react";
import { Brain, Database, Search, PenLine, ShieldCheck, ChevronRight, AlertCircle, Sparkles } from "lucide-react";

export function AIWorkflowStatus({ status, onClick }: { status: any, onClick?: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!status || status.stage === 'done' || status.stage === 'error') return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - status.startedAt) / 1000));
    }, 300);
    return () => clearInterval(interval);
  }, [status]);

  if (!status) return null;

  const icons: any = {
    thinking: <Brain className="w-4 h-4 text-amber-500 animate-pulse" />,
    auth: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    profile: <Database className="w-4 h-4 text-blue-500" />,
    progress: <Database className="w-4 h-4 text-indigo-500" />,
    memory: <Brain className="w-4 h-4 text-purple-500" />,
    sources: <Database className="w-4 h-4 text-cyan-500" />,
    search: <Search className="w-4 h-4 text-sky-500 animate-pulse" />,
    planning: <PenLine className="w-4 h-4 text-fuchsia-500" />,
    generating: <PenLine className="w-4 h-4 text-rose-500 animate-pulse" />,
    saving: <Database className="w-4 h-4 text-emerald-500" />,
    done: <Sparkles className="w-4 h-4 text-emerald-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />
  };

  const isDone = status.stage === 'done';
  const isError = status.stage === 'error';

  return (
    <div 
      onClick={isDone ? onClick : undefined}
      className={\`inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-200 shadow-lg backdrop-blur-md transition-all \${isDone ? 'cursor-pointer hover:bg-zinc-800' : ''}\`}
    >
      {icons[status.stage] || icons.thinking}
      <span>{status.label} {(!isDone && !isError) ? \`for \${elapsed}s\` : ''}</span>
      {(!isDone && !isError) && <span className="flex gap-0.5 ml-1">
        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>}
      {isDone && <ChevronRight className="w-4 h-4 text-zinc-400 ml-1" />}
    </div>
  );
}
`);

// 16. SAFE SUMMARY COMPONENT
write('src/components/ai/SafeReasoningSummary.tsx', `
import React from "react";

export function SafeReasoningSummary({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 shadow-sm text-xs text-zinc-400 font-mono">
      <div className="font-bold text-zinc-300 mb-2 pb-2 border-b border-zinc-800">How this answer was prepared</div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-zinc-600 mt-0.5">›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
`);

// Edit AI Routes to add respond-stream
write('patch_routes.cjs', `
const fs = require('fs');
let file = 'server/ai/routes.ts';
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('/respond-stream')) {
    content = content.replace(/\\/\\/ Main Respond endpoint/, 
        \`import { aiRespondStream } from "./respondStream";\\n\\naiRoutes.post("/respond-stream", async (req, res) => {\\n  try {\\n    const user = await requireUser(req);\\n    (req as any).user = user;\\n    await aiRespondStream(req, res);\\n  } catch (error: any) {\\n    res.status(500).json({ ok: false, error: error.message });\\n  }\\n});\\n\\n// Main Respond endpoint\`);
    fs.writeFileSync(file, content);
}
`);
