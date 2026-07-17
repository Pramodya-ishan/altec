import { Router } from "express";
import { requireUser, getAdminDb } from "../firebase/admin";
import { detectPdfIntent } from "../ai/pdfIntentDetector";
import { retrieveRelevantKnowledge } from "../knowledge/retrieve";
import { getAIClient } from "../ai/client";
import { callGeminiWithFallback } from "../ai/modelRouter";
import crypto from "crypto";
import { APP_ASSISTANT_RESPONSE_GUIDE } from "../ai/assistantBehavior";
import { isSimpleGreeting, sanitizeAssistantText, simpleGreetingReply } from "../ai/responseHygiene";

export const voiceRoutes = Router();

voiceRoutes.post("/live-turn", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { transcript, chatId, activeSubject, activeSourceId, recentAttachmentIds, usePdfContext } = req.body;

    if (!transcript) {
      return res.status(400).json({ ok: false, message: "Transcript is required" });
    }

    const intent = detectPdfIntent(transcript);
    let answerText = "";
    let mode = "live_normal_answer";
    let usedSources: any[] = [];
    let promptContext = "";

    const db = getAdminDb();

    if (intent.isPdfIntent && usePdfContext) {
      mode = "live_pdf_answer";
      
      // Determine which source to use
      let sourceIdToUse = activeSourceId;
      if (!sourceIdToUse && recentAttachmentIds && recentAttachmentIds.length > 0) {
        sourceIdToUse = recentAttachmentIds[0];
      }

      if (!sourceIdToUse && intent.needsSourceSelection) {
        // Need user to select a PDF
        return res.json({
          ok: true,
          mode: "live_pdf_answer",
          transcript,
          answerText: "කරුණාකර ඔබට අවශ්‍ය PDF එක select කරන්න හෝ upload කරන්න.",
          sources: []
        });
      }

      // If we have a source, fetch chunks
      if (sourceIdToUse) {
        const retrieveResult = await retrieveRelevantKnowledge({
          query: transcript,
          subject: intent.subject || activeSubject || "general",
        });

        const activeChunks = retrieveResult.chunks || [];
        if (activeChunks.length > 0) {
          promptContext = "Here is the PDF context:\n" + activeChunks.map((c: any) => c.text).join("\n\n");
          usedSources = activeChunks.map((c: any) => ({
            sourceId: c.sourceId || sourceIdToUse,
            title: c.title || "Uploaded PDF",
            pageNumber: c.metadata?.pageNumber || c.page,
            confidence: c.similarity || 1,
            usedInAnswer: true
          }));
        } else {
          // Could not find in the specific PDF, or no chunks
          promptContext = "No relevant context found in the active PDF.";
        }
      }
    }

    if (isSimpleGreeting(transcript) && mode === "live_normal_answer") {
      answerText = simpleGreetingReply(transcript);
    } else {
      // Generate a grounded answer using the same application response contract
      // as the text Assistant. Voice output must not expose internal prompts or
      // machine directives either.
      let systemInstruction = `You are the Tec A/L study assistant for Sri Lankan students.
${APP_ASSISTANT_RESPONSE_GUIDE}`;
      let aiTask: "normal_chat" | "direct_pdf_solve" = "normal_chat";

      if (mode === "live_pdf_answer") {
        systemInstruction += " Use only the provided PDF context. If the evidence is missing, say that the selected PDF could not verify the answer; do not guess.";
        aiTask = "direct_pdf_solve";
      }

      const aiRes = await callGeminiWithFallback(aiTask, {
        model: "gemini-2.5-flash",
        contents: promptContext ? `Context:
${promptContext}

Question: ${transcript}` : transcript,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      answerText = sanitizeAssistantText(aiRes.result.text || "මට ප්‍රශ්නය තේරුණේ නැහැ. කරුණාකර නැවත කියන්න.");
    }

    // Generate TTS (using internal fetch to /api/tts/generate or calling it directly)
    const { generateGoogleTts } = await import("../tts/googleTts");
    const { getAdminBucket } = await import("../firebase/admin");
    const storageBucket = getAdminBucket();

    const cleanText = answerText.replace(/```json[\s\S]*?```/g, "").replace(/\[.*?\]/g, "").trim().substring(0, 4500);

    const audioData = await generateGoogleTts({ text: cleanText, languageCode: "si-LK", voice: "auto" });

    const requestId = crypto.randomUUID();
    const storagePath = `users/${user.uid}/tts/${requestId}/voice.mp3`;
    const file = storageBucket.file(storagePath);
    await file.save(audioData.buffer, { contentType: "audio/mpeg" });

    let ttsAudioUrl = "";
    try {
      const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 });
      ttsAudioUrl = signedUrl;
    } catch (e) {}

    res.json({
      ok: true,
      mode,
      transcript,
      answerText,
      ttsStoragePath: storagePath,
      ttsAudioUrl,
      sources: usedSources
    });
  } catch (err: any) {
    console.error("Live turn error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});
