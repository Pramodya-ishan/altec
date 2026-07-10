export function stripRawVisualBlocks(text: string): string {
  if (!text) return text;

  let output = text;

  // Remove fenced JSON visual blocks
  output = output.replace(/```(?:json)?\s*{\s*"visual_block"[\s\S]*?}\s*```/gi, "");

  // Remove inline visual_block JSON blocks
  output = output.replace(/\{\s*"visual_block"\s*:\s*\{[\s\S]*?\n?\}\s*\}/gi, "");

  // Remove partial/broken visual_block fragments
  output = output.replace(/\{\s*"visual_block"[\s\S]*?(?=\n\n|$)/gi, "");

  // Remove orphan JSON labels often left behind
  output = output.replace(/"type"\s*:\s*"formula_card"[\s\S]*?(?=\n\n|$)/gi, "");

  // Clean excessive blank lines
  output = output.replace(/\n{3,}/g, "\n\n").trim();

  return output;
}
