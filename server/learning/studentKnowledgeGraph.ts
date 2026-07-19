import { getAdminDb } from "../firebase/admin";
import type { LearningAttemptAnalysis, LearningAttemptInput, LearningMistakeType } from "./learningEngine";

export type ExplanationStrategy = "visual" | "analogy" | "worked_example" | "contrastive" | "retrieval_practice" | "concise_reteach";

export interface KnowledgeGraphNode {
  id: string;
  subject: string;
  lesson: string;
  concept: string;
  attempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  alpha: number;
  beta: number;
  mastery: number;
  confidence: number;
  difficulty: number;
  errorCounts: Partial<Record<LearningMistakeType, number>>;
  dueAt: string;
  lastAttemptAt: string;
  explanationStrategy: ExplanationStrategy;
  nextDifficulty: "foundation" | "standard" | "hard";
}

export interface TwoSubjectPlanDay {
  date: string;
  subjects: [string, string];
  blocks: [
    { period: "morning"; subject: string; minutes: number; lessons: string[]; activities: string[]; reason: string },
    { period: "evening"; subject: string; minutes: number; lessons: string[]; activities: string[]; reason: string },
  ];
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

export function normalizeConceptKey(value: unknown) {
  return String(value || "unknown")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 150) || "unknown";
}

export function chooseExplanationStrategy(params: {
  mistakeTypes?: LearningMistakeType[];
  repeatCount?: number;
  questionType?: unknown;
  previousStrategies?: ExplanationStrategy[];
}): ExplanationStrategy {
  const mistakes = new Set(params.mistakeTypes || []);
  const repeatCount = Math.max(0, Number(params.repeatCount || 0));
  const previous = new Set(params.previousStrategies || []);
  const questionType = String(params.questionType || "").toLowerCase();
  const candidates: ExplanationStrategy[] = [];
  if (questionType.includes("diagram") || mistakes.has("diagram_interpretation" as LearningMistakeType)) candidates.push("visual");
  if (mistakes.has("formula_misuse") || mistakes.has("calculation_step") || mistakes.has("unit_conversion") || mistakes.has("sign_direction" as LearningMistakeType)) candidates.push("worked_example");
  if (mistakes.has("concept_misconception")) candidates.push(repeatCount >= 2 ? "analogy" : "contrastive");
  if (mistakes.has("careless_selection") || mistakes.has("guessing") || mistakes.has("reading_error" as LearningMistakeType)) candidates.push("contrastive");
  if (repeatCount >= 3) candidates.push("retrieval_practice");
  candidates.push("concise_reteach", "worked_example", "visual", "analogy", "contrastive", "retrieval_practice");
  return candidates.find((strategy) => !previous.has(strategy)) || candidates[0];
}

export function updateKnowledgeGraphNode(params: {
  previous?: Partial<KnowledgeGraphNode> | null;
  attempt: LearningAttemptInput;
  analysis: LearningAttemptAnalysis;
  concept?: string | null;
  now?: Date;
}): KnowledgeGraphNode {
  const previous = params.previous || {};
  const now = params.now || params.attempt.now || new Date();
  const attempts = Math.max(0, Number(previous.attempts || 0)) + 1;
  const correctAttempts = Math.max(0, Number(previous.correctAttempts || 0)) + (params.attempt.correct ? 1 : 0);
  const incorrectAttempts = Math.max(0, Number(previous.incorrectAttempts || 0)) + (params.attempt.correct ? 0 : 1);
  const difficulty = clamp(Number(params.attempt.difficulty ?? previous.difficulty ?? 0.5));
  const confidenceInput = clamp(Number(params.attempt.confidence ?? 0.5));
  // Beta-Bernoulli update, softened by confidence and difficulty. It avoids
  // overreacting to one lucky MCQ while converging as evidence accumulates.
  const qualityWeight = 0.55 + confidenceInput * 0.25 + difficulty * 0.2;
  const alpha = Math.max(1, Number(previous.alpha || 2)) + (params.attempt.correct ? qualityWeight : 0);
  const beta = Math.max(1, Number(previous.beta || 2)) + (params.attempt.correct ? 0 : qualityWeight);
  const mastery = Math.round(clamp(alpha / (alpha + beta)) * 100);
  const priorConfidence = clamp(Number(previous.confidence || 0.35));
  const confidence = Number(clamp(priorConfidence * 0.72 + confidenceInput * 0.28).toFixed(3));
  const errorCounts: KnowledgeGraphNode["errorCounts"] = { ...(previous.errorCounts || {}) };
  for (const type of params.analysis.mistakeTypes) errorCounts[type] = Number(errorCounts[type] || 0) + 1;
  const explanationStrategy = chooseExplanationStrategy({
    mistakeTypes: params.analysis.mistakeTypes,
    repeatCount: incorrectAttempts,
    questionType: params.attempt.questionType,
    previousStrategies: previous.explanationStrategy ? [previous.explanationStrategy] : [],
  });
  const nextDifficulty: KnowledgeGraphNode["nextDifficulty"] = mastery >= 78 && params.attempt.correct
    ? "hard"
    : mastery < 45 || !params.attempt.correct
      ? "foundation"
      : "standard";
  const subject = String(params.attempt.subject || previous.subject || "SFT").toUpperCase();
  const lesson = String(params.attempt.lesson || previous.lesson || "Unknown lesson").trim();
  const concept = String(params.concept || params.attempt.questionId || previous.concept || lesson).trim();
  return {
    id: `${subject}:${normalizeConceptKey(lesson)}:${normalizeConceptKey(concept)}`.slice(0, 300),
    subject,
    lesson,
    concept,
    attempts,
    correctAttempts,
    incorrectAttempts,
    alpha: Number(alpha.toFixed(4)),
    beta: Number(beta.toFixed(4)),
    mastery,
    confidence,
    difficulty,
    errorCounts,
    dueAt: params.analysis.nextReviewAt,
    lastAttemptAt: now.toISOString(),
    explanationStrategy,
    nextDifficulty,
  };
}

export async function updateStudentKnowledgeGraph(params: {
  uid: string;
  attempt: LearningAttemptInput;
  analysis: LearningAttemptAnalysis;
  concept?: string | null;
}) {
  const db = getAdminDb();
  const concept = String(params.concept || params.attempt.questionId || params.attempt.lesson || "unknown");
  const nodeId = `${String(params.attempt.subject || "SFT").toUpperCase()}:${normalizeConceptKey(params.attempt.lesson)}:${normalizeConceptKey(concept)}`.slice(0, 300);
  const ref = db.collection("users").doc(params.uid).collection("knowledge_graph").doc(nodeId);
  return db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(ref);
    const node = updateKnowledgeGraphNode({ previous: snapshot.exists ? snapshot.data() : null, attempt: params.attempt, analysis: params.analysis, concept });
    transaction.set(ref, { ...node, uid: params.uid, updatedAt: new Date().toISOString(), createdAt: snapshot.exists ? snapshot.data()?.createdAt : new Date().toISOString() }, { merge: true });
    return node;
  });
}

export function rankAdaptivePractice(params: { nodes: KnowledgeGraphNode[]; questions: any[]; limit?: number; now?: Date }) {
  const now = (params.now || new Date()).getTime();
  const nodeByLesson = new Map<string, KnowledgeGraphNode[]>();
  for (const node of params.nodes) {
    const key = `${node.subject}:${normalizeConceptKey(node.lesson)}`;
    nodeByLesson.set(key, [...(nodeByLesson.get(key) || []), node]);
  }
  return params.questions.map((question: any) => {
    const subject = String(question.subject || "SFT").toUpperCase();
    const lesson = String(question.lesson || question.topic || "Unknown lesson");
    const nodes = nodeByLesson.get(`${subject}:${normalizeConceptKey(lesson)}`) || [];
    const mastery = nodes.length ? nodes.reduce((sum, node) => sum + node.mastery, 0) / nodes.length : 45;
    const due = nodes.some((node) => Date.parse(node.dueAt || "") <= now);
    const repeatedErrors = nodes.reduce((sum, node) => sum + node.incorrectAttempts, 0);
    const unseenBonus = nodes.length === 0 ? 12 : 0;
    const sourceQuality = question.verified === true ? 12 : question.sourceId ? 6 : 0;
    const priorityScore = Math.round((100 - mastery) * 0.58 + (due ? 18 : 0) + Math.min(18, repeatedErrors * 3) + unseenBonus + sourceQuality);
    return {
      ...question,
      priorityScore,
      targetDifficulty: mastery < 45 ? "foundation" : mastery >= 78 ? "hard" : "standard",
      reason: due ? "Due spaced-repetition review" : nodes.length === 0 ? "Coverage gap" : `Concept mastery ${Math.round(mastery)}%`,
    };
  }).sort((left, right) => Number(right.priorityScore) - Number(left.priorityScore)).slice(0, Math.max(1, Math.min(50, Number(params.limit || 10))));
}

export function buildHintLadder(params: {
  question: unknown;
  lesson?: unknown;
  formula?: unknown;
  markingPoints?: unknown[];
  solution?: unknown;
}) {
  const question = String(params.question || "").trim();
  const lesson = String(params.lesson || "අදාළ concept එක").trim();
  const formula = String(params.formula || "").trim();
  const markingPoints = (Array.isArray(params.markingPoints) ? params.markingPoints : []).map((point) => String((point as any)?.text || point || "").trim()).filter(Boolean);
  const solution = String(params.solution || "").trim();
  return [
    { level: 1, kind: "concept", text: `පළමුව ${lesson} තුළ ප්‍රශ්නයෙන් දී ඇති දත්ත සහ සොයන දේ වෙන් කරන්න.`, revealsAnswer: false },
    { level: 2, kind: "formula", text: formula ? `භාවිත කළ යුතු සම්බන්ධතාවය: ${formula}` : `ප්‍රශ්නයේ ප්‍රධාන සම්බන්ධතාවය ${lesson} සූත්‍ර/නියමයෙන් තෝරන්න.`, revealsAnswer: false },
    { level: 3, kind: "next_step", text: markingPoints[0] ? `ඊළඟ පියවර: ${markingPoints[0]}` : `ඊළඟ පියවරේදී දී ඇති අගයන් නිවැරදි ඒකකවලින් substitute කරන්න.`, revealsAnswer: false },
    { level: 4, kind: "full_answer", text: solution || `සම්පූර්ණ පිළිතුර තවම ලබා දී නැහැ. ප්‍රශ්නය සහ verified solution evidence එක සමඟ නැවත ඉල්ලන්න.`, revealsAnswer: Boolean(solution) },
  ].map((hint) => ({ ...hint, questionPreview: question.slice(0, 180) }));
}

function subjectUrgency(subject: string, examDates: Record<string, string>, now: Date) {
  const exam = Date.parse(String(examDates[subject] || ""));
  if (!Number.isFinite(exam)) return 0;
  const days = Math.max(0, (exam - now.getTime()) / 86_400_000);
  return Math.max(0, 40 - days);
}

export function buildStrictTwoSubjectPlan(params: {
  nodes: KnowledgeGraphNode[];
  days?: number;
  dailyMinutes?: number;
  subjects?: string[];
  examDates?: Record<string, string>;
  startDate?: Date;
}): TwoSubjectPlanDay[] {
  const days = Math.max(1, Math.min(45, Math.round(Number(params.days || 7))));
  const dailyMinutes = Math.max(60, Math.min(900, Math.round(Number(params.dailyMinutes || 600))));
  const startDate = params.startDate || new Date();
  const available = Array.from(new Set((params.subjects || ["SFT", "ET", "ICT"]).map((subject) => String(subject).toUpperCase()).filter((subject) => ["SFT", "ET", "ICT"].includes(subject))));
  for (const fallback of ["SFT", "ET", "ICT"]) if (available.length < 2 && !available.includes(fallback)) available.push(fallback);
  const examDates = params.examDates || {};
  const weaknessBySubject = new Map<string, number>();
  for (const subject of available) {
    const nodes = params.nodes.filter((node) => node.subject === subject);
    const weakness = nodes.length ? nodes.reduce((sum, node) => sum + (100 - node.mastery), 0) / nodes.length : 55;
    weaknessBySubject.set(subject, weakness + subjectUrgency(subject, examDates, startDate));
  }
  const plan: TwoSubjectPlanDay[] = [];
  for (let day = 0; day < days; day += 1) {
    const date = new Date(startDate.getTime() + day * 86_400_000);
    const ranked = [...available].sort((a, b) => Number(weaknessBySubject.get(b)) - Number(weaknessBySubject.get(a)) || a.localeCompare(b));
    const first = ranked[day % ranked.length];
    const second = ranked.find((subject) => subject !== first) || ranked[(day + 1) % ranked.length];
    const subjects: [string, string] = [first, second];
    const morningMinutes = Math.round(dailyMinutes * 0.55);
    const eveningMinutes = dailyMinutes - morningMinutes;
    const lessonsFor = (subject: string) => params.nodes
      .filter((node) => node.subject === subject)
      .sort((a, b) => a.mastery - b.mastery || b.incorrectAttempts - a.incorrectAttempts)
      .map((node) => node.lesson)
      .filter((lesson, index, list) => list.indexOf(lesson) === index)
      .slice(0, 2);
    plan.push({
      date: date.toISOString().slice(0, 10),
      subjects,
      blocks: [
        { period: "morning", subject: first, minutes: morningMinutes, lessons: lessonsFor(first), activities: ["High-yield lesson recall", "Lesson-wise past-paper questions", "Error correction"], reason: `Highest combined weakness/exam urgency (${Math.round(Number(weaknessBySubject.get(first)))})` },
        { period: "evening", subject: second, minutes: eveningMinutes, lessons: lessonsFor(second), activities: ["Concept repair", "Lesson-wise past-paper questions", "Active recall"], reason: `Second priority while preserving the exact two-subject rule` },
      ],
    });
    weaknessBySubject.set(first, Number(weaknessBySubject.get(first)) - 2);
    weaknessBySubject.set(second, Number(weaknessBySubject.get(second)) - 1);
  }
  return plan;
}
