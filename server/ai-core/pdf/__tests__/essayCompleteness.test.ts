import assert from "node:assert/strict";
import { extractQuestionSubparts } from "../solveExtractedQuestion";

const question = `01. (A) Question\n(i) first\n(ii) second\n(viii) eighth\n\n(B) second section\n(i) first\n(iv) fourth`;
assert.deepEqual(extractQuestionSubparts(question), ["A.i", "A.ii", "A.viii", "B.i", "B.iv"]);
assert.deepEqual(extractQuestionSubparts("Explain the process."), []);
console.log("essay completeness tests passed");
