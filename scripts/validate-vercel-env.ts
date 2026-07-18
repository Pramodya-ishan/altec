import {
  getGoogleServiceAccountFromEnvironment,
  GoogleCredentialConfigurationError,
} from "../server/utils/googleCredentials";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for a Vercel deployment.`);
  return value;
}

function hasOneOf(...names: string[]) {
  return names.some((name) => process.env[name]?.trim());
}

function parseOptionalBoolean(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return undefined;
  if (["true", "1", "yes", "y", "t"].includes(raw)) return true;
  if (["false", "0", "no", "n", "f"].includes(raw)) return false;
  throw new Error(`${name} must be true or false.`);
}

export function validateVercelEnvironment() {
  const isVercel = process.env.VERCEL === "1";
  const warnings: string[] = [];
  const credential = getGoogleServiceAccountFromEnvironment();

  if (!isVercel) {
    if (!credential) {
      console.log("Skipped Vercel-only environment validation outside Vercel.");
      return;
    }
  }

  if (isVercel && !credential) {
    throw new GoogleCredentialConfigurationError(
      "Vercel requires GOOGLE_APPLICATION_CREDENTIALS_JSON (recommended) or all three split Firebase credential variables",
    );
  }

  if (!credential) return;

  const configuredProjects = [
    process.env.GOOGLE_CLOUD_PROJECT,
    process.env.FIREBASE_PROJECT_ID,
    process.env.VITE_FIREBASE_PROJECT_ID,
  ].map((value) => value?.trim()).filter(Boolean);

  for (const configuredProject of configuredProjects) {
    if (configuredProject !== credential.project_id) {
      throw new GoogleCredentialConfigurationError(
        `service-account project_id (${credential.project_id}) does not match configured project (${configuredProject})`,
      );
    }
  }

  if (isVercel && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new GoogleCredentialConfigurationError(
      "remove GOOGLE_APPLICATION_CREDENTIALS from Vercel; file paths do not survive deployment",
    );
  }

  if (isVercel) {
    const origins = required("ALLOWED_ORIGINS")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (origins.includes("*") || origins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
      throw new Error("ALLOWED_ORIGINS must contain only explicit production/preview HTTPS origins.");
    }
    const appCheckSiteKey = process.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim() || "";
    const appCheckRequested = parseOptionalBoolean("FIREBASE_APP_CHECK_REQUIRED");
    const videoAppCheckRequested = parseOptionalBoolean("VIDEO_REQUIRE_APP_CHECK");

    // App Check is an optional hardening layer. A missing reCAPTCHA site key must
    // never make a deployment impossible or leave the frontend unable to call the
    // authenticated API. The runtime enables enforcement automatically whenever a
    // valid client site key is configured.
    if (!appCheckSiteKey) {
      warnings.push(
        "VITE_FIREBASE_APP_CHECK_SITE_KEY is not configured; Firebase Auth and server authorization remain active, while App Check enforcement is disabled.",
      );
    }
    if (appCheckRequested === true && !appCheckSiteKey) {
      warnings.push(
        "FIREBASE_APP_CHECK_REQUIRED=true was requested without a client site key; the runtime will safely fall back to authenticated requests instead of blocking every API call.",
      );
    }
    if (videoAppCheckRequested === true && !appCheckSiteKey) {
      warnings.push(
        "VIDEO_REQUIRE_APP_CHECK=true was requested without a client site key; video routes will retain authentication and access checks but skip App Check until the key is configured.",
      );
    }
    if (!process.env.ADMIN_EMAILS?.trim()) {
      warnings.push("ADMIN_EMAILS is not configured; use Firebase custom claims for administrator/content-manager access.");
    }

    for (const [subject, names] of [
      ["SFT", ["SFT_SYLLABUS_STORAGE_PATH", "SFT_SYLLABUS_URL"]],
      ["ET", ["ET_SYLLABUS_STORAGE_PATH", "ET_SYLLABUS_URL"]],
      ["ICT", ["ICT_SYLLABUS_STORAGE_PATH", "ICT_SYLLABUS_URL"]],
    ] as const) {
      if (!hasOneOf(...names)) {
        warnings.push(`${subject} syllabus environment source is not configured; bundled/indexed fallbacks will be used when available.`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("\n[VERCEL_ENV] Deployment configuration warnings:");
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
    console.warn("");
  }

  console.log(`Validated Vercel configuration for project ${credential.project_id}.`);
}


try {
  validateVercelEnvironment();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("\n[VERCEL_ENV] Deployment configuration validation failed:");
  console.error(`  ${detail}`);
  console.error("  Fix the missing value in Vercel Project Settings -> Environment Variables, then redeploy.\n");
  process.exit(1);
}
