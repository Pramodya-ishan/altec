export interface GoogleServiceAccount {
  type?: string;
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
  universe_domain?: string;
  [key: string]: unknown;
}

type Environment = Record<string, string | undefined>;

export class GoogleCredentialConfigurationError extends Error {
  readonly code = "INVALID_GOOGLE_SERVICE_ACCOUNT";

  constructor(message: string) {
    super(message);
    this.name = "GoogleCredentialConfigurationError";
  }
}

function configurationError(source: string, detail: string): never {
  throw new GoogleCredentialConfigurationError(`${source}: ${detail}`);
}

function normalizePrivateKey(value: string): string {
  // A value pasted through a dashboard may contain either real line breaks,
  // escaped \n sequences, or an extra layer of escaping. Normalize all of
  // those forms without trying to repair any other malformed JSON.
  return value.replace(/\\+n/g, "\n");
}

function validateServiceAccountObject(value: unknown, source: string): GoogleServiceAccount {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return configurationError(source, "must contain one complete service-account JSON object");
  }

  const candidate = value as Record<string, unknown>;
  const projectId = typeof candidate.project_id === "string" ? candidate.project_id.trim() : "";
  const clientEmail = typeof candidate.client_email === "string" ? candidate.client_email.trim() : "";
  const privateKey = typeof candidate.private_key === "string"
    ? normalizePrivateKey(candidate.private_key)
    : "";

  if (!projectId) configurationError(source, "is missing project_id");
  if (!clientEmail || !clientEmail.includes("@")) configurationError(source, "is missing a valid client_email");
  if (
    !privateKey.includes("-----BEGIN PRIVATE KEY-----")
    || !privateKey.includes("-----END PRIVATE KEY-----")
  ) {
    configurationError(source, "is missing a complete PEM private_key");
  }
  try {
    createPrivateKey(privateKey);
  } catch {
    configurationError(source, "private_key is not a valid PKCS#8 PEM key (it may be truncated or escaped incorrectly)");
  }
  if (candidate.type !== undefined && candidate.type !== "service_account") {
    configurationError(source, "type must be service_account");
  }

  return {
    ...candidate,
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  } as GoogleServiceAccount;
}

export function parseGoogleServiceAccountJson(
  rawValue: string,
  source = "GOOGLE_APPLICATION_CREDENTIALS_JSON",
): GoogleServiceAccount {
  let raw = rawValue.replace(/^\uFEFF/, "").trim();
  if (!raw) configurationError(source, "is empty");

  raw = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const assignment = raw.match(/^(?:GOOGLE_APPLICATION_CREDENTIALS_JSON|GOOGLE_SERVICE_ACCOUNT_JSON)\s*=\s*([\s\S]+)$/i);
  if (assignment) raw = assignment[1].trim();
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    const unwrapped = raw.slice(1, -1).trim();
    if (unwrapped.startsWith("{") || unwrapped.startsWith('\"{')) raw = unwrapped;
  }

  if (/^(?:PASTE|REPLACE|YOUR)[_\s-]/i.test(raw) || /^<[^>]+>$/.test(raw)) {
    configurationError(source, "still contains a placeholder instead of service-account JSON");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    // Accept a JSON string containing the object. Some dashboard/CLI flows add
    // one extra JSON-encoding layer around a pasted secret.
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
  } catch {
    try {
      const compact = raw.replace(/\s+/g, "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length % 4 !== 0) throw new Error("not base64");
      const decoded = Buffer.from(compact, "base64").toString("utf8").replace(/^\uFEFF/, "").trim();
      if (!decoded.startsWith("{") && !decoded.startsWith('\"')) throw new Error("not JSON base64");
      parsed = JSON.parse(decoded);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
    } catch {
      return configurationError(
        source,
        "is not valid JSON or Base64 JSON; provide the complete downloaded service-account file",
      );
    }
  }

  return validateServiceAccountObject(parsed, source);
}

export function getGoogleServiceAccountFromEnvironment(
  environment: Environment = process.env,
): GoogleServiceAccount | null {
  const jsonValue = environment.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (jsonValue) return parseGoogleServiceAccountJson(jsonValue);

  const projectId = environment.FIREBASE_PROJECT_ID?.trim()
    || environment.GOOGLE_CLOUD_PROJECT?.trim();
  const clientEmail = environment.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = environment.FIREBASE_PRIVATE_KEY?.trim();
  const hasAnySplitValue = Boolean(projectId || clientEmail || privateKey);

  // Project IDs are commonly configured even when ADC/file credentials are
  // used, so only treat split mode as selected when its secret fields appear.
  if (!clientEmail && !privateKey) return null;
  if (!hasAnySplitValue || !projectId || !clientEmail || !privateKey) {
    return configurationError(
      "Firebase split credentials",
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must all be set",
    );
  }

  return validateServiceAccountObject({
    type: "service_account",
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  }, "Firebase split credentials");
}

export function serializeGoogleServiceAccount(serviceAccount: GoogleServiceAccount): string {
  return JSON.stringify(serviceAccount);
}

export function toFirebaseAdminServiceAccount(serviceAccount: GoogleServiceAccount) {
  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  };
}
import { createPrivateKey } from "node:crypto";
