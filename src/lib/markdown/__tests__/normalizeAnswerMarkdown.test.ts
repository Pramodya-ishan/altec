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

const malformedYansaya = normalizeAnswerMarkdown("න්යෂ්ටිය සහ ප්රශ්නය");
assert.equal(malformedYansaya.includes("න්‍යෂ්ටිය"), true, "decomposed yansaya must be normalized");
assert.equal(malformedYansaya.includes("ප්‍රශ්නය"), true, "decomposed rakaransaya must be normalized");

const hiddenReasoning = normalizeAnswerMarkdown(`නිවැරදි පිළිතුර මෙයයි.\n\n_Reasoning_\n\nSource: hidden-internal-source\n\nExact PDF evidence page 2`);
assert.equal(hiddenReasoning.includes("Reasoning"), false, "internal reasoning labels must not render");
assert.equal(hiddenReasoning.includes("hidden-internal-source"), false, "source metadata belongs in source cards, not answer text");

const repeatedParagraph = "මෙය එකම පිළිතුර දෙවරක් append වීම වැළැක්වීම සඳහා භාවිත කරන දිගු පරීක්ෂණ ඡේදයකි. නිවැරදි පිළිතුර එක වතාවක් පමණක් පෙන්විය යුතුය.";
const deduplicated = normalizeAnswerMarkdown(`${repeatedParagraph}\n\n${repeatedParagraph}`);
assert.equal(deduplicated.indexOf(repeatedParagraph), deduplicated.lastIndexOf(repeatedParagraph), "duplicate answer paragraphs must collapse");
