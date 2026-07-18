import {
  getGoogleServiceAccountFromEnvironment,
  GoogleCredentialConfigurationError,
} from "../server/utils/googleCredentials";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for a Vercel deployment.`);
  return value;
}

function requireOneOf(...names: string[]) {
  if (!names.some((name) => process.env[name]?.trim())) {
    throw new Error(`Configure one of: ${names.join(", ")}.`);
  }
}

export function validateVercelEnvironment() {
  const isVercel = process.env.VERCEL === "1";
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
    if (process.env.FIREBASE_APP_CHECK_REQUIRED?.trim().toLowerCase() !== "true") {
      throw new Error("FIREBASE_APP_CHECK_REQUIRED=true is required in Vercel.");
    }
    if (process.env.VIDEO_REQUIRE_APP_CHECK?.trim().toLowerCase() !== "true") {
      throw new Error("VIDEO_REQUIRE_APP_CHECK=true is required in Vercel.");
    }
    required("VITE_FIREBASE_APP_CHECK_SITE_KEY");
    required("ADMIN_EMAILS");

    requireOneOf("SFT_SYLLABUS_STORAGE_PATH", "SFT_SYLLABUS_URL");
    requireOneOf("ET_SYLLABUS_STORAGE_PATH", "ET_SYLLABUS_URL");
    requireOneOf("ICT_SYLLABUS_STORAGE_PATH", "ICT_SYLLABUS_URL");
  }

  console.log(`Validated secure Vercel configuration for project ${credential.project_id}.`);
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
