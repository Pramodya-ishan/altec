export function classifyAIError(error: any) {
  let errMsg = error?.message || 'Internal server error';
  let code = "UNKNOWN_ERROR";
  let hint = "Please try again later.";

  if (errMsg.includes('Prepayment Credits Depleted')) {
    code = "CREDITS_DEPLETED";
    errMsg = "Wrong AI Studio API key path is still being used. Use Vertex AI auth.";
    hint = "The server is still using AI Studio Developer API key, which is wrong for our billing setup. Please ensure Google Cloud ADC is configured.";
  } else if (errMsg.includes('Could not load the default credentials')) {
    code = "CREDENTIALS_MISSING";
    errMsg = "Missing Google Cloud service account credentials.";
    hint = "Missing service account / ADC configuration.";
  } else if (error?.status === 403 || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('aiplatform.endpoints.predict')) {
    code = "PERMISSION_DENIED";
    errMsg = "Service account lacks roles/aiplatform.user or API is not enabled.";
    hint = "Service account lacks roles/aiplatform.user or Vertex AI API is not enabled.";
  } else if (error?.status === 429 || errMsg.includes('quota') || errMsg.includes('rate limit')) {
    code = "QUOTA_EXCEEDED";
    errMsg = "Quota or rate limit exceeded.";
    hint = "Too many requests. Please try again in a minute.";
  } else if (error?.status === 404 || errMsg.includes('not found') || errMsg.includes('NOT_FOUND')) {
    code = "MODEL_NOT_FOUND";
    errMsg = "Model not available in selected project/location.";
    hint = "Check model access or change region location.";
  } else if (errMsg.includes('safety') || errMsg.includes('blocked')) {
    code = "SAFETY_BLOCK";
    errMsg = "Response blocked by safety settings.";
    hint = "Please adjust your prompt and try again.";
  } else if (errMsg.includes('timeout') || errMsg.includes('network')) {
    code = "NETWORK_TIMEOUT";
    errMsg = "Network timeout.";
    hint = "The network is slow, please try again.";
  }

  return {
    ok: false,
    error: errMsg,
    code,
    hint,
    raw: errMsg,
    rawSafe: errMsg
  };
}
