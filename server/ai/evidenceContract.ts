export type AnswerEvidenceStatus = "official" | "ai_solved" | "predicted" | "model_question" | "general";

export interface EvidenceRegion {
  pageNumber: number | null;
  textStart: number | null;
  textEnd: number | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

export interface EvidenceContractItem {
  index: number;
  sourceId: string | null;
  title: string;
  sourceType: string;
  confidence: number;
  verified: boolean;
  answerValue: string | null;
  region: EvidenceRegion;
  citationLabel: string;
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeBox(value: any): EvidenceRegion["boundingBox"] {
  if (!value || typeof value !== "object") return null;
  const x = finite(value.x ?? value.left);
  const y = finite(value.y ?? value.top);
  const width = finite(value.width ?? (finite(value.right) != null && x != null ? Number(value.right) - x : null));
  const height = finite(value.height ?? (finite(value.bottom) != null && y != null ? Number(value.bottom) - y : null));
  if ([x, y, width, height].some((part) => part == null) || Number(width) <= 0 || Number(height) <= 0) return null;
  return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
}

export function buildEvidenceContract(sources: any[] = []): EvidenceContractItem[] {
  return sources.slice(0, 40).map((source: any, index) => {
    const metadata = source?.metadata || {};
    const pageNumber = finite(source?.pageNumber ?? source?.page ?? metadata.pageNumber);
    const textStart = finite(source?.textStart ?? metadata.textStart ?? metadata.charStart);
    const textEnd = finite(source?.textEnd ?? metadata.textEnd ?? metadata.charEnd);
    const boundingBox = normalizeBox(source?.boundingBox ?? source?.imageRegion ?? source?.crop ?? metadata.boundingBox ?? metadata.imageRegion);
    const sourceId = String(source?.sourceId || source?.id || "").trim() || null;
    const title = String(source?.title || source?.fileName || "Evidence source");
    const sourceType = String(source?.resourceType || source?.sourceType || source?.badge || "source");
    const answerValue = String(source?.officialAnswer || source?.estimatedAnswer || source?.answer || "").trim() || null;
    const confidence = Math.max(0, Math.min(1, Number(source?.confidence ?? 0.75)));
    return {
      index: index + 1,
      sourceId,
      title,
      sourceType,
      confidence,
      verified: source?.verified !== false && Boolean(sourceId || source?.url),
      answerValue,
      region: { pageNumber, textStart, textEnd, boundingBox },
      citationLabel: `[${index + 1}: ${title}${pageNumber ? ` · p.${pageNumber}` : ""}]`,
    };
  });
}

function canonicalAnswer(value: unknown) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}.+-]+/gu, " ").trim();
}

export function detectEvidenceContradictions(contract: EvidenceContractItem[]) {
  const claims = contract.filter((item) => item.answerValue && item.verified);
  const contradictions: Array<{ sourceA: number; sourceB: number; valueA: string; valueB: string }> = [];
  for (let left = 0; left < claims.length; left += 1) {
    for (let right = left + 1; right < claims.length; right += 1) {
      const valueA = canonicalAnswer(claims[left].answerValue);
      const valueB = canonicalAnswer(claims[right].answerValue);
      if (!valueA || !valueB || valueA === valueB) continue;
      contradictions.push({ sourceA: claims[left].index, sourceB: claims[right].index, valueA, valueB });
    }
  }
  return contradictions.slice(0, 20);
}

export function classifyAnswerEvidenceStatus(params: { prompt?: unknown; mode?: unknown; sources?: any[] }): AnswerEvidenceStatus {
  const text = `${String(params.prompt || "")} ${String(params.mode || "")}`.toLowerCase();
  if (/past_paper_analysis|predict|forecast|guessing|අනුමාන/u.test(text)) return "predicted";
  if (/model_question_generation|model question|practice question/u.test(text)) return "model_question";
  const contract = buildEvidenceContract(params.sources);
  if (contract.some((source) => source.verified && /official|marking|scheme/u.test(`${source.sourceType} ${source.title}`))) return "official";
  if (contract.some((source) => source.verified)) return "ai_solved";
  return "general";
}

export function attachEvidenceContractToSources(sources: any[] = []) {
  const contract = buildEvidenceContract(sources);
  return sources.map((source, index) => ({
    ...source,
    verified: contract[index]?.verified ?? source?.verified !== false,
    evidenceRegion: contract[index]?.region || null,
    citationLabel: contract[index]?.citationLabel || null,
  }));
}

export function evidenceContractInstruction(contract: EvidenceContractItem[], contradictions = detectEvidenceContradictions(contract)) {
  return `\n\nEVIDENCE CONTRACT:
${JSON.stringify(contract)}
- Cite source indices next to document-grounded claims and include the page when supplied.
- Never upgrade AI-solved/model/predicted content to Official.
- Never infer a hidden diagram, crop, dimension, option, or marking point.
${contradictions.length > 0 ? `- CONTRADICTION ALERT: ${JSON.stringify(contradictions)}. State the conflict and do not choose silently.` : "- No explicit answer-value contradiction was detected in the supplied source metadata."}`;
}
