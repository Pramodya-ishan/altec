export type PredictionSubject = "SFT" | "ET" | "ICT";
export type PredictionMode = "safe" | "balanced" | "surprise";
export type PredictionPaperType = "MCQ" | "Structured" | "Essay" | "Full Paper";

export interface PredictionWeights {
  frequency: number;
  syllabus: number;
  rotation: number;
  recentTrend: number;
  marks: number;
  sourceQuality: number;
  visualPattern: number;
}

export interface PredictionSettings {
  subject: PredictionSubject;
  targetYear: number;
  minimumEvidenceYears: number;
  committeeSize: number;
  maxImageQuestions: number;
  includeModelPapers: boolean;
  includeGuessingPapers: boolean;
  includeImages: boolean;
  weights: PredictionWeights;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SubjectPredictionProfile {
  subject: PredictionSubject;
  visualQuestionTypes: string[];
  preferredQuestionTypes: string[];
  visualKinds: string[];
  minimumVisualsForFullPaper: number;
  systemFocus: string;
}

const BASE_WEIGHTS: PredictionWeights = {
  frequency: 0.2,
  syllabus: 0.25,
  rotation: 0.17,
  recentTrend: 0.12,
  marks: 0.09,
  sourceQuality: 0.12,
  visualPattern: 0.05,
};

const PROFILES: Record<PredictionSubject, SubjectPredictionProfile> = {
  SFT: {
    subject: "SFT",
    visualQuestionTypes: ["calculation", "diagram", "graph", "experimental", "structured"],
    preferredQuestionTypes: ["MCQ", "Structured", "Essay", "Calculation", "Diagram"],
    visualKinds: ["free_body_diagram", "graph", "experimental_setup", "process_diagram", "apparatus"],
    minimumVisualsForFullPaper: 3,
    systemFocus: "Mechanics/calculations, scientific processes, experimental interpretation, graphs, apparatus and syllabus-bounded applied science.",
  },
  ET: {
    subject: "ET",
    visualQuestionTypes: ["engineering drawing", "diagram", "circuit", "mechanism", "construction", "structured"],
    preferredQuestionTypes: ["MCQ", "Structured", "Essay", "Drawing", "Calculation"],
    visualKinds: ["engineering_drawing", "mechanism", "circuit", "construction_detail", "process_diagram"],
    minimumVisualsForFullPaper: 4,
    systemFocus: "Engineering drawing, mechanics, electricity, manufacturing, structures, workshop processes and dimensionally valid technical diagrams.",
  },
  ICT: {
    subject: "ICT",
    visualQuestionTypes: ["flowchart", "network", "logic", "erd", "data flow", "structured"],
    preferredQuestionTypes: ["MCQ", "Structured", "Essay", "Programming", "Database"],
    visualKinds: ["flowchart", "network_topology", "logic_circuit", "erd", "data_flow_diagram"],
    minimumVisualsForFullPaper: 3,
    systemFocus: "Programming/pseudocode, databases and SQL, networks, logic circuits, web systems, data flow and system analysis.",
  },
};

export function normalizePredictionSubject(value: unknown): PredictionSubject {
  const subject = String(value || "").trim().toUpperCase();
  if (subject === "SFT" || subject === "ET" || subject === "ICT") return subject;
  throw Object.assign(new Error("Subject must be SFT, ET, or ICT."), { status: 400, code: "INVALID_PREDICTION_SUBJECT" });
}

export function getSubjectPredictionProfile(value: unknown): SubjectPredictionProfile {
  return PROFILES[normalizePredictionSubject(value)];
}

function normalizeWeights(input?: Partial<PredictionWeights>): PredictionWeights {
  const merged = { ...BASE_WEIGHTS, ...(input || {}) };
  const positive = Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, Math.max(0, Number(value) || 0)])) as unknown as PredictionWeights;
  const total = Object.values(positive).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(positive).map(([key, value]) => [key, Number((value / total).toFixed(4))])) as unknown as PredictionWeights;
}

export function defaultPredictionSettings(subjectValue: unknown, targetYear = 2026): PredictionSettings {
  const subject = normalizePredictionSubject(subjectValue);
  return {
    subject,
    targetYear: Math.max(2026, Math.min(2100, Math.trunc(Number(targetYear) || 2026))),
    minimumEvidenceYears: 3,
    committeeSize: 3,
    maxImageQuestions: PROFILES[subject].minimumVisualsForFullPaper,
    includeModelPapers: true,
    includeGuessingPapers: false,
    includeImages: true,
    weights: { ...BASE_WEIGHTS },
  };
}

export function mergePredictionSettings(subjectValue: unknown, stored: any, overrides: any = {}): PredictionSettings {
  const defaults = defaultPredictionSettings(subjectValue, overrides?.targetYear ?? stored?.targetYear);
  const combined = { ...defaults, ...(stored || {}), ...(overrides || {}) };
  return {
    ...combined,
    subject: defaults.subject,
    targetYear: Math.max(2026, Math.min(2100, Math.trunc(Number(combined.targetYear) || 2026))),
    minimumEvidenceYears: Math.max(1, Math.min(15, Math.trunc(Number(combined.minimumEvidenceYears) || 3))),
    committeeSize: Math.max(1, Math.min(5, Math.trunc(Number(combined.committeeSize) || 3))),
    maxImageQuestions: Math.max(0, Math.min(12, Math.trunc(Number(combined.maxImageQuestions) || 0))),
    includeModelPapers: combined.includeModelPapers !== false,
    includeGuessingPapers: combined.includeGuessingPapers === true,
    includeImages: combined.includeImages !== false,
    weights: normalizeWeights({ ...(stored?.weights || {}), ...(overrides?.weights || {}) }),
  };
}

export function sourceReliability(source: any): number {
  const text = `${source?.resourceType || ""} ${source?.sourceType || ""} ${source?.sourceScope || ""} ${source?.title || ""}`.toLowerCase();
  if (/official.*marking|marking.?scheme/.test(text)) return 1;
  if (/official|past.?paper/.test(text)) return 0.96;
  if (/syllabus|curriculum/.test(text)) return 1;
  if (/paper.?structure/.test(text)) return 0.9;
  if (/model.?paper/.test(text)) return 0.58;
  if (/guess|prediction/.test(text)) return 0.32;
  return source?.verified === true ? 0.72 : 0.45;
}

export function isEligiblePredictionSource(source: any, settings: PredictionSettings) {
  if (!source || source.published === false) return false;
  const text = `${source.resourceType || ""} ${source.sourceType || ""} ${source.title || ""}`.toLowerCase();
  if (/syllabus|curriculum|past.?paper|marking.?scheme|paper.?structure|reference/.test(text)) return true;
  if (/model.?paper/.test(text)) return settings.includeModelPapers;
  if (/guess|prediction/.test(text)) return settings.includeGuessingPapers;
  return false;
}
