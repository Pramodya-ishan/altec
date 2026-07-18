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
  [/සත්යා/g, "සත්‍යා"],
  [/ත්යා/g, "ත්‍යා"],
  [/න්යා/g, "න්‍යා"],
  [/ල්යා/g, "ල්‍යා"],
];

const INTERNAL_TAG_PATTERN = /<\/?(?:system|assistant|developer|thought_process|analysis|tool|function|claude_behavior|memory_system|computer_use)[^>]*>/gi;
const INTERNAL_LINE_PATTERN = /^\s*(?:system|developer|assistant|internal instruction|hidden prompt|tool call|function call)\s*:\s*/i;
const SNAKE_DIRECTIVE_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){4,}\b[.!?]?/g;
const KNOWN_LEAK_PATTERN = /turn_off_indicator_lights_on_the_router_if_possible_to_save_power_and_reduce_light_pollution\.?/gi;

export function normalizeSinhalaUnicode(value: unknown): string {
  let text = String(value ?? "").normalize("NFC");
  for (const [pattern, replacement] of SINHALA_NORMALIZATIONS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function isMachineDirectiveLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (INTERNAL_LINE_PATTERN.test(trimmed)) return true;
  const snakeTokens = trimmed.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+){4,}\b/g) || [];
  if (snakeTokens.length === 0) return false;
  const snakeChars = snakeTokens.reduce((total, token) => total + token.length, 0);
  return snakeChars / Math.max(1, trimmed.length) >= 0.55;
}

export function sanitizeAssistantText(value: unknown, options: { trim?: boolean } = {}): string {
  const input = normalizeSinhalaUnicode(value)
    .replace(KNOWN_LEAK_PATTERN, "")
    .replace(INTERNAL_TAG_PATTERN, "");

  const output: string[] = [];
  let inFence = false;
  for (const originalLine of input.split(/\r?\n/)) {
    const line = originalLine;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }
    if (!inFence) {
      if (isMachineDirectiveLine(line)) continue;
      const cleaned = line.replace(SNAKE_DIRECTIVE_PATTERN, "").replace(/[ \t]{2,}/g, " ").trimEnd();
      if (cleaned.trim()) output.push(cleaned);
      else if (output.length > 0 && output[output.length - 1] !== "") output.push("");
    } else {
      output.push(line);
    }
  }

  const cleaned = output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n");
  return options.trim === false ? cleaned : cleaned.trim();
}

/**
 * Streaming sanitizer that waits for sentence/line boundaries so a split
 * Sinhala conjunct or leaked snake_case directive is never emitted halfway.
 */
export function createAssistantStreamSanitizer() {
  let pending = "";
  const preserveBoundaryWhitespace = (raw: string, cleaned: string) => {
    if (!cleaned) return "";
    if (/\n\s*$/.test(raw) && !cleaned.endsWith("\n")) return `${cleaned}\n`;
    if (/\s$/.test(raw) && !/\s$/.test(cleaned)) return `${cleaned} `;
    return cleaned;
  };
  return {
    push(fragment: unknown) {
      pending += String(fragment ?? "");
      const boundaryMatches = [...pending.matchAll(/[\n.!?](?:\s|$)/g)];
      if (boundaryMatches.length === 0 && pending.length < 420) return "";
      const lastBoundary = boundaryMatches.length > 0
        ? (boundaryMatches[boundaryMatches.length - 1].index || 0) + boundaryMatches[boundaryMatches.length - 1][0].length
        : Math.max(0, pending.length - 96);
      if (lastBoundary <= 0) return "";
      const ready = pending.slice(0, lastBoundary);
      pending = pending.slice(lastBoundary);
      return preserveBoundaryWhitespace(ready, sanitizeAssistantText(ready, { trim: false }));
    },
    flush() {
      const raw = pending;
      const ready = preserveBoundaryWhitespace(raw, sanitizeAssistantText(raw, { trim: false }));
      pending = "";
      return ready;
    },
  };
}

export function isSimpleGreeting(value: unknown) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.!?,\s]+/g, " ")
    .trim();
  return /^(?:hi+|hello+|hey+|yo|හායි|හෙලෝ|ආයුබෝවන්)$/.test(normalized);
}

export function simpleGreetingReply(value: unknown) {
  const normalized = String(value || "").toLowerCase();
  if (/hello|hey|\bhi\b/.test(normalized)) {
    return "Hi! අද බලන්න ඕනේ පාඩම හෝ ප්‍රශ්නය මොකක්ද?";
  }
  return "ආයුබෝවන්! අද බලන්න ඕනේ පාඩම හෝ ප්‍රශ්නය මොකක්ද?";
}
