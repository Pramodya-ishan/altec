const SINHALA_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/ප්[\u200C\u200D]?ර/g, "ප්‍ර"],
  [/ක්[\u200C\u200D]?ර/g, "ක්‍ර"],
  [/ග්[\u200C\u200D]?ර/g, "ග්‍ර"],
  [/ත්[\u200C\u200D]?ර/g, "ත්‍ර"],
  [/ද්[\u200C\u200D]?ර/g, "ද්‍ර"],
  [/බ්[\u200C\u200D]?ර/g, "බ්‍ර"],
  [/ශ්[\u200C\u200D]?ර/g, "ශ්‍ර"],
  [/ස්[\u200C\u200D]?ර/g, "ස්‍ර"],
  [/ව්[\u200C\u200D]?ය/g, "ව්‍ය"],
  [/ධ්[\u200C\u200D]?ය/g, "ධ්‍ය"],
  [/ද්[\u200C\u200D]?ය/g, "ද්‍ය"],
  [/භ්[\u200C\u200D]?ය/g, "භ්‍ය"],
  [/න්[\u200C\u200D]?ය/g, "න්‍ය"],
  [/ර්[\u200C\u200D]?ය/g, "ර්‍ය"],
  [/සත්[\u200C\u200D]?යා/g, "සත්‍යා"],
  [/ත්[\u200C\u200D]?යා/g, "ත්‍යා"],
  [/න්[\u200C\u200D]?යා/g, "න්‍යා"],
  [/ල්[\u200C\u200D]?යා/g, "ල්‍යා"],
  [/විද්[\u200C\u200D]?යා/g, "විද්‍යා"],
  [/අධ්[\u200C\u200D]?ය/g, "අධ්‍ය"],
  [/ප්[\u200C\u200D]?රශ්/g, "ප්‍රශ්"],
  [/ප්[\u200C\u200D]?රති/g, "ප්‍රති"],
  [/ප්[\u200C\u200D]?රධාන/g, "ප්‍රධාන"],
  [/ද්[\u200C\u200D]?රාවණ/g, "ද්‍රාවණ"],
  [/සාන්ද්[\u200C\u200D]?රණ/g, "සාන්ද්‍රණ"],
  [/ක්[\u200C\u200D]?රියා/g, "ක්‍රියා"],
  [/ව්[\u200C\u200D]?යුහ/g, "ව්‍යුහ"],
  [/අවශ්[\u200C\u200D]?ය/g, "අවශ්‍ය"],
  [/සාමාන්[\u200C\u200D]?ය/g, "සාමාන්‍ය"],
];

const KNOWN_INTERNAL_LEAKS = [
  /turn_off_indicator_lights_on_the_router_if_possible_to_save_power_and_reduce_light_pollution\.?/gi,
];

const INTERNAL_TAG_PATTERN = /<\/?(?:system|assistant|developer|thought_process|analysis|tool|function|claude_behavior|memory_system|computer_use)[^>]*>/gi;
const INTERNAL_LINE_PATTERN = /^\s*(?:system|developer|assistant|internal instruction|hidden prompt|tool call|function call)\s*:\s*/i;
const LONG_SNAKE_DIRECTIVE_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){4,}\b[.!?]?/g;

export function normalizeSinhalaDisplayText(value: unknown): string {
  let text = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFEFF\u2060]/g, "")
    .replace(/\u200C(?=[\u0D80-\u0DFF])/g, "");
  for (const [pattern, replacement] of SINHALA_NORMALIZATIONS) text = text.replace(pattern, replacement);
  return text.normalize("NFC");
}

export function sanitizeAssistantDisplayText(value: unknown): string {
  let text = normalizeSinhalaDisplayText(value).replace(INTERNAL_TAG_PATTERN, "");
  for (const pattern of KNOWN_INTERNAL_LEAKS) text = text.replace(pattern, "");

  const output: string[] = [];
  let inFence = false;
  for (const originalLine of text.split(/\r?\n/)) {
    if (/^\s*```/.test(originalLine)) {
      inFence = !inFence;
      output.push(originalLine);
      continue;
    }
    if (inFence) {
      output.push(originalLine);
      continue;
    }
    if (INTERNAL_LINE_PATTERN.test(originalLine)) continue;
    const snakeTokens = originalLine.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+){4,}\b/g) || [];
    const snakeChars = snakeTokens.reduce((total, token) => total + token.length, 0);
    if (snakeTokens.length > 0 && snakeChars / Math.max(1, originalLine.trim().length) >= 0.55) continue;
    output.push(originalLine.replace(LONG_SNAKE_DIRECTIVE_PATTERN, "").trimEnd());
  }

  let cleaned = output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length > 500 && !cleaned.includes("\n\n") && !cleaned.includes("```")) {
    const sentences = cleaned.split(/(?<=[.!?。]|යි\.|වේ\.|ය\.)\s+/u).filter(Boolean);
    if (sentences.length >= 4) {
      const paragraphs: string[] = [];
      for (let index = 0; index < sentences.length; index += 2) paragraphs.push(sentences.slice(index, index + 2).join(" "));
      cleaned = paragraphs.join("\n\n");
    }
  }
  return normalizeSinhalaDisplayText(cleaned);
}
