import assert from "node:assert/strict";
import { deriveEducationalVisualBlocks } from "../visualAidBuilder";

const reactionBlocks = deriveEducationalVisualBlocks({
  prompt: "මේ reaction එක explain කරන්න",
  mode: "tutor_explanation",
  answer: "## Reaction\n\n2NaOH + H₂SO₄ → Na₂SO₄ + 2H₂O\n\nමෙය balanced equation එකයි.",
});
assert.equal(reactionBlocks[0]?.type, "reaction_diagram");

const formulaBlocks = deriveEducationalVisualBlocks({
  prompt: "stress formula explain",
  mode: "tutor_explanation",
  answer: "The key relation is:\n\n$$\\sigma = \\frac{F}{A}$$",
});
assert.equal(formulaBlocks[0]?.type, "formula_card");

const noBlocks = deriveEducationalVisualBlocks({
  prompt: "hi",
  mode: "normal_chat",
  answer: "Hi!",
});
assert.equal(noBlocks.length, 0);

console.log("Educational visual aid builder tests passed.");
