import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const serviceAccount = JSON.stringify({
  type: "service_account",
  project_id: "al-ai-chat",
  client_email: "app-check-test@al-ai-chat.iam.gserviceaccount.com",
  private_key: privateKey,
});

const baseEnvironment = {
  ...process.env,
  VERCEL: "1",
  NODE_ENV: "production",
  GOOGLE_APPLICATION_CREDENTIALS_JSON: serviceAccount,
  GOOGLE_CLOUD_PROJECT: "al-ai-chat",
  FIREBASE_PROJECT_ID: "al-ai-chat",
  VITE_FIREBASE_PROJECT_ID: "al-ai-chat",
  ALLOWED_ORIGINS: "https://tecal.vercel.app",
  FIREBASE_APP_CHECK_REQUIRED: "true",
  VIDEO_REQUIRE_APP_CHECK: "true",
  VITE_FIREBASE_APP_CHECK_SITE_KEY: "",
  ADMIN_EMAILS: "",
  SFT_SYLLABUS_STORAGE_PATH: "",
  SFT_SYLLABUS_URL: "",
  ET_SYLLABUS_STORAGE_PATH: "",
  ET_SYLLABUS_URL: "",
  ICT_SYLLABUS_STORAGE_PATH: "",
  ICT_SYLLABUS_URL: "",
};

const validation = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/validate-vercel-env.ts"],
  { cwd: process.cwd(), env: baseEnvironment, encoding: "utf8" },
);

assert.equal(validation.status, 0, validation.stderr || validation.stdout);
assert.match(
  `${validation.stdout}\n${validation.stderr}`,
  /App Check enforcement is disabled|fall back to authenticated requests/,
);

const runtime = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "-e",
    "import('./server/utils/env.ts').then(({env}) => console.log(JSON.stringify({appCheckRequired: env.FIREBASE_APP_CHECK_REQUIRED, videoAppCheckRequired: env.VIDEO_REQUIRE_APP_CHECK})))",
  ],
  {
    cwd: process.cwd(),
    env: {
      ...baseEnvironment,
      VERCEL: "",
      GOOGLE_APPLICATION_CREDENTIALS_JSON: "",
      DEV_BYPASS_AUTH: "false",
      ENABLE_MOCK_ROUTES: "false",
      ENABLE_MODEL_TEST_ROUTE: "false",
    },
    encoding: "utf8",
  },
);

assert.equal(runtime.status, 0, runtime.stderr || runtime.stdout);
assert.match(runtime.stdout, /"appCheckRequired":false/);
assert.match(runtime.stdout, /"videoAppCheckRequired":false/);

console.log("App Check deployment fallback tests passed");
