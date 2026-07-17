import assert from "node:assert/strict";
import { restoreVercelApiPath } from "../vercelApiPath";

assert.equal(
  restoreVercelApiPath("/api?__path=pdf%2Fdirect-qa-file"),
  "/api/pdf/direct-qa-file",
);
assert.equal(
  restoreVercelApiPath("/api?__path=pdf%2Focr-status%2Fabc&retry=1"),
  "/api/pdf/ocr-status/abc?retry=1",
);
assert.equal(
  restoreVercelApiPath("/api/pdf/direct-qa-file"),
  "/api/pdf/direct-qa-file",
);
assert.equal(restoreVercelApiPath("/api"), "/api");

console.log("Vercel API path restoration tests passed");
