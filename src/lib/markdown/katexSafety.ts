const SINHALA_OR_JOINER = /[\u0D80-\u0DFF\u200C\u200D]/;
const SINHALA_CLUSTER = /[\u0D80-\u0DFF\u200C\u200D]+/g;
const INVISIBLE_MATH_CONTROLS = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
const HAS_INVISIBLE_MATH_CONTROLS = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;
const PLACEHOLDER_PATTERN = /@@CLORA_SI_(\d+)@@/g;

function looksLikeMath(value: string) {
  return /[A-Za-z0-9=+\-*/^_\\{}()[\]<>]|[πμσΔρΩθλ]/.test(value);
}

function normalizeMathFragment(value: string) {
  return value
    .replace(INVISIBLE_MATH_CONTROLS, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * KaTeX has no glyph metrics for Sinhala script or ZWJ/ZWNJ. This function
 * keeps Sinhala text outside math nodes while preserving its original order,
 * and strips invisible bidi/format controls only from actual math fragments.
 */
export function renderKatexSafeDelimitedMath(content: string, delimiter: "$" | "$$") {
  const raw = String(content || "");
  if (!SINHALA_OR_JOINER.test(raw) && !HAS_INVISIBLE_MATH_CONTROLS.test(raw)) {
    return `${delimiter}${normalizeMathFragment(raw)}${delimiter}`;
  }

  const textSegments: string[] = [];
  const tokenFor = (value: string) => {
    const index = textSegments.push(value) - 1;
    return `@@CLORA_SI_${index}@@`;
  };

  let tokenized = raw.replace(/\\(?:text|mbox|textrm|textnormal)\{([^{}]*)\}/g, (whole, inner: string) => {
    return SINHALA_OR_JOINER.test(inner) ? tokenFor(inner) : whole;
  });

  tokenized = tokenized.replace(SINHALA_CLUSTER, (segment) => /[\u0D80-\u0DFF]/.test(segment) ? tokenFor(segment) : "");
  tokenized = tokenized.replace(INVISIBLE_MATH_CONTROLS, "");

  const pieces: string[] = [];
  let cursor = 0;
  tokenized.replace(PLACEHOLDER_PATTERN, (match, indexText: string, offset: number) => {
    const mathPart = normalizeMathFragment(tokenized.slice(cursor, offset));
    if (mathPart) pieces.push(looksLikeMath(mathPart) ? `${delimiter}${mathPart}${delimiter}` : mathPart);
    pieces.push(textSegments[Number(indexText)] || "");
    cursor = offset + match.length;
    return match;
  });

  const tail = normalizeMathFragment(tokenized.slice(cursor));
  if (tail) pieces.push(looksLikeMath(tail) ? `${delimiter}${tail}${delimiter}` : tail);

  const separator = delimiter === "$$" ? "\n" : "";
  return pieces.join(separator).replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeKatexMathBoundaries(input: string) {
  if (!input) return "";

  let output = input.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content: string) => {
    return renderKatexSafeDelimitedMath(content, "$$");
  });

  output = output.replace(/(?<!\\)(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_match, content: string) => {
    return renderKatexSafeDelimitedMath(content, "$");
  });

  return output;
}

export function containsUnsupportedKatexText(input: string) {
  let found = false;
  String(input || "").replace(/\$\$([\s\S]*?)\$\$|(?<!\\)(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_match, block, inline) => {
    if (SINHALA_OR_JOINER.test(String(block ?? inline ?? ""))) found = true;
    return _match;
  });
  return found;
}
