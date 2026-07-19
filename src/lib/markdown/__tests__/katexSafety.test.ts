import assert from "node:assert/strict";
import { containsUnsupportedKatexText, sanitizeKatexMathBoundaries } from "../katexSafety";

const mixed = "$F = ma \\text{ප්‍රතිඵල බලය}$";
const safe = sanitizeKatexMathBoundaries(mixed);
assert.equal(containsUnsupportedKatexText(safe), false);
assert.match(safe, /\$F = ma\$/);
assert.match(safe, /ප්‍රතිඵල බලය/);

const joinerInsideMath = "$P = h\u200D\\rho g$";
const joinerSafe = sanitizeKatexMathBoundaries(joinerInsideMath);
assert.equal(containsUnsupportedKatexText(joinerSafe), false);
assert.equal(joinerSafe.includes("\u200D"), false);

const prose = "ක්ෂුද්‍රජීව විද්‍යාව";
assert.equal(sanitizeKatexMathBoundaries(prose), prose);

console.log("KaTeX Sinhala safety tests passed.");
