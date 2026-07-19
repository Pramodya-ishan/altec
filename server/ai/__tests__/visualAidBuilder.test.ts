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

const mechanicsBlocks = deriveEducationalVisualBlocks({
  prompt: `ප්‍රශ්නය 1: 10\\,\\mathrm{kg} වස්තුවකට තිරසට 60^\\circ කෝණයකින් 100\\,\\mathrm{N} බලයක් යොදයි.\nප්‍රශ්නය 2: රළු පෘෂ්ඨයක 5\\,\\mathrm{kg} වස්තුව චලනය කිරීමට 20\\,\\mathrm{N} අවශ්‍යයි.`,
  mode: "tutor_explanation",
  answer: "පළමුව නිදහස් බල රූපසටහන අඳින්න.",
});
assert.equal(mechanicsBlocks[0]?.type, "mechanics_diagram");
if (mechanicsBlocks[0]?.type === "mechanics_diagram") {
  assert.equal(mechanicsBlocks[0].scenes.length, 2);
  assert.equal(mechanicsBlocks[0].scenes[0].angleDeg, 60);
  assert.equal(mechanicsBlocks[0].scenes[1].surface, "rough");
}

const questionOnlyBlocks = deriveEducationalVisualBlocks({
  prompt: "සාමාන්‍ය ප්‍රශ්නයක්",
  mode: "normal_chat",
  answer: "1. වස්තුවේ බර කොපමණද?\n2. R ගණනය කරන්නද?",
});
assert.equal(questionOnlyBlocks.some((block) => block.type === "process_flow"), false, "question subparts must not become a fake solution flow");

console.log("Educational visual aid builder tests passed.");
