export function stripRawVisualBlocks(text: string): string {
  if (!text) return text;

  return text
    .replace(/```(?:json)?\s*{\s*"visual_block"[\s\S]*?}\s*```/gi, "")
    .replace(/\{\s*"visual_block"\s*:\s*\{[\s\S]*?\n?\}\s*\}/gi, "")
    .replace(/\{\s*"visual_block"[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/"type"\s*:\s*"formula_card"[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
