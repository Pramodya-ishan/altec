import assert from "node:assert/strict";
import { normalizeAnswerMarkdown } from "../normalizeAnswerMarkdown";

const legacy = "<details><summary>📄 **Source evidence**</summary>\n\n- PDF: 2025 SFT\n</details>";
const normalized = normalizeAnswerMarkdown(legacy);
assert.equal(normalized.includes("<details>"), false);
assert.equal(normalized.includes("<summary>"), false);
assert.match(normalized, /### 📄 Source evidence/);
assert.match(normalized, /2025 SFT/);

console.log("answer Markdown normalization tests passed");
