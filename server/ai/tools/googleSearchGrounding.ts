import { getAIClient } from "../client";

export async function groundedSearch(
  query: string,
  options?: { maxResults?: number; language?: "si" | "en" }
): Promise<{
  summary: string;
  sources: Array<{ title: string; url: string; snippet?: string; confidence?: number }>;
  rawGroundingMetadata?: any;
}> {
  try {
    const ai = getAIClient();
    const model = process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash";
    
    // We append instruction to ensure language is respected
    let enhancedQuery = query;
    if (options?.language === "si") {
      enhancedQuery += " (Please provide answer in Sinhala if possible)";
    }

    const response = await ai.models.generateContent({
      model,
      contents: enhancedQuery,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const searchChunks = groundingMetadata?.groundingChunks || [];
    
    const sources = searchChunks.map((chunk: any) => {
      const web = chunk.web || chunk.webSource;
      return {
        title: web?.title || "Web Search Result",
        url: web?.uri || web?.url || "",
        snippet: web?.snippet || "",
        confidence: 0.9,
      };
    }).filter((s: any) => s.url);

    return {
      summary: response.text || "No summary provided.",
      sources,
      rawGroundingMetadata: groundingMetadata,
    };
  } catch (error) {
    console.error("Grounded search error:", error);
    return {
      summary: "Search tool temporarily unavailable.",
      sources: [],
    };
  }
}
