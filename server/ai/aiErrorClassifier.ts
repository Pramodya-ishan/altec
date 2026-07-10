export function classifyAiError(error: any) {
  const raw =
    typeof error === "string"
      ? error
      : JSON.stringify(error || {});

  const text = raw.toLowerCase();

  if (text.includes("prepayment credits are depleted") || text.includes("prepayment")) {
    const deployTarget = process.env.APP_DEPLOY_TARGET || "cloud_run";
    if (deployTarget === "cloud_run") {
      return {
        code: "AI_BILLING_EXHAUSTED",
        retryable: false,
        userMessage: "This request is still using API key / AI Studio prepay path. Check for direct new GoogleGenAI({ apiKey }) calls.",
        diagnostic: "This request is still using API key / AI Studio prepay path. Check for direct new GoogleGenAI({ apiKey }) calls."
      };
    }
    return {
      code: "AI_BILLING_EXHAUSTED",
      retryable: false,
      userMessage: "AI Studio Prepay credits අවසන් වෙලා තියෙනවා. Vertex mode use කරනවා නම් GEMINI_API_KEY remove කරලා service account client එක පමණක් use කරන්න.",
      diagnostic: "This call is using Gemini API key / AI Studio Prepay path, not Vertex AI Cloud Billing path."
    };
  }

  if (
    text.includes("ai_billing_exhausted") ||
    text.includes("resource_exhausted") ||
    text.includes("\"code\":429") ||
    text.includes("code:429") ||
    text.includes("billing") ||
    text.includes("quota")
  ) {
    return {
      code: "AI_BILLING_EXHAUSTED",
      retryable: false,
      userMessage: "AI credits අවසන් වෙලා තියෙනවා. Billing/credits update කළාම නැවත PDF scan/AI answer දෙන්න පුළුවන්."
    };
  }

  if (text.includes("too many requests") || text.includes("rate limit")) {
    return {
      code: "AI_RATE_LIMITED",
      retryable: false,
      userMessage: "AI quota/rate limit hit වෙලා තියෙනවා. ටික වෙලාවකින් නැවත try කරන්න."
    };
  }

  return {
    code: "AI_MODEL_ERROR",
    retryable: true,
    userMessage: "AI model error එකක් වුණා."
  };
}
