import assert from "node:assert/strict";
import { shouldUseRedirectAuth } from "../authStrategy";

assert.equal(shouldUseRedirectAuth({ standalone: false, userAgent: "Mozilla/5.0 Windows", viewportWidth: 1280 }), false);
assert.equal(shouldUseRedirectAuth({ standalone: false, userAgent: "Mozilla/5.0 iPhone", viewportWidth: 1024 }), true);
assert.equal(shouldUseRedirectAuth({ standalone: true, userAgent: "Mozilla/5.0 Windows", viewportWidth: 1280 }), true);
assert.equal(shouldUseRedirectAuth({ standalone: false, userAgent: "Mozilla/5.0 Windows", viewportWidth: 390 }), true);
console.log("auth strategy tests passed");
