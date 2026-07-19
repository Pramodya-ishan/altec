import { getAdminDb } from "../firebase/admin";

export type AiTelemetryEvent = {
  id: string;
  kind: "answer" | "pdf_preview" | "pdf_processing" | "ocr" | "image_generation";
  ok: boolean;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  code?: string | null;
  mode?: string | null;
  model?: string | null;
  completed?: boolean | null;
  autoContinued?: boolean | null;
  completionPasses?: number | null;
  qualityPassed?: boolean | null;
  qualityCoveragePercent?: number | null;
  qualityRepaired?: boolean | null;
  sourceCount?: number | null;
  degraded?: boolean | null;
};

const events: AiTelemetryEvent[] = [];

function boundedNumber(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : 0;
}

export async function recordAiTelemetry(input: Partial<AiTelemetryEvent> & Pick<AiTelemetryEvent, "id" | "kind" | "ok">) {
  const endedAt = input.endedAt || new Date().toISOString();
  const startedAt = input.startedAt || endedAt;
  const event: AiTelemetryEvent = {
    id: String(input.id).slice(0, 160),
    kind: input.kind,
    ok: input.ok === true,
    startedAt,
    endedAt,
    durationMs: boundedNumber(input.durationMs || Date.parse(endedAt) - Date.parse(startedAt), 0, 60 * 60 * 1000),
    code: input.code ? String(input.code).slice(0, 120) : null,
    mode: input.mode ? String(input.mode).slice(0, 120) : null,
    model: input.model ? String(input.model).slice(0, 160) : null,
    completed: input.completed ?? null,
    autoContinued: input.autoContinued ?? null,
    completionPasses: input.completionPasses == null ? null : boundedNumber(input.completionPasses, 0, 10),
    qualityPassed: input.qualityPassed ?? null,
    qualityCoveragePercent: input.qualityCoveragePercent == null ? null : boundedNumber(input.qualityCoveragePercent, 0, 100),
    qualityRepaired: input.qualityRepaired ?? null,
    sourceCount: input.sourceCount == null ? null : boundedNumber(input.sourceCount, 0, 200),
    degraded: input.degraded ?? null,
  };
  events.unshift(event);
  if (events.length > 500) events.length = 500;

  if (process.env.AI_TELEMETRY_PERSIST === "false" || process.env.NODE_ENV === "test") return event;
  try {
    await getAdminDb().collection("ai_observability_events").doc(event.id).set(event, { merge: true });
  } catch (error) {
    console.warn("[AI_TELEMETRY] Persistence skipped", { id: event.id, error: String(error) });
  }
  return event;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

export function getAiTelemetrySnapshot(limit = 100) {
  const selected = events.slice(0, Math.max(1, Math.min(500, limit)));
  const answers = selected.filter((event) => event.kind === "answer");
  const previews = selected.filter((event) => event.kind === "pdf_preview");
  const qualityEvents = answers.filter((event) => event.qualityPassed != null);
  const completedAnswers = answers.filter((event) => event.completed === true);
  const percent = (numerator: number, denominator: number) => denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
  return {
    windowSize: selected.length,
    answerCount: answers.length,
    completionRate: percent(completedAnswers.length, answers.length),
    qualityPassRate: percent(qualityEvents.filter((event) => event.qualityPassed === true).length, qualityEvents.length),
    autoContinuationRate: percent(answers.filter((event) => event.autoContinued === true).length, answers.length),
    qualityRepairRate: percent(qualityEvents.filter((event) => event.qualityRepaired === true).length, qualityEvents.length),
    previewSuccessRate: percent(previews.filter((event) => event.ok && !event.degraded).length, previews.length),
    previewFallbackCount: previews.filter((event) => event.degraded === true).length,
    p95AnswerLatencyMs: percentile(answers.map((event) => event.durationMs), 0.95),
    recentFailures: selected.filter((event) => !event.ok).slice(0, 20),
    recent: selected.slice(0, 50),
  };
}
