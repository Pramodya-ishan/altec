import assert from "node:assert/strict";
import { withStreamIdleTimeout } from "../streamWatchdog";

async function collect<T>(stream: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of stream) values.push(value);
  return values;
}

const healthy = {
  async *[Symbol.asyncIterator]() {
    yield "a";
    await new Promise((resolve) => setTimeout(resolve, 5));
    yield "b";
  },
};
assert.deepEqual(await collect(withStreamIdleTimeout(healthy, { idleTimeoutMs: 1_000 })), ["a", "b"]);

const stalled = {
  async *[Symbol.asyncIterator]() {
    yield "first";
    await new Promise(() => undefined);
  },
};
await assert.rejects(
  collect(withStreamIdleTimeout(stalled, { idleTimeoutMs: 1_000, label: "test stream" })),
  (error: any) => error?.code === "AI_STREAM_IDLE_TIMEOUT",
);

console.log("AI stream watchdog tests passed.");
