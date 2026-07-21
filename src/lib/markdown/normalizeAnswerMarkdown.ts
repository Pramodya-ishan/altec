function splitExamSubparts(content: string) {
  const markerPattern = /\((?:[a-h]|i{1,3}|iv|v|vi{0,3}|ix|x)\)/giu;
  const matches = content.match(markerPattern) || [];
  if (matches.length < 1 || content.length < 70) return content;

  return content.split(/(\$\$[\s\S]*?\$\$|\$[^\n$]*\$)/g).map((part, index) => {
    if (index % 2 === 1) return part;
    return part
      .replace(/[^\S\r\n]*(?=\((?:[a-h]|i{1,3}|iv|v|vi{0,3}|ix|x)\)\s*)/giu, "\n\n")
      .replace(/\s+(?=(?:ප්‍රශ්නය|Question)\s*\d{1,3}\b)/giu, "\n\n")
      .replace(/\s+(?=\d{1,2}\s*[.)]\s+(?=[\p{L}]))/gu, "\n\n");
  }).join("").replace(/\n{3,}/g, "\n\n");
}

function separateQuestionAndMarks(content: string) {
  return content.split(/(\$\$[\s\S]*?\$\$|\$[^\n$]*\$|```[\s\S]*?```)/g).map((part, index) => {
    if (index % 2 === 1) return part;
    return part
      // Keep marks attached to the exact sub-question but prevent the next
      // sentence/subpart from being glued onto the same visual line.
      .replace(/\s*(\((?:ලකුණු|marks?)\s*[:\-]?\s*\d{1,3}\))\s*(?=\S)/giu, " $1\n\n")
      .replace(/([^\n])\s+(?=\((?:a|b|c|d|e|f|g|h|i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s*)/giu, "$1\n\n")
      .replace(/\n{3,}/g, "\n\n");
  }).join("");
}

function paragraphizeLongAnswer(content: string) {
  return content.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (trimmed.length < 260) return trimmed;
    if (/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|\||\$)/.test(trimmed)) return trimmed;
    if (trimmed.includes("\n")) return trimmed;

    const sentences = trimmed.match(/[^.!?।]+(?:[.!?।]+(?:[\"')\]]+)?|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
    if (sentences.length < 3) return trimmed;

    const paragraphs: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (current && next.length > 260) {
        paragraphs.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }
    if (current) paragraphs.push(current);
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
  return paragraphizeLongAnswer(separateQuestionAndMarks(splitExamSubparts(removeMathJoiners(normalized))));
}
