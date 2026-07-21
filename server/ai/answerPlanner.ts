import { getAIClient } from "./client";
import { callGeminiWithFallback, AITask } from "./modelRouter";
import { extractRequestedSubparts } from "./answerCompleteness";

export type AnswerPlan = {
  requirements: string[];
  targetStructure: string[];
  calculationChecks: string[];
  evidenceNeeds: string[];
  visualNeed: "required" | "helpful" | "none" | "unknown";
  answerLanguage: "si" | "en" | "mixed";
  generatedBy: "deterministic" | "pro_model";
};

function list(value: unknown, limit = 20) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseJson(value: unknown) {
  const text = String(value || "").trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try { return JSON.parse(text); } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Planner JSON was invalid.");
  }
}

export function deterministicAnswerPlan(prompt: string): AnswerPlan {
  const labels = extractRequestedSubparts(prompt);
  const calculation = /(?:calculate|find|compute|ගණනය|සොයන්න|කොපමණද|බලය|ඝර්ෂණ|වේග|ස්කන්ධ|unit|ඒකක)/iu.test(prompt);
  const visual = /(?:figure|diagram|drawing|graph|table|රූප|සටහන|ප්‍රස්තාර|වගුව|පෙනුම|මානය)/iu.test(prompt);
  const official = /(?:official|past\s*paper|marking\s*scheme|PDF|නිල|පසුගිය\s*ප්‍රශ්න|ලකුණු\s*පටිපාටි)/iu.test(prompt);
  return {
    requirements: labels.length > 0 ? labels.map((label) => `Answer ${label}`) : ["Answer every explicit user request"],
    targetStructure: labels.length > 0 ? labels : ["Direct answer", "Checked explanation"],
    calculationChecks: calculation ? ["Formula", "Substitution", "SI unit", "Sign/direction", "Independent recalculation"] : [],
    evidenceNeeds: official ? ["Verified selected source", "Page/question match", "No invented official claims"] : [],
    visualNeed: visual ? "required" : "unknown",
    answerLanguage: /[\u0D80-\u0DFF]/u.test(prompt) ? "si" : "en",
    generatedBy: "deterministic",
  };
}

export async function createAnswerPlan(params: {
  prompt: unknown;
  mode: unknown;
  sources?: any[];
  evidenceRequired?: boolean;
  useModel?: boolean;
  plannerTask?: Extract<AITask, "fast_background" | "final_answer">;
}): Promise<AnswerPlan> {
  const prompt = String(params.prompt || "").slice(0, 30_000);
  const fallback = deterministicAnswerPlan(prompt);
  if (params.useModel === false || process.env.AI_PLANNER_ENABLED === "false") return fallback;
  const sourceManifest = (Array.isArray(params.sources) ? params.sources : []).slice(0, 20).map((source: any) => ({
    title: source?.title || source?.fileName || "Source",
    pageNumber: source?.pageNumber || source?.page || null,
    verified: source?.verified !== false,
  }));
  try {
    const { result } = await callGeminiWithFallback(params.plannerTask || "fast_background", {
      model: "ignored",
      contents: `Create a concise execution plan for answering this student request. Do not solve it and do not provide hidden reasoning.\n\nRequest:\n${prompt}\n\nMode: ${String(params.mode || "auto")}\nEvidence required: ${params.evidenceRequired === true}\nSources: ${JSON.stringify(sourceManifest)}\n\nReturn JSON only: {"requirements":string[],"targetStructure":string[],"calculationChecks":string[],"evidenceNeeds":string[],"visualNeed":"required|helpful|none|unknown","answerLanguage":"si|en|mixed"}`,
      config: {
        systemInstruction: "You are an exam-answer planner. Produce only a short auditable plan, never an answer or private chain-of-thought.",
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens: 2_048,
      },
    }, getAIClient());
    const value = parseJson(result.text || "");
    const visualNeed = ["required", "helpful", "none", "unknown"].includes(String(value?.visualNeed)) ? value.visualNeed : fallback.visualNeed;
    const answerLanguage = ["si", "en", "mixed"].includes(String(value?.answerLanguage)) ? value.answerLanguage : fallback.answerLanguage;
    return {
      requirements: list(value?.requirements).length ? list(value.requirements) : fallback.requirements,
      targetStructure: list(value?.targetStructure).length ? list(value.targetStructure) : fallback.targetStructure,
      calculationChecks: list(value?.calculationChecks),
      evidenceNeeds: list(value?.evidenceNeeds),
      visualNeed,
      answerLanguage,
      generatedBy: "pro_model",
    };
  } catch (error) {
    console.warn("[ANSWER_PLANNER] Falling back to deterministic plan", String(error));
    return fallback;
  }
}

export function plannerContext(plan: AnswerPlan) {
  return `\n\nAUDITABLE ANSWER PLAN (execute silently; do not quote this block):\n${JSON.stringify(plan)}`;
}
