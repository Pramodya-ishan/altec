/**
 * Text cleanup shared by the browser and server.
 * Keeps Sinhala conjuncts stable, strips hidden model-only labels, and avoids
 * rendering source metadata inside the answer body (sources have their own UI).
 */
export function normalizeSinhalaUnicode(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    // ZWNJ/FEFF between a Sinhala virama and yansaya/rakaransaya breaks shaping.
    .replace(/\u0DCA[\u200C\uFEFF]+(?=[\u0DBA\u0DBB])/g, "\u0DCA\u200D")
    // Add the canonical joiner when models emit the decomposed visible form.
    .replace(/\u0DCA(?!\u200D)(?=[\u0DBA\u0DBB])/g, "\u0DCA\u200D")
    .replace(/\u0DCA\u200D{2,}/g, "\u0DCA\u200D")
    .replace(/([\u0D80-\u0DFF])\uFEFF(?=[\u0D80-\u0DFF])/g, "$1");
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[*_#>`~\-–—:;,.!?()[\]{}|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeRepeatedParagraphs(value: string): string {
  const blocks = value.split(/\n{2,}/);
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const block of blocks) {
    const key = normalizeComparable(block);
    if (key.length >= 80 && seen.has(key)) continue;
    if (key.length >= 80) seen.add(key);
    kept.push(block.trim());
  }

  return kept.filter(Boolean).join("\n\n");
}

export function cleanAssistantResponse(value: unknown): string {
  let text = normalizeSinhalaUnicode(value)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/^\s*(?:#{1,6}\s*)?(?:\*\*|__|_)?(?:reasoning|chain of thought|thought process|internal reasoning)(?:\*\*|__|_)?\s*(?:[:,\-–—]\s*)?/gim, "")
    .replace(/^\s*(?:\*\*|__)?source(?:s)?(?:\*\*|__)?\s*:\s*.*$/gim, "")
    .replace(/^\s*exact pdf evidence\s*.*$/gim, "")
    .replace(/^\s*_{1,2}reasoning_{1,2}\s*(?:[:,\-–—]\s*)?/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = removeRepeatedParagraphs(text);
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
