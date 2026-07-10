import { VisualBlock } from "./visualBlocks";

export function extractVisualBlocks(text: string): { cleanText: string; blocks: VisualBlock[] } {
  let cleanText = text;
  const blocks: VisualBlock[] = [];

  // Match ```json ... ``` blocks
  const regex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  
  cleanText = cleanText.replace(regex, (match, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Extract visual block if present
      if (parsed.visual_block) {
        blocks.push(parsed.visual_block);
        return ""; // Remove the block from the rendered text
      }
      
      // Strip out internal agent reasoning blocks
      if (parsed.thought_process || parsed.reasoning || parsed.agent_thought || parsed.thoughts || parsed.tool_call || parsed.step) {
        return ""; // Remove reasoning json from the UI
      }
      
    } catch (e) {
      // Ignore parsing errors, could be normal markdown code block
    }
    return match; // If it fails or doesn't match our internal structures, leave it in
  });

  return { cleanText, blocks };
}
