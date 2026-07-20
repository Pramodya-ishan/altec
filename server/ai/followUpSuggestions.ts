export function buildFollowUpSuggestionPrompt(userPrompt: unknown, assistantAnswer: unknown) {
  return `Create exactly 3 short, useful next actions for this learner. Match the actual topic and answer; never output a generic template menu. Write in the learner's language (Sinhala/Singlish where natural). Return only a JSON array of 3 strings.\n\nUSER:\n${String(userPrompt || "").slice(0, 1_500)}\n\nANSWER:\n${String(assistantAnswer || "").slice(0, 2_500)}`;
}

export function parseFollowUpSuggestions(value: unknown): string[] {
  const source = String(value || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(source.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item || "").trim()).filter((item) => item.length >= 3 && item.length <= 160))].slice(0, 3);
  } catch {
    return [];
  }
}

export async function withSuggestionTimeout<T>(promise: Promise<T>, timeoutMs = 1_800): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
