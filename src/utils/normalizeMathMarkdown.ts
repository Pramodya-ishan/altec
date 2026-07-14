export function normalizeMathMarkdown(
  rawContent: string,
  isStreaming = false,
): string {
  if (!rawContent) {
    return "";
  }

  function normalizeMathSegment(segment: string): string {
    return segment
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/(\d+)\s*times\s*10\s*\^?\s*([−-]?\s*\d+)/gi, (_, g1, g2) => {
        const exponent = g2.replace(/[−]/g, "-").trim();
        return `${g1} \\\\times 10^{${exponent}}`;
      })
      .replace(/(\d)\s+times\s+(?=\d)/gi, "$1 \\\\times ")
      .replace(/\s*×\s*/g, " \\\\times ")
      .replace(/\s*[·∙]\s*/g, " \\\\cdot ")
      .replace(/10\s*\^\s*-\s*(\d+)/g, "10^{-$1}")
      .replace(/10\s*\^\s*(\d+)/g, "10^{$1}")
      .replace(/\bN\s*m\s*\^\s*-\s*2\b/gi, "\\\\mathrm{N\\,m^{-2}}")
      .replace(/\bN\s*m\s*-\s*2\b/gi, "\\\\mathrm{N\\,m^{-2}}")
      .replace(/\bm\s*2\b/gi, "\\\\mathrm{m^2}")
      .replace(/\bm\^2\b/gi, "\\\\mathrm{m^2}")
      .replace(/\bm²\b/gi, "\\\\mathrm{m^2}")
      .replace(/\\text\{([^\}]+)\}/gi, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function normalizeDelimitedMath(input: string): string {
    let result = input
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => {
        return `$${normalizeMathSegment(math)}$`;
      })
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => {
        return `\n\n$$\n${normalizeMathSegment(math)}\n$$\n\n`;
      });

    result = result.replace(
      /\$\$([\s\S]*?)\$\$/g,
      (_, math: string) => `$$\n${normalizeMathSegment(math)}\n$$`,
    );

    result = result.replace(
      /(?<!\$)\$([^$\n]+?)\$(?!\$)/g,
      (_, math: string) => `$${normalizeMathSegment(math)}$`,
    );

    return result;
  }

  function protectIncompleteStreamingMath(input: string): string {
    const blockMatches = input.match(/\$\$/g)?.length ?? 0;

    if (blockMatches % 2 !== 0) {
      const lastOpening = input.lastIndexOf("$$");

      if (lastOpening >= 0) {
        const stablePart = input.slice(0, lastOpening);
        const unfinishedPart = input.slice(lastOpening + 2);

        return `${stablePart}\n\n${unfinishedPart}`;
      }
    }

    const withoutBlocks = input.replace(/\$\$[\s\S]*?\$\$/g, "");
    const inlineMatches =
      withoutBlocks.match(/(?<!\\)(?<!\$)\$(?!\$)/g)?.length ?? 0;

    if (inlineMatches % 2 !== 0) {
      const lastOpening = input.lastIndexOf("$");

      if (lastOpening >= 0) {
        return `${input.slice(0, lastOpening)}${input.slice(lastOpening + 1)}`;
      }
    }

    return input;
  }

  let output = rawContent
    .replace(/\r\n/g, "\n")
    .replace(/\\text\{([^\}]+)\}/g, "$1")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]")
    .replace(/\n+\s*([A-Za-zσΔμ])\s*\n+/g, " $1 ")
    .replace(/\b([A-Za-zσΔμ])\s+\1\b/g, "$1")
    .replace(/(\d)\s*times\s*10\s*([−-])\s*(\d+)/gi, "$1 × 10⁻$3");

  output = normalizeDelimitedMath(output);

  if (isStreaming) {
    output = protectIncompleteStreamingMath(output);
  }

  return output.trim();
}
