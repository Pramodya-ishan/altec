import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { enqueueGeminiTask } from './queue';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy",
});

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
    sendEvent('status', { phase: 'checking_zscore_history', message: 'Reviewing progress history...' });
    
    const targetModel = chatMode || 'gemini-2.5-flash';

    const historyContents = history.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text || '-' }]
    }));
    
    let basePrompt = `Message: ${message}\n`;
    if (requirementAnswers) {
       basePrompt += `Requirements: ${JSON.stringify(requirementAnswers)}\n`;
    }

    const isRegenerate = /regenerate|improve|add more/i.test(message || "");
    let tryModelsStream = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
    if (chatMode) { tryModelsStream = [chatMode, ...tryModelsStream]; }

    if (isRegenerate) {
       sendEvent('status', { phase: 'running_final_writer', message: 'Enhancing the response...' });

       let lastError = null;
       let success = false;
       for (const m of tryModelsStream) {
         try {
           await enqueueGeminiTask(async () => {
             const finalStream = await ai.models.generateContentStream({
               model: m,
               contents: [...historyContents, { role: 'user', parts: [{ text: basePrompt + `\n\nEnhance the previous response according to the user's latest message. Strictly output Markdown.` }] }],
               config: { systemInstruction: "You are 1st Edition, an elite GCE A/L advisor. Format beautifully in Markdown. IMPORTANT: Always refer to the physics heat formulas ($Q = mc\\theta$, $Q = mL$) when discussing/answering energy or heat calculations in SFT. Mention that 'විභාගය පැවැත්වෙන්නේ 2026 අගෝස්තු මස 01 වනදාය. ඔබට ඉතිරිව ඇත්තේ තත්පරයෙන් තත්පරය ගෙවී යන දින 47ක් පමණි.' with strict conviction. Do not use informal terms like 'Ayya', 'Malli', 'Nangi', or 'Akka'." }
             });
             for await (const chunk of finalStream) {
                if (chunk.text) {
                   sendEvent('final_chunk', { text: chunk.text });
                }
             }
           });
           success = true;
           break;
         } catch (e: any) {
           lastError = e;
           console.warn(`Final stream regenerate failed on ${m}`, e.message);
         }
       }
       if (!success) throw lastError;

       sendEvent('final_complete', { success: true });
       sendEvent('done', { success: true });
       return res.end();
    }

    sendEvent('status', { phase: 'running_final_writer', message: 'Preparing your personalized plan...' });
    
    // FINAL RESPONSE
    let lastError = null;
    let success = false;
    for (const m of tryModelsStream) {
      try {
        await enqueueGeminiTask(async () => {
          const finalStream = await ai.models.generateContentStream({
            model: m,
            contents: [...historyContents, { role: 'user', parts: [{ text: basePrompt + `\n\nProvide the response strictly in Markdown.` }] }],
            config: { systemInstruction: "You are 1st Edition, an elite strategic advisor for A/L students. Format beautifully in Markdown. IMPORTANT: Always refer to the physics heat formulas ($Q = mc\\theta$, $Q = mL$) when discussing heat or any energy calculation in SFT. Do not use informal headings like 'Ayya', 'Nangi', 'Akka'. You MUST explicitly output this exact warning statement: '($Q = mc\\theta$, $Q = mL$) විභාගය පැවැත්වෙන්නේ 2026 අගෝස්තු මස 01 වනදාය. ඔබට ඉතිරිව ඇත්තේ තත්පරයෙන් තත්පරය ගෙවී යන දින 47ක් පමණි.**' with absolute conviction." }
          });
          for await (const chunk of finalStream) {
             if (chunk.text) {
                sendEvent('final_chunk', { text: chunk.text });
             }
          }
        });
        success = true;
        break;
      } catch (e: any) {
         lastError = e;
         console.warn(`Final stream failed on ${m}`, e.message);
      }
    }
    if (!success) throw lastError;

    sendEvent('final_complete', { success: true });
    sendEvent('done', { success: true });
  } catch (error: any) {
    console.error('Stream error:', error);
    let msg = error.message || 'Generation failed';
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy") {
      msg = "Configuration Error: GEMINI_API_KEY is missing in Vercel Environment Variables. Please add it in your Vercel Dashboard.";
    }
    sendEvent('error', { message: msg });
  } finally {
    res.end();
  }
};
