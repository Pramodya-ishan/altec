export function normalizeAnswerMarkdown(content: string): string {
  return String(content || "")
    .replace(/<summary>\s*(.*?)\s*<\/summary>/gis, (_match, title: string) => {
      const cleanTitle = title.replace(/\*\*/g, "").trim();
      return `\n### ${cleanTitle}\n`;
    })
    .replace(/<\/?details(?:\s[^>]*)?>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
