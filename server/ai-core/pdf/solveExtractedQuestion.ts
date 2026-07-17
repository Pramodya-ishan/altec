import { getAIClient, AI_MODELS } from "../../ai/client";

export interface SolveMcqParams {
  questionText: string;
  options: string[];
  subject: string;
  year: string;
  questionNo: string;
}

export interface SolvedMcqResult {
  optionNo: string | null;
  optionText: string | null;
  formulaOrRule: string | null;
  explanationSinhala: string | null;
  whyOthersWrong: string[] | null;
  confidence: number;
  answerStatus: "official_marking_scheme" | "ai_solved_from_extracted_question" | "unknown";
  visualAid?: {
    type: "comparison_bars" | "process_flow" | "none";
    title?: string;
    items?: { label: string; value: number; displayValue?: string }[];
    steps?: string[];
    caption?: string;
  } | null;
}

export async function solveExtractedMcqQuestion(params: SolveMcqParams): Promise<SolvedMcqResult | null> {
  const { questionText, options, subject, year, questionNo } = params;
  const normalizedOptions = options.map((option, index) => {
    const cleaned = String(option || "").replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/u, "").trim();
    return `(${index + 1}) ${cleaned}`;
  });
  
  const ai = getAIClient();
  const modelName = AI_MODELS.pdf; // Using Flash for solver

  const systemInstruction = `
You are solving an already verified Sri Lankan A/L ${subject} MCQ.
The question and options below were extracted from the official ${year} PDF.
Choose the best answer.

RULES:
- Do not change the question text.
- Do not create a new question.
- Choose exactly one option (1, 2, 3, 4, or 5).
- Explain the logic clearly in Sinhala.
- Add a small visualAid only when a comparison or process diagram materially clarifies the answer.
- visualAid must contain factual values derived from the verified question and your calculation; otherwise use type:"none".
- Return JSON only.
`;

  const userPrompt = `
Question Number: ${questionNo}
Question Text: ${questionText}

Options:
${normalizedOptions.join("\n")}

Return JSON:
{
  "optionNo": "1|2|3|4|5",
  "optionText": "text of the selected option",
  "formulaOrRule": "any formula or rule used",
  "explanationSinhala": "clear explanation in Sinhala",
  "whyOthersWrong": ["reason 1", "reason 2"],
  "confidence": 0.0-1.0,
  "answerStatus": "ai_solved_from_extracted_question",
  "visualAid": {
    "type": "none|comparison_bars|process_flow",
    "title": "short title",
    "items": [{ "label": "label", "value": 1, "displayValue": "1×" }],
    "steps": ["step 1", "step 2"],
    "caption": "short factual caption"
  }
}
`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json"
      }
    });

    if (!response.text) return null;

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (err) {
    console.error("[AI_CORE] MCQ Solver failed:", err);
    return null;
  }
}
