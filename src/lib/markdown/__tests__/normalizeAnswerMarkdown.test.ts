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

const compactQuestion = "කම්බියක් සලකන්න. (i) දිග සඳහන් කරන්න. (ii) ප්‍රතිරෝධය ගණනය කරන්න. (iii) ප්‍රස්තාරය අඳින්න.";
const spacedQuestion = normalizeAnswerMarkdown(compactQuestion);
assert.match(spacedQuestion, /\n\n\(i\)/, "exam subparts should begin on separate paragraphs");
assert.match(spacedQuestion, /\n\n\(ii\)/, "successive exam subparts should remain separated");
assert.match(spacedQuestion, /\n\n\(iii\)/, "all compact subparts should be separated");

const singleSubpart = normalizeAnswerMarkdown("1. ප්‍රධාන ප්‍රශ්නය මෙහි ඇත. (i) පළමු උප ප්‍රශ්නය විසඳන්න. (ලකුණු 05) (ii) දෙවන උප ප්‍රශ්නය විසඳන්න.");
assert.match(singleSubpart, /\n\n\(i\)/, "even the first subpart should be separated from the stem");
assert.match(singleSubpart, /\(ලකුණු 05\)\n\n\(ii\)/, "marks and the next subpart must not be glued together");
