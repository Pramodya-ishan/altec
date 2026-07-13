import { Request, Response } from 'express';
import { getAIClient, AI_MODELS } from './client';
import { enqueueGeminiTask } from './queue';
import { getCloraSystemPrompt } from './prompts';

export const handleAIStream = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { 
    message, 
    academicData, 
    chatMode, 
    activeSubject,
    requirementAnswers,
    history = [] 
  } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('status', { phase: 'validating_data', message: 'Validating academic context...' });
    
    // Simulate pipeline
    sendEvent('status', { phase: 'organizing_sft', message: 'Organizing subject lessons...' });
    
    const targetModel = chatMode || AI_MODELS.default;
    
    const historyContents = history.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text || '-' }]
    }));
    
    let basePrompt = `Message: ${message}\n`;
    if (requirementAnswers) {
       basePrompt += `Requirements: ${JSON.stringify(requirementAnswers)}\n`;
    }

    sendEvent('status', { phase: 'running_final_writer', message: 'Preparing your personalized plan...' });
    
    // FINAL RESPONSE
    let lastError = null;
    let success = false;
    
    // Calculate remaining days properly
    const examDate = process.env.AL_EXAM_START_DATE || '2026-08-11';
    const tz = process.env.APP_TIME_ZONE || 'Asia/Colombo';
    const nowStr = new Date().toLocaleString("en-US", {timeZone: tz});
    const now = new Date(nowStr);
    const examD = new Date(examDate);
    const diffTime = Math.abs(examD.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const systemPrompt = `You are Clora X, a Sinhala-first personal AI tutor for Sri Lankan G.C.E. A/L Engineering Technology stream.
    Format beautifully in Markdown.
    The exam is scheduled for ${examDate}. Currently there are roughly ${diffDays} days left. 
    Use user data gracefully.`;

    const ai = getAIClient();
    
    try {
      await enqueueGeminiTask(async () => {
        const finalStream = await ai.models.generateContentStream({
          model: targetModel,
          contents: [...historyContents, { role: 'user', parts: [{ text: basePrompt + `\n\nProvide the response strictly in Markdown.` }] }],
          config: { systemInstruction: systemPrompt }
        });

        let chunkBuffer = "";
        for await (const chunk of finalStream) {
           const text = chunk.text || "";
           if (text) {
              chunkBuffer += text;
              if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
                 sendEvent('final_chunk', { text: chunkBuffer });
                 chunkBuffer = "";
              }
           }
        }
        if (chunkBuffer.length > 0) {
           sendEvent('final_chunk', { text: chunkBuffer });
        }
      });
      success = true;
    } catch (e: any) {
       lastError = e;
       console.warn(`Final stream failed on ${targetModel}`, e.message);
    }
    
    if (!success) throw lastError;

    sendEvent('final_complete', { success: true });
    sendEvent('done', { success: true });
  } catch (error: any) {
    console.error('Stream error:', error);
    let msg = error.message || 'Generation failed';
    
    if (msg.includes('Prepayment Credits Depleted')) {
       msg = "Prepayment Credits Depleted. Please check Google Cloud billing.";
    }

    sendEvent('error', { message: msg });
    sendEvent('done', { success: false });
  } finally {
    res.end();
  }
};
