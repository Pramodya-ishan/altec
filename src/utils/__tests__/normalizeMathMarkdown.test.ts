import assert from "node:assert/strict";
import { normalizeMathMarkdown } from "../normalizeMathMarkdown";

const sinhala = "ප්‍රශ්නයේ ප්‍රතික්‍රියාව සහ ද්‍රාවණය පැහැදිලි කරන්න.";
const normalizedSinhala = normalizeMathMarkdown(sinhala);
assert.equal(normalizedSinhala, sinhala, "Sinhala ZWJ conjuncts must be preserved outside math");
assert.equal(normalizedSinhala.includes("ප්රශ්නය"), false);

const math = normalizeMathMarkdown("$P = h\u200D\\rho g$");
assert.equal(math.includes("\u200D"), false, "ZWJ must be removed inside KaTeX segments");

console.log("Math Markdown Sinhala tests passed.");
