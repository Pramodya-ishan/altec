import assert from "node:assert/strict";
import { PLATFORM_FEATURES, summarizeFeatureCatalog } from "../featureCatalog";

assert.equal(PLATFORM_FEATURES.length, 300);
assert.equal(new Set(PLATFORM_FEATURES.map((feature) => feature.id)).size, 300);
assert.deepEqual(PLATFORM_FEATURES.map((feature) => feature.id), Array.from({ length: 300 }, (_, index) => index + 1));
const summary = summarizeFeatureCatalog();
assert.equal(summary.total, 300);
assert.equal(summary.byState.available + summary.byState.foundation + summary.byState.planned, 300);
assert.ok(summary.integratedPercent >= summary.productionReadyPercent);

console.log("featureCatalog tests passed");
