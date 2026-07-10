import { getAIClient } from "../client";

export async function readUrlsWithGemini(params: {
  urls: string[];
  question: string;
  subject?: string;
}): Promise<{
  answer: string;
  sources: Array<{ title?: string; url: string; status?: string }>;
}> {
  const { urls, question, subject } = params;
  
  if (!urls || urls.length === 0) {
    return { answer: "No URLs provided.", sources: [] };
  }

  const ai = getAIClient();
  const model = process.env.GEMINI_URL_CONTEXT_MODEL || "gemini-2.5-flash";

  // For URLs, we'll try to fetch basic text if possible to feed as context, 
  // but we can also use Gemini's built in search tools or just pass the text.
  // Given standard environments without specialized scraping, we fetch text manually for simple sites
  // Or we just prompt the model to use googleSearch for those URLs.
  
  let fetchedContext = "";
  const sources = [];

  for (const url of urls.slice(0, 20)) { // limit to 20
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const text = await res.text();
        // naive extraction, limit to 10000 chars per url
        fetchedContext += `\n--- Content from ${url} ---\n${text.substring(0, 10000)}\n`;
        sources.push({ title: "Fetched URL", url, status: "success" });
      } else {
        sources.push({ url, status: "failed" });
      }
    } catch (e) {
      sources.push({ url, status: "failed" });
    }
  }

  const promptText = `
Subject Context: ${subject || "General"}
User Question: ${question}

Context from URLs:
${fetchedContext}

Please answer the user's question based on the provided URL context. If the text is raw HTML or noisy, extract the relevant information. Answer in Sinhala if the question implies it.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: promptText,
      config: {
        temperature: 0.3,
      },
    });

    return {
      answer: response.text || "Failed to generate answer.",
      sources,
    };
  } catch (error) {
    console.error("URL Context error:", error);
    return {
      answer: "Could not read the provided URLs or generate an answer.",
      sources,
    };
  }
}
