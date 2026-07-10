export async function retryGoogleAuthOperation<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const delays = [500, 1500, 3000];

  let lastErr;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable =
        msg.includes("Premature close") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("oauth2") ||
        msg.includes("fetch") ||
        msg.includes("fetch failed");

      if (msg.includes("Premature close") || msg.includes("Invalid response body while trying to fetch oauth2 token") || msg.includes("GOOGLE_AUTH_TOKEN_FETCH_FAILED") || msg.includes("UPLOAD_STORAGE_FAILED")) {
        console.warn(`[Retry helper] Fast-failing ${name} due to known Admin Storage degradation: `, msg);
        throw Object.assign(new Error("Admin Storage degraded"), {
           ok: false,
           code: "ADMIN_STORAGE_DEGRADED_USE_CLIENT_HANDOFF",
           recommendedMode: "client_firebase_storage",
           message: "Use client Firebase Storage handoff instead of backend Admin Storage download."
        });
      }
      if (!retryable || i === delays.length) break;
      console.warn(`[Retry helper] Attempt ${i + 1} for ${name} failed. Retrying in ${delays[i]}ms... Error:`, msg);
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }

  throw lastErr;
}
