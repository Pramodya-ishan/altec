import assert from "node:assert/strict";
import { isMobileAuthEnvironment, shouldUseRedirectAuth } from "../authStrategy";

assert.equal(isMobileAuthEnvironment({ standalone: false, userAgent: "Mozilla/5.0 Windows", viewportWidth: 1280 }), false);
assert.equal(isMobileAuthEnvironment({ standalone: false, userAgent: "Mozilla/5.0 iPhone", viewportWidth: 1024 }), true);
assert.equal(isMobileAuthEnvironment({ standalone: true, userAgent: "Mozilla/5.0 Windows", viewportWidth: 1280 }), true);
assert.equal(isMobileAuthEnvironment({ standalone: false, userAgent: "Mozilla/5.0 Windows", viewportWidth: 390 }), true);

assert.equal(shouldUseRedirectAuth({ standalone: false, userAgent: "Mozilla/5.0 Windows", viewportWidth: 1280, redirectConfigured: true }), false);
assert.equal(shouldUseRedirectAuth({ standalone: false, userAgent: "Mozilla/5.0 iPhone", viewportWidth: 1024, redirectConfigured: true }), true);
assert.equal(shouldUseRedirectAuth({ standalone: true, userAgent: "Mozilla/5.0 Windows", viewportWidth: 1280, redirectConfigured: true }), true);
assert.equal(shouldUseRedirectAuth({ standalone: false, userAgent: "Mozilla/5.0 Windows", viewportWidth: 390, redirectConfigured: false }), false);

console.log("Google auth strategy tests passed");
