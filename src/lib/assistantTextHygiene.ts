const SINHALA_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/ප්ර/g, "ප්‍ර"],
  [/ක්ර/g, "ක්‍ර"],
  [/ග්ර/g, "ග්‍ර"],
  [/ත්ර/g, "ත්‍ර"],
  [/ද්ර/g, "ද්‍ර"],
  [/බ්ර/g, "බ්‍ර"],
  [/ශ්ර/g, "ශ්‍ර"],
  [/ස්ර/g, "ස්‍ර"],
  [/ව්ය/g, "ව්‍ය"],
  [/ධ්ය/g, "ධ්‍ය"],
  [/ද්ය/g, "ද්‍ය"],
  [/භ්ය/g, "භ්‍ය"],
  [/න්ය/g, "න්‍ය"],
  [/ර්ය/g, "ර්‍ය"],
];

const KNOWN_INTERNAL_LEAKS = [
  /turn_off_indicator_lights_on_the_router_if_possible_to_save_power_and_reduce_light_pollution\.?/gi,
];

const INTERNAL_TAG_PATTERN = /<\/?(?:system|assistant|developer|thought_process|analysis|tool|function|claude_behavior|memory_system|computer_use)[^>]*>/gi;
const INTERNAL_LINE_PATTERN = /^\s*(?:system|developer|assistant|internal instruction|hidden prompt|tool call|function call)\s*:\s*/i;
const LONG_SNAKE_DIRECTIVE_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){4,}\b[.!?]?/g;

export function normalizeSinhalaDisplayText(value: unknown): string {
  let text = String(value ?? "").normalize("NFC");
  for (const [pattern, replacement] of SINHALA_NORMALIZATIONS) text = text.replace(pattern, replacement);
  return text;
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

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
