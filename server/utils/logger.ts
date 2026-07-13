export function redactString(str: string): string {
  if (!str) return str;
  let redacted = str;
  // Redact Bearer tokens
  redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/ig, "Bearer [REDACTED]");
  // Redact emails
  redacted = redacted.replace(/[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");
  // Redact API keys (AIzaSy...)
  redacted = redacted.replace(/AIzaSy[a-zA-Z0-9_\-]{33}/g, "AIzaSy[REDACTED]");
  return redacted;
}

export function redactObject(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return redactString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = [
        "authorization", "cookie", "token", "key", "secret", "password", 
        "private", "email", "prompt", "text", "body", "ocr", "payload",
        "credential", "cert", "url", "signedurl", "private_key"
      ].some(k => lowerKey.includes(k));

      if (isSensitive) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactObject(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

export const logger = {
  info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(redactObject(meta)) : "");
  },
  warn(message: string, meta?: any) {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(redactObject(meta)) : "");
  },
  error(message: string, error?: any, meta?: any) {
    const redactedMeta = meta ? redactObject(meta) : {};
    let errorMsg = error;
    if (error instanceof Error) {
      errorMsg = {
        message: redactString(error.message),
        name: error.name,
        stack: error.stack ? redactString(error.stack).split("\n").slice(0, 3).join("\n") : undefined
      };
    } else {
      errorMsg = redactObject(error);
    }
    console.error(`[ERROR] ${message}`, { error: errorMsg, ...redactedMeta });
  }
};
