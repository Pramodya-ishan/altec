import dotenv from "dotenv";
dotenv.config();

export interface ServerEnv {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  ALLOWED_ORIGINS: string[];
  GOOGLE_CLOUD_PROJECT: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIRESTORE_DATABASE_ID: string;
  GEMINI_API_KEY: string;
  GEMINI_DEFAULT_MODEL: string;
  DEV_BYPASS_AUTH: boolean;
  ENABLE_MOCK_ROUTES: boolean;
  ENABLE_MODEL_TEST_ROUTE: boolean;
  ENABLE_IMAGE_GENERATION: boolean;
  OCR_ENABLED: boolean;
  MAX_BODY_LIMIT_MB: number;
  FIREBASE_APP_CHECK_REQUIRED: boolean;
  ENABLE_VIDEO: boolean;
  ENABLE_VIDEO_TRANSCODING: boolean;
  VIDEO_REQUIRE_APP_CHECK: boolean;
  VIDEO_INPUT_BUCKET: string;
  VIDEO_OUTPUT_BUCKET: string;
  VIDEO_ARCHIVE_BUCKET: string;
  VIDEO_TRANSCODER_LOCATION: string;
  VIDEO_CDN_BASE_URL: string;
  VIDEO_CDN_KEY_NAME: string;
  VIDEO_CDN_SIGNING_KEY: string;
  VIDEO_COOKIE_DOMAIN: string;
  VIDEO_UPLOAD_MAX_MB: number;
  VIDEO_COOKIE_TTL_SECONDS: number;
  VIDEO_SESSION_TTL_SECONDS: number;
  ENABLE_4K: boolean;
}

const errors: string[] = [];

function validateBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const clean = value.trim().toLowerCase();
  if (clean === "true" || clean === "yes" || clean === "1" || clean === "t" || clean === "y") return true;
  if (clean === "false" || clean === "no" || clean === "0" || clean === "f" || clean === "n") return false;
  errors.push(`Invalid boolean value for ${key}: "${value}". Expected "true" or "false".`);
  return defaultValue;
}

function validateEnum<T extends string>(key: string, allowedValues: T[], defaultValue: T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const clean = value.trim() as T;
  if (allowedValues.includes(clean)) {
    return clean;
  }
  errors.push(`Invalid value for ${key}: "${value}". Expected one of: ${allowedValues.join(", ")}`);
  return defaultValue;
}

function validateNumber(key: string, defaultValue: number, min?: number, max?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const num = Number(value.trim());
  if (isNaN(num)) {
    errors.push(`Invalid number value for ${key}: "${value}".`);
    return defaultValue;
  }
  if (min !== undefined && num < min) {
    errors.push(`Value for ${key} (${num}) is below minimum limit (${min}).`);
  }
  if (max !== undefined && num > max) {
    errors.push(`Value for ${key} (${num}) exceeds maximum limit (${max}).`);
  }
  return num;
}

function validateOptional(key: string, defaultValue = ""): string {
  const value = process.env[key];
  return value !== undefined ? value.trim() : defaultValue;
}

const NODE_ENV = validateEnum("NODE_ENV", ["development", "production", "test"], "development");
const PORT = validateNumber("PORT", 3000, 1, 65535);

const rawOrigins = validateOptional("ALLOWED_ORIGINS", "");
let ALLOWED_ORIGINS: string[] = [];
if (rawOrigins) {
  ALLOWED_ORIGINS = rawOrigins.split(",").map(o => o.trim()).filter(Boolean);
} else {
  ALLOWED_ORIGINS = NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://localhost:3000"];
}

const GOOGLE_CLOUD_PROJECT = validateOptional("GOOGLE_CLOUD_PROJECT", "al-ai-chat");
const FIREBASE_PROJECT_ID = validateOptional("FIREBASE_PROJECT_ID", "al-ai-chat");
const FIREBASE_STORAGE_BUCKET = validateOptional("FIREBASE_STORAGE_BUCKET", "al-ai-chat.firebasestorage.app");
const FIRESTORE_DATABASE_ID = validateOptional("FIRESTORE_DATABASE_ID", "");

const GEMINI_API_KEY = validateOptional("GEMINI_API_KEY", "");
const GEMINI_DEFAULT_MODEL = validateOptional("GEMINI_DEFAULT_MODEL", "gemini-3.5-flash");

const DEV_BYPASS_AUTH = validateBoolean("DEV_BYPASS_AUTH", false);
const ENABLE_MOCK_ROUTES = validateBoolean("ENABLE_MOCK_ROUTES", false);
const ENABLE_MODEL_TEST_ROUTE = validateBoolean("ENABLE_MODEL_TEST_ROUTE", false);
const ENABLE_IMAGE_GENERATION = validateBoolean("ENABLE_IMAGE_GENERATION", true);
const OCR_ENABLED = validateBoolean("OCR_ENABLED", false);

const MAX_BODY_LIMIT_MB = validateNumber("MAX_BODY_LIMIT_MB", 2, 0.1, 100);
const FIREBASE_APP_CHECK_REQUIRED = validateBoolean("FIREBASE_APP_CHECK_REQUIRED", NODE_ENV === "production");
const ENABLE_VIDEO = validateBoolean("ENABLE_VIDEO", true);
const ENABLE_VIDEO_TRANSCODING = validateBoolean("ENABLE_VIDEO_TRANSCODING", false);
const VIDEO_REQUIRE_APP_CHECK = validateBoolean("VIDEO_REQUIRE_APP_CHECK", false);
const VIDEO_INPUT_BUCKET = validateOptional("VIDEO_INPUT_BUCKET", FIREBASE_STORAGE_BUCKET);
const VIDEO_OUTPUT_BUCKET = validateOptional("VIDEO_OUTPUT_BUCKET", "");
const VIDEO_ARCHIVE_BUCKET = validateOptional("VIDEO_ARCHIVE_BUCKET", "");
const VIDEO_TRANSCODER_LOCATION = validateOptional("VIDEO_TRANSCODER_LOCATION", "us-central1");
const VIDEO_CDN_BASE_URL = validateOptional("VIDEO_CDN_BASE_URL", "").replace(/\/$/, "");
const VIDEO_CDN_KEY_NAME = validateOptional("VIDEO_CDN_KEY_NAME", "");
const VIDEO_CDN_SIGNING_KEY = validateOptional("VIDEO_CDN_SIGNING_KEY", "");
const VIDEO_COOKIE_DOMAIN = validateOptional("VIDEO_COOKIE_DOMAIN", "");
const VIDEO_UPLOAD_MAX_MB = validateNumber("VIDEO_UPLOAD_MAX_MB", 10240, 1, 51200);
const VIDEO_COOKIE_TTL_SECONDS = validateNumber("VIDEO_COOKIE_TTL_SECONDS", 300, 60, 600);
const VIDEO_SESSION_TTL_SECONDS = validateNumber("VIDEO_SESSION_TTL_SECONDS", 600, 120, 3600);
const ENABLE_4K = validateBoolean("ENABLE_4K", false);

if (NODE_ENV === "production") {
  if (ALLOWED_ORIGINS.length === 0) {
    errors.push("ALLOWED_ORIGINS must list the production and preview application origins.");
  }
  if (ALLOWED_ORIGINS.includes("*")) {
    errors.push("CORS Wildcard origin is not permitted in production.");
  }
  if (ALLOWED_ORIGINS.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
    errors.push("Localhost origins are not permitted in production ALLOWED_ORIGINS.");
  }
  if (!FIREBASE_APP_CHECK_REQUIRED) {
    errors.push("FIREBASE_APP_CHECK_REQUIRED must be true in production.");
  }
  if (!VIDEO_REQUIRE_APP_CHECK) {
    errors.push("VIDEO_REQUIRE_APP_CHECK must be true in production.");
  }
  if (DEV_BYPASS_AUTH) {
    errors.push("Development authentication bypass (DEV_BYPASS_AUTH) is not allowed in production.");
  }
  if (ENABLE_MOCK_ROUTES) {
    errors.push("Mock routes (ENABLE_MOCK_ROUTES) are not allowed in production.");
  }
  if (ENABLE_MODEL_TEST_ROUTE) {
    errors.push("Model-test routes (ENABLE_MODEL_TEST_ROUTE) must be disabled in production.");
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    errors.push("GOOGLE_APPLICATION_CREDENTIALS file mode is not allowed in production. Use Workload Identity / ADC.");
  }
}

if (ENABLE_VIDEO_TRANSCODING && !VIDEO_OUTPUT_BUCKET) {
  errors.push("VIDEO_OUTPUT_BUCKET is required when ENABLE_VIDEO_TRANSCODING=true.");
}
if (VIDEO_CDN_BASE_URL && (!VIDEO_CDN_KEY_NAME || !VIDEO_CDN_SIGNING_KEY)) {
  errors.push("VIDEO_CDN_KEY_NAME and VIDEO_CDN_SIGNING_KEY are required when VIDEO_CDN_BASE_URL is configured.");
}

if (errors.length > 0) {
  console.error("❌ Environment configuration validation failed:");
  errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}

export const env: ServerEnv = {
  NODE_ENV,
  PORT,
  ALLOWED_ORIGINS,
  GOOGLE_CLOUD_PROJECT,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIRESTORE_DATABASE_ID,
  GEMINI_API_KEY,
  GEMINI_DEFAULT_MODEL,
  DEV_BYPASS_AUTH,
  ENABLE_MOCK_ROUTES,
  ENABLE_MODEL_TEST_ROUTE,
  ENABLE_IMAGE_GENERATION,
  OCR_ENABLED,
  MAX_BODY_LIMIT_MB,
  FIREBASE_APP_CHECK_REQUIRED,
  ENABLE_VIDEO,
  ENABLE_VIDEO_TRANSCODING,
  VIDEO_REQUIRE_APP_CHECK,
  VIDEO_INPUT_BUCKET,
  VIDEO_OUTPUT_BUCKET,
  VIDEO_ARCHIVE_BUCKET,
  VIDEO_TRANSCODER_LOCATION,
  VIDEO_CDN_BASE_URL,
  VIDEO_CDN_KEY_NAME,
  VIDEO_CDN_SIGNING_KEY,
  VIDEO_COOKIE_DOMAIN,
  VIDEO_UPLOAD_MAX_MB,
  VIDEO_COOKIE_TTL_SECONDS,
  VIDEO_SESSION_TTL_SECONDS,
  ENABLE_4K
};

export function logEnvConfig() {
  console.log("[CONFIG] Environment validated", {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    allowedOriginCount: env.ALLOWED_ORIGINS.length,
    googleProject: env.GOOGLE_CLOUD_PROJECT,
    firebaseProject: env.FIREBASE_PROJECT_ID,
    firestoreDatabaseConfigured: Boolean(env.FIRESTORE_DATABASE_ID),
    geminiModel: env.GEMINI_DEFAULT_MODEL,
    imageGenerationEnabled: env.ENABLE_IMAGE_GENERATION,
    ocrEnabled: env.OCR_ENABLED,
    videoEnabled: env.ENABLE_VIDEO,
    videoTranscodingEnabled: env.ENABLE_VIDEO_TRANSCODING,
    appCheckRequired: env.FIREBASE_APP_CHECK_REQUIRED,
    videoAppCheckRequired: env.VIDEO_REQUIRE_APP_CHECK,
  });
}
