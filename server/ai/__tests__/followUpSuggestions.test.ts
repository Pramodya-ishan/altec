import assert from "node:assert/strict";
import { buildFollowUpSuggestionPrompt, parseFollowUpSuggestions } from "../followUpSuggestions";

assert.deepEqual(parseFollowUpSuggestions('```json\n["Q6 එකේ (B) කොටස කරමු", "රූපය භාවිතයෙන් පැහැදිලි කරන්න", "marking points පෙන්වන්න"]\n```').length, 3);
assert.deepEqual(parseFollowUpSuggestions("not json"), []);
assert.match(buildFollowUpSuggestionPrompt("බලය", "F=ma"), /බලය/);
console.log("follow-up suggestion tests passed");
