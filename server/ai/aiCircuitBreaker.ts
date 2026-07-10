import { classifyAiError } from "./aiErrorClassifier";

export let aiBillingCircuitOpenUntil = 0;
let lastBillingError: any = null;

export function isAiBillingCircuitOpen() {
  return Date.now() < aiBillingCircuitOpenUntil;
}

export function getAiBillingState() {
  return {
    exhausted: isAiBillingCircuitOpen(),
    circuitOpenUntil: aiBillingCircuitOpenUntil,
    lastBillingError
  };
}

export function openAiBillingCircuit(error: any) {
  aiBillingCircuitOpenUntil = Date.now() + 10 * 60 * 1000;
  lastBillingError = {
    code: "AI_BILLING_EXHAUSTED",
    message: "Gemini billing/prepayment credits exhausted",
    at: Date.now(),
    raw: String(error?.message || error).slice(0, 500)
  };
}

export function assertAiAvailable() {
  if (isAiBillingCircuitOpen()) {
    const err: any = new Error("AI billing exhausted");
    err.code = "AI_BILLING_EXHAUSTED";
    err.status = 429;
    err.userMessage = "AI credits අවසන් වෙලා තියෙනවා.";
    throw err;
  }
}

export function checkAiBillingCircuit() {
  assertAiAvailable();
}

export function handleAiError(err: any) {
  const classification = classifyAiError(err);

  if (classification.code === "AI_BILLING_EXHAUSTED") {
    openAiBillingCircuit(err);
    const e: any = new Error(classification.userMessage);
    e.code = "AI_BILLING_EXHAUSTED";
    e.status = 429;
    e.retryable = false;
    e.originalError = err;
    throw e;
  }

  return classification;
}
