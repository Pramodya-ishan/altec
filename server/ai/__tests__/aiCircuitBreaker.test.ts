import assert from "node:assert/strict";
import {
  aiBillingCircuitOpenUntil,
  isAiBillingCircuitOpen,
  openAiBillingCircuit,
} from "../aiCircuitBreaker";

const previous = process.env.ENABLE_AI_BILLING_CIRCUIT_BREAKER;
try {
  delete process.env.ENABLE_AI_BILLING_CIRCUIT_BREAKER;
  openAiBillingCircuit(new Error("billing"));
  assert.equal(isAiBillingCircuitOpen(), false, "billing circuit must be advisory by default");
  assert.equal(aiBillingCircuitOpenUntil, 0, "default billing errors must not create a 503 cooldown");

  process.env.ENABLE_AI_BILLING_CIRCUIT_BREAKER = "true";
  openAiBillingCircuit(new Error("billing"));
  assert.equal(isAiBillingCircuitOpen(), true, "explicit circuit flag should enable the cooldown");
} finally {
  if (previous === undefined) delete process.env.ENABLE_AI_BILLING_CIRCUIT_BREAKER;
  else process.env.ENABLE_AI_BILLING_CIRCUIT_BREAKER = previous;
}

console.log("AI billing circuit tests passed");
