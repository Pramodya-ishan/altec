import { Router } from "express";
import { verifyAndExtractUser } from "../firebase/authMiddleware";
import { getRealtimeConfig } from "./config";

const requireUser = async (req: any) => {
  const user = await verifyAndExtractUser(req);
  if (!user) throw new Error("Unauthorized");
  return user;
};

const router = Router();

router.get("/status", (req, res) => {
  const cfg = getRealtimeConfig();
  res.json({
    ok: true,
    enabled: cfg.enabled,
    provider: cfg.provider,
    available: cfg.available,
    model: cfg.model,
    project: cfg.project,
    location: cfg.location,
    authMode: cfg.authMode,
    missing: cfg.missing
  });
});

router.get("/self-test", async (req, res) => {
  try {
    const cfg = getRealtimeConfig();
    if (!cfg.enabled) {
      return res.json({ ok: false, code: "REALTIME_DISABLED" });
    }
    if (cfg.provider === "gemini_live") {
      return res.json({
        ok: false,
        code: "GEMINI_LIVE_BRIDGE_NOT_IMPLEMENTED",
        message: "Gemini Live backend bridge is not implemented yet."
      });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.json({ ok: false, code: "TEST_FAILED", message: err.message });
  }
});

router.post("/session", async (req, res) => {
  try {
    await requireUser(req);
    const cfg = getRealtimeConfig();
    
    if (!cfg.enabled) {
      return res.json({
        ok: false,
        code: "REALTIME_DISABLED",
        message: "Realtime voice is disabled."
      });
    }

    if (cfg.provider === "gemini_live") {
      return res.status(501).json({
        ok: false,
        code: "GEMINI_LIVE_BRIDGE_NOT_IMPLEMENTED",
        provider: "gemini_live",
        message: "Gemini Live backend bridge is not implemented yet. OpenAI key is not required."
      });
    }

    const { activeSubject, activeSourceId } = req.body;
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
       return res.status(400).json({ ok: false, error: "Missing OPENAI_API_KEY on server.", message: "OpenAI API key is missing. For Gemini Live, please configure provider to gemini_live." });
    }

    // Call OpenAI to create an ephemeral session
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17",
        voice: process.env.OPENAI_REALTIME_VOICE || "alloy",
        instructions: `You are Clora X, a Sinhala-first A/L Technology live tutor for SFT, ET, ICT.
- Speak naturally like a teacher in a live call.
- Sinhala-first, simple, short chunks.
- Do not read long essays unless user asks.
- Ask follow-up questions when unclear.
- Allow user to interrupt.
- When explaining calculations, speak step by step.
- For official paper answers, use evidence only.
- If evidence missing, say you cannot verify from PDF and ask user to select/upload source.
- For non-syllabus/general questions, answer normally and do not attach fake PDF sources.
- Do not mention internal model/tool names.
If user mentions PDF, paper, question, Q1, MCQ, essay, structured, marking scheme, page, uploaded file, "මේ PDF එක", "pdf eke", "prashne" then call pdf_answer_tool before answering.`,
        tools: [
          {
            type: "function",
            name: "pdf_answer_tool",
            description: "Answers a question based on PDF evidence.",
            parameters: {
              type: "object",
              properties: {
                transcript: { type: "string" },
                questionNo: { type: "string" },
                questionType: { type: "string" },
                year: { type: "string" }
              },
              required: ["transcript"]
            }
          },
          {
            type: "function",
            name: "source_search_tool",
            description: "Searches for sources if not found in PDF.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" },
                subject: { type: "string" }
              },
              required: ["query"]
            }
          },
          {
            type: "function",
            name: "web_search_tool",
            description: "Searches the web for general knowledge.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" }
              },
              required: ["query"]
            }
          },
          {
            type: "function",
            name: "student_context_tool",
            description: "Gets user progress context.",
            parameters: {
              type: "object",
              properties: {
                intent: { type: "string" }
              },
              required: ["intent"]
            }
          }
        ]
      }),
    });

    if (!response.ok) {
       const errorData = await response.text();
       throw new Error(`OpenAI Realtime session error: ${response.status} ${errorData}`);
    }

    const data = await response.json();

    res.json({
      ok: true,
      clientSecret: data.client_secret.value,
      sessionId: data.id,
      expiresAt: data.client_secret.expires_at
    });
  } catch (error: any) {
    console.error("Error creating realtime session:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

router.post("/tool-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { toolName, arguments: args, chatId, activeSubject, activeSourceId, recentAttachmentIds } = req.body;
    
    if (toolName === "pdf_answer_tool") {
       const { answerFromPdfEvidence } = await import("../ai/pdfAnswerService");
       const result = await answerFromPdfEvidence({
          uid: user.uid,
          chatId,
          transcriptOrPrompt: args.transcript,
          activeSubject,
          activeSourceId,
          recentAttachmentIds,
          questionNo: args.questionNo,
          questionType: args.questionType,
          year: args.year,
          mode: "live_voice"
       });
       return res.json({ ok: true, output: result });
    }
    
    return res.json({ ok: true, output: { message: "Tool not fully implemented yet." } });
  } catch (error: any) {
    console.error("Error executing tool:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
