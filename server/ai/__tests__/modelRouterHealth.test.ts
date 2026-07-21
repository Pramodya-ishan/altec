import assert from "node:assert/strict";
import {
  callGeminiWithFallback,
  generateContentStreamWithFallback,
  getModelForTask,
  isModelTemporarilyUnhealthy,
  recordModelFailure,
  recordModelSuccess,
  resetModelHealthForTests,
} from "../modelRouter";

resetModelHealthForTests();
assert.equal(isModelTemporarilyUnhealthy("primary", 1_000), false);
const first = recordModelFailure("primary", new Error("503 overloaded"), 1_000);
assert.equal(isModelTemporarilyUnhealthy("primary", 1_001), true);
assert.equal(isModelTemporarilyUnhealthy("primary", first.unhealthyUntil + 1), false);

const notFound = recordModelFailure("missing-model", new Error("404 model not found"), 5_000);
const normalCooldown = first.unhealthyUntil - 1_000;
const notFoundCooldown = notFound.unhealthyUntil - 5_000;
assert.ok(notFoundCooldown >= normalCooldown * 5, "404 failures should receive a substantially longer cooldown");
recordModelSuccess("missing-model");
assert.equal(isModelTemporarilyUnhealthy("missing-model", 5_001), false);

// A stream request must remain a stream even when an unhealthy primary is
// skipped before the request starts and no AbortSignal was supplied.
resetModelHealthForTests();
const finalModels = getModelForTask("final_answer");
recordModelFailure(finalModels.primary, new Error("503 overloaded"));
let nonStreamCalled = false;
let streamCalled = false;
const fakeStream = { async *[Symbol.asyncIterator]() { yield { text: "ok" }; } };
const fakeClient = {
  models: {
    async generateContent() { nonStreamCalled = true; throw new Error("non-stream path must not be used"); },
    async generateContentStream() { streamCalled = true; return fakeStream; },
  },
} as any;
const routed = await generateContentStreamWithFallback("final_answer", { contents: "test" } as any, fakeClient);
assert.equal(streamCalled, true);
assert.equal(nonStreamCalled, false);
assert.equal(routed.stream, fakeStream);
assert.equal(routed.modelUsed, finalModels.fallback);

// A stuck provider request must time out and advance to the fallback instead of
// leaving the answer spinner open indefinitely.
resetModelHealthForTests();
const previousTimeout = process.env.AI_MODEL_REQUEST_TIMEOUT_MS;
process.env.AI_MODEL_REQUEST_TIMEOUT_MS = "1000";
let requestCalls = 0;
const timeoutClient = {
  models: {
    async generateContent() {
      requestCalls += 1;
      if (requestCalls === 1) return await new Promise(() => undefined);
      return { text: "fallback ok" };
    },
  },
} as any;
const timedRoute = await callGeminiWithFallback("fast_background", { contents: "test" } as any, timeoutClient);
assert.equal(requestCalls, 2);
assert.match(String(timedRoute.warning || ""), /fallback/i);
if (previousTimeout === undefined) delete process.env.AI_MODEL_REQUEST_TIMEOUT_MS;
else process.env.AI_MODEL_REQUEST_TIMEOUT_MS = previousTimeout;

resetModelHealthForTests();
console.log("AI model health tests passed.");
