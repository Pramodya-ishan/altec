import assert from "node:assert/strict";
import { normalizeAnswerMarkdown } from "../normalizeAnswerMarkdown";

const legacy = "<details><summary>📄 **Source evidence**</summary>\n\n- PDF: 2025 SFT\n</details>";
const normalized = normalizeAnswerMarkdown(legacy);
assert.equal(normalized.includes("<details>"), false);
assert.equal(normalized.includes("<summary>"), false);
assert.match(normalized, /### 📄 Source evidence/);
assert.match(normalized, /2025 SFT/);

const longAnswer = "පළමු අදහස පැහැදිලි කරන වාක්‍යය මෙයයි. දෙවන අදහසට අදාළ විස්තර මෙහි ඇත. තුන්වන අදහස වෙනම කියවීමට පහසු විය යුතුයි. හතරවන අදහසත් වෙනම කොටසක පෙන්විය යුතුයි. ".repeat(4);
const paragraphized = normalizeAnswerMarkdown(longAnswer);
assert.match(paragraphized, /\n\n/, "long AI answers should be split into readable paragraphs");

const mathWithJoiner = normalizeAnswerMarkdown("$P = h\u200D\\rho g$");
assert.equal(mathWithJoiner.includes("\u200D"), false, "zero-width joiners must not reach KaTeX");

console.log("answer Markdown normalization tests passed");
