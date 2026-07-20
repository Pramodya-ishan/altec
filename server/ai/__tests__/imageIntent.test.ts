import assert from "node:assert/strict";
import { buildImageReferenceText, isImageGenerationIntent, isVisualExplanationIntent } from "../imageIntent";

assert.equal(isImageGenerationIntent("create a image of it explaining sinhala"), true);
assert.equal(isImageGenerationIntent("මේක සිංහලෙන් රූප සටහනක් හදන්න"), true);
assert.equal(isImageGenerationIntent("meka diagram ekak hadanna"), true);
assert.equal(isImageGenerationIntent("මේක රූපයක් සමඟ පැහැදිලි කරන්න"), true);
assert.equal(isImageGenerationIntent("meka image ekkin explain krnn"), true);
assert.equal(isImageGenerationIntent("explain this with a diagram"), true);
assert.equal(isImageGenerationIntent("prshnyk denna images ekka"), true);
assert.equal(isVisualExplanationIntent("මේක රූප සටහනක් සමග පැහැදිලි කරන්න"), true);
assert.equal(isImageGenerationIntent("what is in this image", true), false);
assert.equal(isImageGenerationIntent("explain this image", true), false);

const reference = buildImageReferenceText([
  { role: "user", text: "Question" },
  { role: "assistant", text: "First explanation" },
  { role: "assistant", text: "Latest explanation" },
]);
assert.match(reference, /First explanation/);
assert.match(reference, /Latest explanation/);

console.log("Natural-language image intent tests passed.");
