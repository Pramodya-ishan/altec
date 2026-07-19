import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { getAdminDb, getAdminStorage } from "../firebase/admin";
import { getAIClient } from "../ai/client";

export async function askGeminiDirectPdfStream(params: {
  sourceId: string;
  pdfBuffer: Buffer;
  prompt: string;
  questionId?: string;
  subject?: string;
  year?: string;
  systemInstruction?: string;
}): Promise<{
  stream: AsyncIterable<GenerateContentResponse>;
  model: string;
}> {
  const { sourceId, pdfBuffer, prompt, questionId, subject, year } = params;
  
  console.log(`Calling Gemini Direct PDF QA (Streaming) for source ${sourceId}`);
  const ai = getAIClient();
  const modelName = "gemini-3.1-pro-preview";
  
  const systemInstruction = params.systemInstruction || `You are a specialized A/L Technology Tutor for SFT, ET, and ICT in Sri Lanka. 
You are currently reading an uploaded PDF file which is an exam paper, tute, or marking scheme.
Instructions:
- Provide accurate, helpful answers in Sinhala Unicode.
- If the question asks for a specific MCQ answer, find it in the PDF and explain why.
- If the PDF has old Sinhala fonts (legacy fonts like LKavdxl), use your visual understanding to read them correctly and output in Unicode.
- If you cannot find the answer in the provided PDF, state that clearly. Do NOT guess.
- Be precise. Cite page numbers if possible.`;

  const pdfPart = {
    inlineData: {
      mimeType: "application/pdf",
      data: pdfBuffer.toString("base64"),
    },
  };

  const textPart = {
    text: prompt,
  };

  const responseStream = await ai.models.generateContentStream({
    model: modelName,
    contents: { parts: [pdfPart, textPart] },
    config: {
      systemInstruction,
      temperature: 0.1,
      maxOutputTokens: 12_288,
    },
  });

  return {
    stream: responseStream,
    model: modelName,
  };
}

export async function askGeminiDirectPdf(params: {
  sourceId: string;
  pdfBuffer: Buffer;
  prompt: string;
  questionId?: string;
  subject?: string;
  year?: string;
}): Promise<{
  answer: string;
  cached: boolean;
  model: string;
}> {
  const { sourceId, pdfBuffer, prompt, questionId, subject, year } = params;
  const db = getAdminDb();

  // 1. Check Cache if questionId is provided
  if (questionId) {
    const cacheRef = db.collection("pdf_question_cache");
    const cacheSnap = await cacheRef
      .where("sourceId", "==", sourceId)
      .where("questionId", "==", questionId)
      .limit(1)
      .get();

    if (!cacheSnap.empty) {
      const cachedData = cacheSnap.docs[0].data();
      console.log(`Cache hit for ${sourceId} question ${questionId}`);
      return {
        answer: cachedData.answer,
        cached: true,
        model: "cached",
      };
    }
  }

  // 2. Call Gemini Direct PDF
  console.log(`Calling Gemini Direct PDF QA for source ${sourceId}, prompt length: ${prompt.length}`);
  const ai = getAIClient();
  
  // Use Gemini 3.1 Pro for better reasoning on exams
  const modelName = "gemini-3.1-pro-preview";
  
  const systemInstruction = `You are a specialized A/L Technology Tutor for SFT, ET, and ICT in Sri Lanka. 
You are currently reading an uploaded PDF file which is an exam paper, tute, or marking scheme.
Instructions:
- Provide accurate, helpful answers in Sinhala Unicode.
- If the question asks for a specific MCQ answer, find it in the PDF and explain why.
- If the PDF has old Sinhala fonts (legacy fonts like LKavdxl), use your visual understanding to read them correctly and output in Unicode.
- If you cannot find the answer in the provided PDF, state that clearly. Do NOT guess.
- Be precise. Cite page numbers if possible.`;

  const pdfPart = {
    inlineData: {
      mimeType: "application/pdf",
      data: pdfBuffer.toString("base64"),
    },
  };

  const textPart = {
    text: prompt,
  };

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [pdfPart, textPart] },
      config: {
        systemInstruction,
        temperature: 0.2, // Lower temperature for more factual answers
        maxOutputTokens: 12_288,
      },
    });

    const answer = response.text || "සමාවන්න, එම ප්‍රශ්නයට පිළිතුරු දීමට මට නොහැකි විය.";

    // 3. Save to Cache if questionId is provided
    if (questionId && answer) {
      await db.collection("pdf_question_cache").add({
        sourceId,
        questionId,
        answer,
        subject: subject || null,
        year: year || null,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      answer,
      cached: false,
      model: modelName,
    };
  } catch (err: any) {
    console.error("Gemini Direct PDF QA Error:", err);
    throw new Error(`Direct PDF QA failed: ${err.message}`);
  }
}
