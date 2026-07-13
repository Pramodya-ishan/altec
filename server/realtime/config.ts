export function getRealtimeConfig() {
  const enabled =
    String(process.env.ENABLE_REALTIME_VOICE || "").toLowerCase() === "true";

  const provider = process.env.REALTIME_PROVIDER || "gemini_live";
  const missing: string[] = [];

  if (!enabled) {
    return {
      enabled,
      provider,
      available: false,
      missing: [],
      reason: "REALTIME_DISABLED",
      model: null,
      project: null,
      location: "global",
      authMode: "none"
    };
  }

  if (provider === "gemini_live") {
    if (!process.env.GEMINI_LIVE_MODEL) missing.push("GEMINI_LIVE_MODEL");

    const vertexMode =
      String(process.env.GEMINI_USE_VERTEX || "").toLowerCase() === "true";

    if (vertexMode) {
      if (!process.env.GOOGLE_CLOUD_PROJECT) missing.push("GOOGLE_CLOUD_PROJECT");
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        missing.push("GOOGLE_APPLICATION_CREDENTIALS_JSON");
      }
    } else {
      if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY_OR_VERTEX");
    }

    return {
      enabled,
      provider: "gemini_live",
      available: missing.length === 0,
      missing,
      model: process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview",
      project: process.env.GOOGLE_CLOUD_PROJECT || null,
      location: process.env.GOOGLE_CLOUD_LOCATION || "global",
      authMode: vertexMode ? "vertex_service_account" : "gemini_api_key"
    };
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
    return {
      enabled,
      provider: "openai",
      available: missing.length === 0,
      missing,
      model: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17",
      project: null,
      location: "global",
      authMode: "none"
    };
  }

  return {
    enabled,
    provider,
    available: false,
    missing: ["REALTIME_PROVIDER_INVALID"],
    model: null,
    project: null,
    location: "global",
    authMode: "none"
  };
}
