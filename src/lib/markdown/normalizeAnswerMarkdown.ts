function paragraphizeLongAnswer(content: string) {
  return content.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (trimmed.length < 380) return trimmed;
    if (/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|\||\$)/.test(trimmed)) return trimmed;
    if (trimmed.includes("\n")) return trimmed;

    const sentences = trimmed.match(/[^.!?।]+(?:[.!?।]+(?:[\"')\]]+)?|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
    if (sentences.length < 3) return trimmed;

    const paragraphs: string[] = [];
    for (let index = 0; index < sentences.length; index += 2) {
      paragraphs.push(sentences.slice(index, index + 2).join(" "));
    }
    return paragraphs.join("\n\n");
  }).join("\n\n");
}

function removeMathJoiners(content: string) {
  return content.replace(/(\$\$[\s\S]*?\$\$|\$[^\n$]*\$)/g, (math) => math.replace(/[\u200C\u200D\uFEFF]/g, ""));
}

export function normalizeAnswerMarkdown(content: string): string {
  const normalized = String(content || "")
    .replace(/<summary>\s*(.*?)\s*<\/summary>/gis, (_match, title: string) => {
      const cleanTitle = title.replace(/\*\*/g, "").trim();
      return `\n### ${cleanTitle}\n`;
    })
    .replace(/<\/?details(?:\s[^>]*)?>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return paragraphizeLongAnswer(removeMathJoiners(normalized));
}
