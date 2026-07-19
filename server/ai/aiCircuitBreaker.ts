import { classifyAiError } from "./aiErrorClassifier";

export let aiBillingCircuitOpenUntil = 0;
let lastBillingError: any = null;

function isBillingCircuitEnforced() {
  return String(process.env.ENABLE_AI_BILLING_CIRCUIT_BREAKER || "").toLowerCase() === "true";
}

export function isAiBillingCircuitOpen() {
  return isBillingCircuitEnforced() && Date.now() < aiBillingCircuitOpenUntil;
}

export function getAiBillingState() {
  return {
    exhausted: isAiBillingCircuitOpen(),
    circuitOpenUntil: aiBillingCircuitOpenUntil,
    lastBillingError
  };
}

export function openAiBillingCircuit(error: any) {
  aiBillingCircuitOpenUntil = isBillingCircuitEnforced() ? Date.now() + 10 * 60 * 1000 : 0;
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
    err.status = 503;
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
    e.status = 503;
    e.retryable = false;
    e.originalError = err;
    throw e;
  }

  return classification;
}
