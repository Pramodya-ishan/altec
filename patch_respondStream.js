import fs from 'fs';

let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

// Replace classifyAIError import
content = content.replace('import { classifyAIError } from "./errors";', 'import { classifyAiError } from "./aiErrorClassifier";');

// Update error handling in respondStream catch block
const oldCatchBlockRegex = /catch \(\s*error\s*:\s*any\s*\)\s*\{[\s\S]*?trace\.lastEvent = "done";\s*\}/;

const newCatchBlock = `catch (error: any) {
    console.error("Stream Error", error);
    trace.errorCode = error.code || "UNKNOWN_ERROR";
    trace.errorMessage = error.message || String(error);
    
    // Check if error is AI_BILLING_EXHAUSTED (from checkAiBillingCircuit or classifyAiError)
    const classified = error.code === "AI_BILLING_EXHAUSTED" ? error : classifyAiError(error);
    
    if (classified.code === "AI_BILLING_EXHAUSTED") {
      emitSse(res, "error", {
        code: "AI_BILLING_EXHAUSTED",
        message: "AI credits අවසන් වෙලා තියෙනවා. Billing update කළාම නැවත AI answer දෙන්නම්.",
        canRetry: false,
        localOnlyAvailable: true
      });
      emitSse(res, "suggestions", {
        suggestions: [
          "Firebase PDFs list කරන්න",
          "Indexed PDF chunks බලන්න",
          "Billing fix කළාට පස්සේ answer continue කරන්න"
        ]
      });
      emitSse(res, "done", {
        completed: false,
        reason: "AI_BILLING_EXHAUSTED",
        canContinue: false
      });
    } else {
      emitSse(res, "error", { ok: false, error: classified.userMessage || classified.errorMessage || String(error), code: classified.code, recoverable: true });
      if (!res.headersSent) {
         emitSse(res, "token", { text: "\\n\\n⚠️ සමාවන්න, පද්ධතියේ දෝෂයක් ඇති විය." });
      }
      emitSse(res, "done", { ok: false, completed: false, requestId, chatSaved: false, finishReason: "error_recovered" });
    }
    
    trace.doneSent = true;
    trace.lastEvent = "done";
  }`;

content = content.replace(oldCatchBlockRegex, newCatchBlock);

fs.writeFileSync('server/ai/respondStream.ts', content);
