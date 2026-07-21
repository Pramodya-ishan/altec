import assert from "node:assert/strict";
import { buildBoundedRequestText, compactChatHistory, compactEvidenceContext, enforceRequestTextBudget } from "../contextBudget";

const repeated = Array.from({ length: 30 }, (_, index) => index % 2 === 0
  ? "[LOW PRIORITY SOURCE] generic repeated paragraph ".repeat(40)
  : `[EXACT QUESTION] 2024 ET MCQ 31 circuit evidence ${index} ` + "x".repeat(900)).join("\n");
const compacted = compactEvidenceContext(repeated, "2024 ET MCQ 31 circuit", 8_000);
assert.equal(compacted.truncated, true);
assert.ok(compacted.usedChars <= 8_000);
assert.match(compacted.text, /EXACT QUESTION/);
assert.ok(compacted.removedChars > 0);

const history = Array.from({ length: 30 }, (_, index) => ({
  role: index % 2 ? "assistant" : "user",
  content: `message ${index} ${"word ".repeat(100)}`,
}));
const historyText = compactChatHistory(history, 2_000);
assert.ok(historyText.length <= 2_000);
assert.match(historyText, /message 29/);
assert.doesNotMatch(historyText, /message 0\b/);

const built = buildBoundedRequestText({
  contextBlocksText: repeated,
  history,
  prompt: "31 mcq",
  contextMaxChars: 5_000,
  historyMaxChars: 1_000,
});
assert.match(built.text, /Current User Request:\n31 mcq/);
assert.ok(built.context.usedChars <= 5_000);

const bounded = enforceRequestTextBudget("A".repeat(20_000) + "CURRENT PROMPT", 5_000);
assert.ok(bounded.length <= 5_000 + 10);
assert.match(bounded, /CURRENT PROMPT/);

console.log("AI context budget tests passed.");
