import { sanitizeKatexMathBoundaries } from "./markdown/katexSafety";

export function sanitizeMathMarkdown(input: string): string {
  if (!input) return "";

  // Replace unicode replacement character  with space
  let text = input
    .replace(/\uFFFD/g, " ")
    .replace(/[\u200B\uFEFF]/g, "");

  // Fix common broken sqrt/braces patterns
  text = text.replace(/\\sqrt\{([^}]*)$/g, "\\sqrt{$1}");
  text = text.replace(/\}\$/g, "}$");

  // Handle unclosed block math $$
  const blockCount = (text.match(/\$\$/g) || []).length;
  if (blockCount % 2 !== 0) {
    text += "$$";
  }

  // Handle unclosed inline math $
  const singleDollarText = text.replace(/\$\$/g, "");
  const singleDollarCount = (singleDollarText.match(/\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    const lastIndex = text.lastIndexOf("$");
    if (lastIndex !== -1) {
      text = text.slice(0, lastIndex) + "\\$" + text.slice(lastIndex + 1);
    }
  }

  // PREVENT KATEX ERRORS WITH SINHALA TEXT
  // KaTeX crashes on Sinhala Unicode \u0D80-\u0DFF inside $...$ or $$...$$
  // We wrap Sinhala segments inside math mode with \text{...} or just unwrap them.
  // Method: Find math blocks and transform them.
  
  const SINHALA_REGEX = /[\u0D80-\u0DFF\u200D]+/;

  // Transform $$ blocks
  text = text.replace(/\$\$(.*?)\$\$/gs, (match, content) => {
    // If it contains Sinhala characters or ZWJ, unwrap it entirely to be safe
    if (SINHALA_REGEX.test(content)) {
      return `\n${content.trim()}\n`;
    }
    // Only keep if it looks like math (contains symbols or numbers)
    const MATH_SYMBOLS = /[=+\-^_{}\\/\d\w]/;
    if (!MATH_SYMBOLS.test(content)) {
       return content;
    }
    return `$$${content}$$`;
  });

  // Transform $ blocks (careful not to match escaped \$)
  text = text.replace(/(?<!\\)\$(.*?)(?<!\\)\$/g, (match, content) => {
    if (SINHALA_REGEX.test(content)) {
       return content;
    }
    const MATH_SYMBOLS = /[=+\-^_{}\\/\d\w]/;
    if (!MATH_SYMBOLS.test(content)) {
       return content;
    }
    return `$${content}$`;
  });

  // Clean broken backslashes ONLY if they are truly orphan and causing issues
  // But don't remove ALL backslashes as it breaks legitimate LaTeX like \frac
  // text = text.replace(/\\([^\w\s\{\}\(\)\d\+\-\*\=\/\\\$])/g, "$1"); // Removed dangerous global replace

  return sanitizeKatexMathBoundaries(text);
}

export function getUnclosedMathInfo(text: string): { hasUnclosed: boolean; index: number; type: "inline" | "block" | null } {
  let i = 0;
  let inBlock = false;
  let inInline = false;
  let lastBlockStartIndex = -1;
  let lastInlineStartIndex = -1;

  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2; // skip escape character and the next character
      continue;
    }

    if (text.startsWith("$$", i)) {
      if (inBlock) {
        inBlock = false;
      } else if (!inInline) {
        inBlock = true;
        lastBlockStartIndex = i;
      }
      i += 2;
    } else if (text[i] === '$') {
      if (inInline) {
        inInline = false;
      } else if (!inBlock) {
        inInline = true;
        lastInlineStartIndex = i;
      }
      i += 1;
    } else {
      i += 1;
    }
  }

  if (inBlock) {
    return { hasUnclosed: true, index: lastBlockStartIndex, type: "block" };
  }
  if (inInline) {
    return { hasUnclosed: true, index: lastInlineStartIndex, type: "inline" };
  }
  return { hasUnclosed: false, index: -1, type: null };
}
