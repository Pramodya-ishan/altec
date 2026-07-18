import assert from "node:assert/strict";
import { unlimitedRequestMiddleware } from "../rateLimiter";

function run() {
  for (let index = 0; index < 1_000; index += 1) {
    let nextCalled = false;
    const headers = new Map<string, string>();
    const response = {
      setHeader(name: string, value: string) { headers.set(name, value); },
      status() { throw new Error("The unlimited middleware must never set an error status."); },
    } as any;
    unlimitedRequestMiddleware({} as any, response, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(headers.get("X-Application-Rate-Limit"), "disabled");
  }
  console.log("[PASS] Application request limiter is disabled without emitting 429");
}

run();
