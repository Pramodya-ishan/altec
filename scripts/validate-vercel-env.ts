import {
  getGoogleServiceAccountFromEnvironment,
  GoogleCredentialConfigurationError,
} from "../server/utils/googleCredentials";

function validateVercelEnvironment() {
  const isVercel = process.env.VERCEL === "1";
  const credential = getGoogleServiceAccountFromEnvironment();

  if (isVercel && !credential) {
    throw new GoogleCredentialConfigurationError(
      "Vercel requires GOOGLE_APPLICATION_CREDENTIALS_JSON (recommended) or all three split Firebase credential variables",
    );
  }

  if (!credential) {
    console.log("Skipped Google service-account validation outside Vercel (no credential configured). ");
    return;
  }

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

  if (isVercel && !process.env.ADMIN_EMAILS?.trim() && !process.env.SYLLABUS_OWNER_EMAIL?.trim()) {
    console.warn("[VERCEL_ENV] ADMIN_EMAILS/SYLLABUS_OWNER_EMAIL is not configured; lesson video upload will be unavailable to the project owner.");
  }

  console.log(`Validated Google service-account configuration for project ${credential.project_id}.`);
}

try {
  validateVercelEnvironment();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("\n[VERCEL_ENV] Firebase/Google credential validation failed:");
  console.error(`  ${detail}`);
  console.error("  Fix: Vercel Project Settings -> Environment Variables -> GOOGLE_APPLICATION_CREDENTIALS_JSON");
  console.error("  Set it to the complete Firebase service-account JSON or one-line Base64 of that JSON, then redeploy.");
  console.error("  Do not use a filename, partial private key, or placeholder.\n");
  process.exit(1);
}
