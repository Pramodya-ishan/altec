import { createHash } from "node:crypto";

export interface ContextBudgetResult {
  text: string;
  originalChars: number;
  usedChars: number;
  removedChars: number;
  blockCount: number;
  keptBlockCount: number;
  truncated: boolean;
}

function normalizeText(value: unknown) {
  return String(value || "").normalize("NFKC").replace(/\r\n?/gu, "\n");
}

function fingerprint(value: string) {
  return createHash("sha1").update(value.replace(/\s+/gu, " ").trim().toLowerCase()).digest("hex").slice(0, 16);
}

function promptTerms(prompt: string) {
  return new Set(prompt
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3)
    .slice(0, 80));
}

function scoreBlock(block: string, terms: Set<string>, index: number) {
  const lower = block.toLowerCase();
  let score = Math.max(0, 20 - index);
  if (/\[(?:exact|selected|official|question|marking|pdf|locked|syllabus|project syllabus)/iu.test(block)) score += 80;
  if (/(?:question\s*text|official\s*answer|marking\s*scheme|නිල|ප්‍රශ්නය|ලකුණු)/iu.test(block)) score += 35;
  if (/(?:untrusted source instruction removed|warning|threat)/iu.test(block)) score += 20;
  let overlap = 0;
  for (const term of terms) if (lower.includes(term)) overlap += 1;
  score += Math.min(40, overlap * 3);
  return score;
}

function splitBlocks(text: string) {
  const blocks = text
    .split(/\n(?=\[[A-Z][^\]\n]{1,100}\])/u)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks : [text];
}

export function compactEvidenceContext(value: unknown, prompt: unknown, maxChars: number): ContextBudgetResult {
  const text = normalizeText(value).trim();
  const originalChars = text.length;
  if (!text || originalChars <= maxChars) {
    return { text, originalChars, usedChars: originalChars, removedChars: 0, blockCount: text ? 1 : 0, keptBlockCount: text ? 1 : 0, truncated: false };
  }

  const terms = promptTerms(normalizeText(prompt));
  const rawBlocks = splitBlocks(text);
  const seen = new Set<string>();
  const unique = rawBlocks.filter((block) => {
    const key = fingerprint(block);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ranked = unique
    .map((block, index) => ({ block, index, score: scoreBlock(block, terms, index) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const kept: typeof ranked = [];
  let used = 0;
  for (const candidate of ranked) {
    const remaining = maxChars - used;
    if (remaining < 500) break;
    if (candidate.block.length <= remaining) {
      kept.push(candidate);
      used += candidate.block.length + 2;
      continue;
    }
    if (candidate.score >= 70) {
      kept.push({ ...candidate, block: `${candidate.block.slice(0, Math.max(450, remaining - 80))}\n[CONTEXT BLOCK TRUNCATED]` });
      used = maxChars;
      break;
    }
  }

  kept.sort((a, b) => a.index - b.index);
  const compacted = `${kept.map((item) => item.block).join("\n\n")}\n\n[CONTEXT BUDGET: ${rawBlocks.length - kept.length} lower-priority or duplicate block(s) omitted.]`.trim();
  return {
    text: compacted.slice(0, maxChars),
    originalChars,
    usedChars: Math.min(maxChars, compacted.length),
    removedChars: Math.max(0, originalChars - Math.min(maxChars, compacted.length)),
    blockCount: rawBlocks.length,
    keptBlockCount: kept.length,
    truncated: true,
  };
}

function messageText(message: any) {
  const role = String(message?.role || message?.sender || "").toLowerCase();
  const normalizedRole = role === "assistant" || role === "model" || role === "ai" ? "assistant" : "user";
  const text = String(message?.content || message?.text || message?.message || message?.assistantAnswer || message?.userPrompt || "")
    .replace(/data:[^\s;]+;base64,[A-Za-z0-9+/=]+/gu, "[binary attachment omitted]")
    .replace(/\s+/gu, " ")
    .trim();
  return text ? `${normalizedRole}: ${text}` : "";
}

export function compactChatHistory(history: unknown, maxChars: number) {
  const list = Array.isArray(history) ? history : [];
  const lines = list.map(messageText).filter(Boolean);
  const selected: string[] = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].slice(0, 4_000);
    if (used + line.length + 1 > maxChars) break;
    selected.unshift(line);
    used += line.length + 1;
    if (selected.length >= 14) break;
  }
  return selected.length > 0 ? selected.join("\n") : "None";
}

export function buildBoundedRequestText(params: {
  contextBlocksText: unknown;
  history: unknown;
  prompt: unknown;
  contextMaxChars: number;
  historyMaxChars: number;
}) {
  const context = compactEvidenceContext(params.contextBlocksText, params.prompt, params.contextMaxChars);
  const history = compactChatHistory(params.history, params.historyMaxChars);
  const prompt = normalizeText(params.prompt).slice(0, 40_000);
  return {
    text: `Context Blocks:\n${context.text || "None"}\n\nPrevious Chat History (recent, compacted):\n${history}\n\nCurrent User Request:\n${prompt}\nAnswer in Sinhala-first style if appropriate.`,
    context,
    historyChars: history.length,
  };
}

export function enforceRequestTextBudget(value: unknown, maxChars: number) {
  const text = normalizeText(value);
  const limit = Math.max(1_000, Math.trunc(Number(maxChars) || 1_000));
  if (text.length <= limit) return text;
  const marker = "\n\n[LOWER-PRIORITY REQUEST CONTEXT OMITTED TO PROTECT ANSWER QUALITY]\n\n";
  const usable = Math.max(200, limit - marker.length);
  const headBudget = Math.max(100, Math.floor(usable * 0.68));
  const tailBudget = Math.max(100, usable - headBudget);
  return `${text.slice(0, headBudget)}${marker}${text.slice(-tailBudget)}`.slice(0, limit);
}
