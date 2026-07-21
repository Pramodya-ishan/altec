const FILLER_WORDS = new Set([
  "a", "an", "the", "of", "for", "from", "in", "on", "and", "to", "me", "my",
  "lesson", "lessons", "topic", "unit", "pdf", "paper", "past", "question", "questions",
  "prashna", "prasna", "discuss", "karamu", "krmu", "gamu", "gmu", "eka", "eke", "tik",
  "tika", "walin", "wlin", "wala", "oni", "need", "use", "all", "sft", "et", "ict",
  "පාඩම", "පාඩමේ", "පාඩම්", "ප්‍රශ්න", "ප්‍රශ්නය", "පත්‍ර", "පත්‍රය", "කරමු", "ටික",
]);

const LESSON_ALIASES = [
  { label: "තරල / Fluid mechanics", aliases: ["තරල", "ද්‍රව", "tharala", "tarala", "fluid", "fluids", "fluid mechanics"] },
  { label: "විද්‍යුතය / Electricity", aliases: ["විද්‍යුත", "විදුලි", "vidyuth", "vidyutha", "electricity", "electrical"], subjects: ["SFT"] },
  { label: "විදුලි තාක්ෂණය / Electrical Technology", aliases: ["electrical", "electrical technology", "power systems", "transformer", "motor", "generator", "විදුලි තාක්ෂණ", "විදුලි යන්ත්‍ර"], subjects: ["ET"] },
  { label: "ඉලෙක්ට්‍රොනික තාක්ෂණය / Electronics", aliases: ["ඉලෙක්ට්‍රොනික", "electronics", "electronic", "semiconductor", "transistor", "amplifier"], subjects: ["ET"] },
  { label: "කෘෂි තාක්ෂණය / Agro technology", aliases: ["කෘෂි", "agro", "agriculture", "agro technology"] },
  { label: "ආහාර තාක්ෂණය / Food technology", aliases: ["ආහාර", "food", "food technology"] },
  { label: "ජෛව පද්ධති / Bio systems", aliases: ["ජෛව", "bio systems", "biosystems", "bio-systems"] },
  { label: "Python", aliases: ["python", "පයිතන්"], subjects: ["ICT"] },
  { label: "Networking", aliases: ["networking", "network", "ජාල"], subjects: ["ICT"] },
  { label: "Civil engineering", aliases: ["civil", "සිවිල්"], subjects: ["ET"] },
  { label: "Database", aliases: ["database", "databases", "දත්ත සමුදා"], subjects: ["ICT"] },
] as const;

export function normalizeLessonText(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function meaningfulTokens(value: unknown) {
  return normalizeLessonText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !FILLER_WORDS.has(token));
}

export type LessonReference = {
  label: string;
  aliases: string[];
  tokens: string[];
};

export function resolveLessonReference(prompt: unknown, explicitLesson?: unknown, subject?: unknown): LessonReference | null {
  const combined = normalizeLessonText(`${explicitLesson || ""} ${prompt || ""}`);
  const normalizedSubject = String(subject || "").trim().toUpperCase();
  for (const entry of LESSON_ALIASES) {
    const allowedSubjects = "subjects" in entry ? [...entry.subjects] : [];
    if (normalizedSubject && allowedSubjects.length > 0 && !allowedSubjects.includes(normalizedSubject as any)) continue;
    if (entry.aliases.some((alias) => combined.includes(normalizeLessonText(alias)))) {
      return {
        label: entry.label,
        aliases: [...entry.aliases],
        tokens: [...new Set(entry.aliases.flatMap(meaningfulTokens))],
      };
    }
  }

  const tokens = meaningfulTokens(explicitLesson || prompt);
  if (tokens.length === 0) return null;
  const label = tokens.slice(0, 8).join(" ");
  return { label, aliases: [label], tokens };
}

function sourceLessonText(source: any) {
  return normalizeLessonText([
    source?.lesson,
    source?.title,
    source?.fileName,
    ...(Array.isArray(source?.tags) ? source.tags : []),
  ].filter(Boolean).join(" "));
}

export function scoreLessonSource(source: any, reference: LessonReference) {
  const candidate = sourceLessonText(source);
  if (!candidate) return 0;

  let score = 0;
  for (const alias of reference.aliases) {
    const normalizedAlias = normalizeLessonText(alias);
    if (normalizedAlias && candidate.includes(normalizedAlias)) score = Math.max(score, 100);
  }

  const candidateTokens = new Set(meaningfulTokens(candidate));
  const matchingTokens = reference.tokens.filter((token) => candidateTokens.has(token));
  if (reference.tokens.length > 0) {
    score = Math.max(score, Math.round((matchingTokens.length / reference.tokens.length) * 85));
  }

  const explicitLesson = normalizeLessonText(source?.lesson);
  if (explicitLesson && reference.tokens.some((token) => explicitLesson.includes(token))) score += 20;
  return Math.min(120, score);
}

export function findLessonSources(sources: any[], prompt: unknown, explicitLesson?: unknown, subject?: unknown) {
  const reference = resolveLessonReference(prompt, explicitLesson, subject);
  if (!reference) return { reference: null, sources: [] as any[] };

  const ranked = (sources || [])
    .map((source) => ({ source, score: scoreLessonSource(source, reference) }))
    .filter((entry) => entry.score >= 40)
    .sort((a, b) => b.score - a.score);

  return {
    reference,
    sources: ranked.map((entry) => ({ ...entry.source, lessonMatchScore: entry.score })),
  };
}

export function isLessonEvidenceMode(mode: unknown) {
  return ["lesson_pdf_search", "lesson_question_discussion", "lesson_theory_explanation", "past_paper_lesson_search"].includes(String(mode || ""));
}
