"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/ai/aiErrorClassifier.ts
function classifyAiError(error) {
  const raw = typeof error === "string" ? error : JSON.stringify(error || {});
  const text = raw.toLowerCase();
  if (text.includes("prepayment credits are depleted") || text.includes("prepayment")) {
    const deployTarget = process.env.APP_DEPLOY_TARGET || "cloud_run";
    if (deployTarget === "cloud_run") {
      return {
        code: "AI_BILLING_EXHAUSTED",
        retryable: false,
        userMessage: "This request is still using API key / AI Studio prepay path. Check for direct new GoogleGenAI({ apiKey }) calls.",
        diagnostic: "This request is still using API key / AI Studio prepay path. Check for direct new GoogleGenAI({ apiKey }) calls."
      };
    }
    return {
      code: "AI_BILLING_EXHAUSTED",
      retryable: false,
      userMessage: "AI Studio Prepay credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. Vertex mode use \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF \u0DB1\u0DB8\u0DCA GEMINI_API_KEY remove \u0D9A\u0DBB\u0DBD\u0DCF service account client \u0D91\u0D9A \u0DB4\u0DB8\u0DAB\u0D9A\u0DCA use \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.",
      diagnostic: "This call is using Gemini API key / AI Studio Prepay path, not Vertex AI Cloud Billing path."
    };
  }
  if (text.includes("ai_billing_exhausted") || text.includes("resource_exhausted") || text.includes('"code":429') || text.includes("code:429") || text.includes("billing") || text.includes("quota")) {
    return {
      code: "AI_BILLING_EXHAUSTED",
      retryable: false,
      userMessage: "AI credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. Billing/credits update \u0D9A\u0DC5\u0DCF\u0DB8 \u0DB1\u0DD0\u0DC0\u0DAD PDF scan/AI answer \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA."
    };
  }
  if (text.includes("too many requests") || text.includes("rate limit")) {
    return {
      code: "AI_RATE_LIMITED",
      retryable: false,
      userMessage: "AI quota/rate limit hit \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. \u0DA7\u0DD2\u0D9A \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0D9A\u0DD2\u0DB1\u0DCA \u0DB1\u0DD0\u0DC0\u0DAD try \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1."
    };
  }
  return {
    code: "AI_MODEL_ERROR",
    retryable: true,
    userMessage: "AI model error \u0D91\u0D9A\u0D9A\u0DCA \u0DC0\u0DD4\u0DAB\u0DCF."
  };
}
var init_aiErrorClassifier = __esm({
  "server/ai/aiErrorClassifier.ts"() {
    "use strict";
  }
});

// server/ai/aiCircuitBreaker.ts
function isAiBillingCircuitOpen() {
  return Date.now() < aiBillingCircuitOpenUntil;
}
function getAiBillingState() {
  return {
    exhausted: isAiBillingCircuitOpen(),
    circuitOpenUntil: aiBillingCircuitOpenUntil,
    lastBillingError
  };
}
function openAiBillingCircuit(error) {
  aiBillingCircuitOpenUntil = Date.now() + 10 * 60 * 1e3;
  lastBillingError = {
    code: "AI_BILLING_EXHAUSTED",
    message: "Gemini billing/prepayment credits exhausted",
    at: Date.now(),
    raw: String(error?.message || error).slice(0, 500)
  };
}
function assertAiAvailable() {
  if (isAiBillingCircuitOpen()) {
    const err = new Error("AI billing exhausted");
    err.code = "AI_BILLING_EXHAUSTED";
    err.status = 429;
    err.userMessage = "AI credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF.";
    throw err;
  }
}
function checkAiBillingCircuit() {
  assertAiAvailable();
}
function handleAiError(err) {
  const classification = classifyAiError(err);
  if (classification.code === "AI_BILLING_EXHAUSTED") {
    openAiBillingCircuit(err);
    const e = new Error(classification.userMessage);
    e.code = "AI_BILLING_EXHAUSTED";
    e.status = 429;
    e.retryable = false;
    e.originalError = err;
    throw e;
  }
  return classification;
}
var aiBillingCircuitOpenUntil, lastBillingError;
var init_aiCircuitBreaker = __esm({
  "server/ai/aiCircuitBreaker.ts"() {
    "use strict";
    init_aiErrorClassifier();
    aiBillingCircuitOpenUntil = 0;
    lastBillingError = null;
  }
});

// server/utils/googleCredentials.ts
function configurationError(source, detail) {
  throw new GoogleCredentialConfigurationError(`${source}: ${detail}`);
}
function normalizePrivateKey(value) {
  return value.replace(/\\+n/g, "\n");
}
function validateServiceAccountObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return configurationError(source, "must contain one complete service-account JSON object");
  }
  const candidate = value;
  const projectId2 = typeof candidate.project_id === "string" ? candidate.project_id.trim() : "";
  const clientEmail = typeof candidate.client_email === "string" ? candidate.client_email.trim() : "";
  const privateKey = typeof candidate.private_key === "string" ? normalizePrivateKey(candidate.private_key) : "";
  if (!projectId2) configurationError(source, "is missing project_id");
  if (!clientEmail || !clientEmail.includes("@")) configurationError(source, "is missing a valid client_email");
  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    configurationError(source, "is missing a complete PEM private_key");
  }
  try {
    (0, import_node_crypto.createPrivateKey)(privateKey);
  } catch {
    configurationError(source, "private_key is not a valid PKCS#8 PEM key (it may be truncated or escaped incorrectly)");
  }
  if (candidate.type !== void 0 && candidate.type !== "service_account") {
    configurationError(source, "type must be service_account");
  }
  return {
    ...candidate,
    project_id: projectId2,
    client_email: clientEmail,
    private_key: privateKey
  };
}
function parseGoogleServiceAccountJson(rawValue, source = "GOOGLE_APPLICATION_CREDENTIALS_JSON") {
  const raw = rawValue.trim();
  if (!raw) configurationError(source, "is empty");
  if (/^(?:PASTE|REPLACE|YOUR)[_\s-]/i.test(raw) || /^<[^>]+>$/.test(raw)) {
    configurationError(source, "still contains a placeholder instead of service-account JSON");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
  } catch {
    return configurationError(
      source,
      "is not valid JSON; paste the entire downloaded file from the first { to the final }"
    );
  }
  return validateServiceAccountObject(parsed, source);
}
function getGoogleServiceAccountFromEnvironment(environment = process.env) {
  const jsonValue = environment.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (jsonValue) return parseGoogleServiceAccountJson(jsonValue);
  const projectId2 = environment.FIREBASE_PROJECT_ID?.trim() || environment.GOOGLE_CLOUD_PROJECT?.trim();
  const clientEmail = environment.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = environment.FIREBASE_PRIVATE_KEY?.trim();
  const hasAnySplitValue = Boolean(projectId2 || clientEmail || privateKey);
  if (!clientEmail && !privateKey) return null;
  if (!hasAnySplitValue || !projectId2 || !clientEmail || !privateKey) {
    return configurationError(
      "Firebase split credentials",
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must all be set"
    );
  }
  return validateServiceAccountObject({
    type: "service_account",
    project_id: projectId2,
    client_email: clientEmail,
    private_key: privateKey
  }, "Firebase split credentials");
}
function serializeGoogleServiceAccount(serviceAccount) {
  return JSON.stringify(serviceAccount);
}
function toFirebaseAdminServiceAccount(serviceAccount) {
  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key
  };
}
var import_node_crypto, GoogleCredentialConfigurationError;
var init_googleCredentials = __esm({
  "server/utils/googleCredentials.ts"() {
    "use strict";
    import_node_crypto = require("node:crypto");
    GoogleCredentialConfigurationError = class extends Error {
      code = "INVALID_GOOGLE_SERVICE_ACCOUNT";
      constructor(message) {
        super(message);
        this.name = "GoogleCredentialConfigurationError";
      }
    };
  }
});

// server/ai/client.ts
function shouldUseVertex() {
  const configuredMode = String(process.env.GEMINI_USE_VERTEX || "").trim().toLowerCase();
  if (configuredMode === "true") return true;
  if (configuredMode === "false") return false;
  return !process.env.GEMINI_API_KEY;
}
function isVertexAiEnabled() {
  return shouldUseVertex();
}
function prepareGoogleCredentials() {
  const serviceAccount = getGoogleServiceAccountFromEnvironment();
  if (serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = "/tmp/google-credentials.json";
    import_fs.default.writeFileSync(filePath, serializeGoogleServiceAccount(serviceAccount), { mode: 384 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
  }
}
function getAIClient() {
  let client2;
  if (cachedClient) {
    client2 = cachedClient;
  } else {
    prepareGoogleCredentials();
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const useVertex = shouldUseVertex();
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
    if (useVertex) {
      cachedClient = new import_genai.GoogleGenAI({
        vertexai: true,
        project,
        location
      });
    } else {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required when GEMINI_USE_VERTEX is not true");
      }
      cachedClient = new import_genai.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });
    }
    client2 = cachedClient;
  }
  if (!hasLoggedDiagnostics) {
    hasLoggedDiagnostics = true;
    const deployTarget = process.env.APP_DEPLOY_TARGET || "cloud_run";
    const useVertex = shouldUseVertex();
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const hasServiceAccountJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasGeminiApiKey = !!process.env.GEMINI_API_KEY;
    console.log(`[DEPLOY] target=${deployTarget}`);
    if (useVertex) {
      console.log(`[AI_CONFIG] mode=vertex`);
      console.log(`[AI_CONFIG] project=${project}`);
      console.log(`[AI_CONFIG] location=${location}`);
      console.log(`[AI_CONFIG] hasServiceAccountJson=${hasServiceAccountJson}`);
      console.log(`[AI_CONFIG] GEMINI_API_KEY ignored because GEMINI_USE_VERTEX=true`);
    } else {
      console.log(`[AI_CONFIG] mode=api_key`);
      console.log(`[AI_CONFIG] hasServiceAccountJson=${hasServiceAccountJson}`);
      console.log(`[AI_CONFIG] hasGeminiApiKey=true`);
    }
    const ttsEnabled = String(process.env.ENABLE_TTS || "").toLowerCase() === "true";
    console.log(`[AI_CONFIG] normal_chat=${process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash"}`);
    console.log(`[AI_CONFIG] pdfQa=${process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"}`);
    console.log(`[AI_CONFIG] final=${process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview"}`);
    console.log(`[AI_CONFIG] tts=${ttsEnabled}`);
  }
  return new Proxy(client2, {
    get(target, prop, receiver) {
      if (prop === "models") {
        const models = Reflect.get(target, prop, receiver);
        return new Proxy(models, {
          get(modelsTarget, modelsProp, modelsReceiver) {
            const originalVal = Reflect.get(modelsTarget, modelsProp, modelsReceiver);
            if (typeof originalVal === "function" && (modelsProp === "generateContent" || modelsProp === "generateContentStream")) {
              return async function(...args) {
                checkAiBillingCircuit();
                try {
                  return await originalVal.apply(modelsTarget, args);
                } catch (err) {
                  handleAiError(err);
                  throw err;
                }
              };
            }
            return originalVal;
          }
        });
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}
function getModelFallbackChain(requestedModel) {
  const chain = [];
  if (requestedModel) chain.push(requestedModel);
  chain.push(AI_MODELS.pro);
  chain.push("gemini-3.1-pro-preview");
  chain.push(AI_MODELS.default);
  chain.push("gemini-3.5-flash");
  return Array.from(new Set(chain)).filter(Boolean);
}
var import_fs, import_genai, cachedClient, hasLoggedDiagnostics, AI_MODELS;
var init_client = __esm({
  "server/ai/client.ts"() {
    "use strict";
    import_fs = __toESM(require("fs"), 1);
    import_genai = require("@google/genai");
    init_aiCircuitBreaker();
    init_googleCredentials();
    cachedClient = null;
    hasLoggedDiagnostics = false;
    AI_MODELS = {
      default: process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash",
      pro: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
      fast: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
      search: process.env.GEMINI_SEARCH_MODEL || "gemini-3.5-flash",
      urlContext: process.env.GEMINI_URL_CONTEXT_MODEL || "gemini-3.1-pro-preview",
      image: process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-001",
      imagePro: process.env.GEMINI_IMAGE_PRO_MODEL || "imagen-3.0-generate-001",
      pdf: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"
    };
  }
});

// server/utils/configuredRoles.ts
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function getConfiguredAdminEmails() {
  return new Set(
    [process.env.ADMIN_EMAILS, process.env.SYLLABUS_OWNER_EMAIL].filter(Boolean).join(",").split(",").map(normalizeEmail).filter(Boolean)
  );
}
function getConfiguredAdminUids() {
  return new Set(
    String(process.env.ADMIN_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean)
  );
}
function applyConfiguredAdminRoles(email, emailVerified, currentRoles, uid) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUid = typeof uid === "string" ? uid.trim() : "";
  const configuredByUid = normalizedUid.length > 0 && getConfiguredAdminUids().has(normalizedUid);
  const configuredByEmail = emailVerified && normalizedEmail.length > 0 && getConfiguredAdminEmails().has(normalizedEmail);
  const isConfiguredAdmin = configuredByUid || configuredByEmail;
  if (!isConfiguredAdmin) {
    return [...new Set(currentRoles)];
  }
  return [.../* @__PURE__ */ new Set([...currentRoles, ...PRIVILEGED_ROLES])];
}
var PRIVILEGED_ROLES;
var init_configuredRoles = __esm({
  "server/utils/configuredRoles.ts"() {
    "use strict";
    PRIVILEGED_ROLES = ["admin", "content_editor", "ops", "reviewer"];
  }
});

// server/firebase/admin.ts
var admin_exports = {};
__export(admin_exports, {
  getAdminApp: () => getAdminApp,
  getAdminAuth: () => getAdminAuth,
  getAdminBucket: () => getAdminBucket,
  getAdminBucketByName: () => getAdminBucketByName,
  getAdminDb: () => getAdminDb,
  getAdminDbInfo: () => getAdminDbInfo,
  getAdminStorage: () => getAdminStorage,
  getGoogleAccessToken: () => getGoogleAccessToken,
  requireAdmin: () => requireAdmin,
  requireUser: () => requireUser,
  verifyFirebaseToken: () => verifyFirebaseToken
});
function ensureCredentialInfo() {
  if (credentialInfo) return;
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const environmentCredential = getGoogleServiceAccountFromEnvironment();
  if (environmentCredential) {
    credentialInfo = {
      credentialMode: raw ? "service_account_json" : "service_account_split",
      credentialsEmail: environmentCredential.client_email,
      hasPrivateKey: true
    };
    return;
  }
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath && import_node_fs.default.existsSync(filePath)) {
    try {
      const parsed = parseGoogleServiceAccountJson(
        import_node_fs.default.readFileSync(filePath, "utf8"),
        "GOOGLE_APPLICATION_CREDENTIALS file"
      );
      credentialInfo = {
        credentialMode: "service_account_file",
        credentialsEmail: parsed.client_email,
        hasPrivateKey: true
      };
      return;
    } catch (e) {
      console.error("ensureCredentialInfo: Failed to parse GOOGLE_APPLICATION_CREDENTIALS file", e);
    }
  }
  credentialInfo = {
    credentialMode: "application_default",
    credentialsEmail: "unknown_adc",
    hasPrivateKey: false
  };
}
function loadCredential() {
  ensureCredentialInfo();
  const environmentCredential = getGoogleServiceAccountFromEnvironment();
  if (environmentCredential) return (0, import_app.cert)(toFirebaseAdminServiceAccount(environmentCredential));
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath && import_node_fs.default.existsSync(filePath)) {
    try {
      const parsed = parseGoogleServiceAccountJson(
        import_node_fs.default.readFileSync(filePath, "utf8"),
        "GOOGLE_APPLICATION_CREDENTIALS file"
      );
      return (0, import_app.cert)(toFirebaseAdminServiceAccount(parsed));
    } catch (e) {
      console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS file in loadCredential:", e.message);
    }
  }
  return (0, import_app.applicationDefault)();
}
function getAdminApp() {
  if (cachedApp) return cachedApp;
  if (!adminEnabled) {
    return null;
  }
  const projectId2 = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "al-ai-chat";
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "al-ai-chat.firebasestorage.app";
  try {
    cachedApp = (0, import_app.getApps)()[0] || (0, import_app.initializeApp)({
      credential: loadCredential(),
      projectId: projectId2,
      storageBucket
    });
    return cachedApp;
  } catch (e) {
    adminEnabled = false;
    initError = e;
    console.warn("[FIREBASE_ADMIN] Safe bypass: Firebase Admin initialization failed. Disabling admin features. Error:", e.message);
    return null;
  }
}
function getAdminDb() {
  if (cachedDb) return cachedDb;
  const app2 = getAdminApp();
  if (!app2) {
    throw new Error("ADMIN_FEATURE_DISABLED_IN_APPLET_SHARE");
  }
  let databaseId2 = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID;
  if (!databaseId2) {
    try {
      const configPath = import_node_path.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_node_fs.default.existsSync(configPath)) {
        const config = JSON.parse(import_node_fs.default.readFileSync(configPath, "utf-8"));
        databaseId2 = config.firestoreDatabaseId;
      }
    } catch (e) {
      console.warn("Failed to load firestoreDatabaseId from firebase-applet-config.json:", e);
    }
  }
  if (!databaseId2) {
    throw new Error("CONFIG_ERROR_FIRESTORE_DATABASE_ID_MISSING");
  }
  cachedDb = (0, import_firestore.getFirestore)(app2, databaseId2);
  return cachedDb;
}
function getAdminStorage() {
  const app2 = getAdminApp();
  if (!app2) {
    throw new Error("ADMIN_FEATURE_DISABLED_IN_APPLET_SHARE");
  }
  return (0, import_storage.getStorage)(app2);
}
function getAdminBucket() {
  if (cachedBucket) return cachedBucket;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "al-ai-chat.firebasestorage.app";
  cachedBucket = getAdminStorage().bucket(storageBucket);
  return cachedBucket;
}
function getAdminBucketByName(bucketName) {
  if (!bucketName) throw new Error("CONFIG_ERROR_STORAGE_BUCKET_MISSING");
  return getAdminStorage().bucket(bucketName.replace(/^gs:\/\//, ""));
}
async function getGoogleAccessToken() {
  const app2 = getAdminApp();
  const credential = app2?.options?.credential;
  if (!credential || typeof credential.getAccessToken !== "function") {
    throw new Error("GOOGLE_APPLICATION_CREDENTIAL_UNAVAILABLE");
  }
  const result = await credential.getAccessToken();
  if (!result?.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_UNAVAILABLE");
  return result.access_token;
}
function getAdminAuth() {
  const app2 = getAdminApp();
  if (!app2) {
    throw new Error("ADMIN_FEATURE_DISABLED_IN_APPLET_SHARE");
  }
  return (0, import_auth.getAuth)(app2);
}
function getAdminDbInfo() {
  ensureCredentialInfo();
  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat",
    databaseId: process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || null,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "al-ai-chat.firebasestorage.app",
    credentialMode: credentialInfo?.credentialMode || "not_initialized",
    credentialsEmail: credentialInfo?.credentialsEmail || "unknown",
    hasPrivateKey: credentialInfo?.hasPrivateKey === true,
    envPresent: {
      GOOGLE_APPLICATION_CREDENTIALS_JSON: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      FIRESTORE_DATABASE_ID: !!process.env.FIRESTORE_DATABASE_ID,
      FIREBASE_STORAGE_BUCKET: !!process.env.FIREBASE_STORAGE_BUCKET
    }
  };
}
async function verifyFirebaseToken(authHeader) {
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    return { uid: "dev-user-id", email: "dev@example.com", name: "Dev User", admin: true, roles: ["admin"] };
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or invalid Authorization header");
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    let admin = decodedToken.admin || false;
    let roles = ["student"];
    if (admin) {
      roles.push("admin", "reviewer", "ops");
    }
    if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
      roles = [.../* @__PURE__ */ new Set([...roles, ...decodedToken.roles])];
    }
    if (decodedToken.role && typeof decodedToken.role === "string") {
      roles.push(decodedToken.role);
    }
    try {
      const db = getAdminDb();
      const roleDoc = await db.collection("user_roles").doc(decodedToken.uid).get();
      if (roleDoc.exists) {
        const data = roleDoc.data();
        if (data?.roles && Array.isArray(data.roles)) {
          roles = [.../* @__PURE__ */ new Set([...roles, ...data.roles])];
        }
        if (data?.role && typeof data.role === "string") {
          roles.push(data.role);
        }
      }
    } catch (e) {
    }
    roles = applyConfiguredAdminRoles(
      decodedToken.email,
      decodedToken.email_verified === true,
      roles,
      decodedToken.uid
    );
    if (roles.includes("admin")) {
      admin = true;
    }
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split("@")[0] || "User",
      admin,
      roles: [...new Set(roles)]
    };
  } catch (error) {
    throw new Error("Unauthorized: Invalid token");
  }
}
async function requireUser(req) {
  return await verifyFirebaseToken(req.headers.authorization);
}
async function requireAdmin(req) {
  const user = await requireUser(req);
  const canManageContent = user.admin || user.roles?.includes("content_editor") || user.roles?.includes("ops");
  if (!canManageContent && process.env.DEV_BYPASS_AUTH !== "true") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
var import_app, import_firestore, import_storage, import_auth, import_node_fs, import_node_path, cachedApp, cachedDb, cachedBucket, credentialInfo, adminEnabled, initError;
var init_admin = __esm({
  "server/firebase/admin.ts"() {
    "use strict";
    import_app = require("firebase-admin/app");
    import_firestore = require("firebase-admin/firestore");
    import_storage = require("firebase-admin/storage");
    import_auth = require("firebase-admin/auth");
    import_node_fs = __toESM(require("node:fs"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    init_configuredRoles();
    init_googleCredentials();
    cachedApp = null;
    cachedDb = null;
    cachedBucket = null;
    credentialInfo = null;
    adminEnabled = true;
    initError = null;
  }
});

// server/ai/answerFormatPolicy.ts
function getAnswerFormatPolicyPrompt(intent) {
  const commonRules = `
Global Policies:
- Do not use a persona name or repeatedly address the user by name.
- Do NOT invent marks, progress, or claims about what they scored unless current verified profile data is explicitly requested.
- Do NOT say they got 49 marks or invent fake statistics.
- Do NOT launch an unsolicited "Ranker Challenge" unless they explicitly ask for a quiz or practice.
- Do NOT offer a daily tracker unless they ask about a schedule, plan, or progress.
- Do NOT invent a fake marking scheme claim.
- Write naturally in Sinhala (or the user's preferred language/mix).
- Keep one idea per short paragraph. Use headings only when they make the answer easier to scan.
- Do not force a fixed template or print an empty section.
  `;
  switch (intent) {
    case "calculation":
      return `
Explain the calculation in a compact sequence: known values, formula, substitution, and final answer. Use short labels only when needed and show each mathematical step on its own line.
${commonRules}
      `;
    case "official_paper":
      return `
Answer directly from the exact paper evidence. Include the source and answer status, then the answer and a concise explanation. Add marking points or warnings only when they are supported and useful.
${commonRules}
      `;
    case "lesson_explanation":
      return `
Explain the concept with a simple opening, then the minimum key points needed to understand it. Add an exam-style note or one check question only when it helps the user's request.
${commonRules}
      `;
    case "student_support":
      return `
You are supporting a student's study plan or motivation.
- Be highly supportive and motivating.
- Provide a concrete "next 20-minute action" they can take right now.
- Do NOT fabricate or list fake GCS/PDF sources.
${commonRules}
      `;
    case "developer_debug":
      return `
Give the root cause first, followed by the practical fix and a short verification step. Use headings only for a multi-part debugging answer.
${commonRules}
      `;
    case "quick_question":
      return `
Give the answer first, followed by a short, crisp explanation. Maximum 350 words total.
${commonRules}
      `;
    case "simple_chat":
    default:
      return `
Provide a direct Sinhala answer in 2 to 6 short, easy-to-read paragraphs.
- Do NOT use headings unless absolutely necessary.
- Do NOT include GCS/PDF sources.
${commonRules}
      `;
  }
}
var init_answerFormatPolicy = __esm({
  "server/ai/answerFormatPolicy.ts"() {
    "use strict";
  }
});

// server/ai/prompts.ts
function getCloraSystemPrompt(contextData, mode) {
  const dynamicFormatRules = getAnswerFormatPolicyPrompt(mode);
  return `
You are Clora X, a Sinhala-first Sri Lankan G.C.E. A/L Technology AI tutor and study OS for SFT, ET, ICT.

You are the user's ultimate study partner and guide. You are NOT a generic chatbot. You must ALWAYS use project data, user progress, and the RAG/exam databases before asking the user to type/upload/photo.

SEARCH ORDER FOR PAPER/QUESTION/PDF REQUESTS:
1. Past Papers DB
2. Paper Structure DB
3. Syllabus Library
4. user uploaded PDFs (rag_sources)
5. rag_chunks
6. user syllabus_resources
7. user syllabus_chunks
8. local pastPapersData.ts
9. src/constants/syllabus.ts
10. Google Search / web PDF search (Candidates)

EVIDENCE HONESTY:
- Never invent a question, answer, paper title, rank, date, link, source, or statistic.
- If exact evidence is missing, say what is missing in one short Sinhala sentence and give the best grounded next action.
- Do not replace a missing source with a generic answer that sounds source-backed.

NEVER SAY:
- "\u0DB8\u0DA7 \u0D9A\u0DD9\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 PDF links \u0DBD\u0DB6\u0DCF \u0DAF\u0DD3\u0DB8\u0DA7 \u0DC4\u0DD0\u0D9A\u0DD2\u0DBA\u0DCF\u0DC0\u0D9A\u0DCA \u0DB1\u0DD0\u0DC4\u0DD0"
Instead, you must return actual source cards or markdown links when they are backed by local PDFs, Firebase Storage, Firestore, verified PDF URLs, or candidate web sources. Never hallucinate fake links. Label unverified web sources clearly as [Candidate].

PDF DOWNLOAD & PRIVATE STORAGE RULES:
- Never hallucinate "Download Here" links or storage bucket URIs (like gs://...) for user-uploaded or private Firebase Storage PDFs.
- Only provide download links if they are exact verified URLs or local proxy download routes (/api/rag/sources/{sourceId}/download or /api/syllabus/resources/{sourceId}/download) resolved in the context.
- If a document does not have a verified download URL in the resolved context, explain clearly in Sinhala that it requires secure authenticated access to view.

IF NO LOCAL SOURCE EXISTS:
- Search the web for candidate PDF/source.
- Present candidate sources.
- Ask: "\u0DB8\u0DDA\u0D9A\u0DAF \u0DC4\u0DBB\u0DD2 PDF \u0D91\u0D9A? Confirm \u0D9A\u0DC5\u0DDC\u0DAD\u0DCA \u0DB8\u0DB8 Firebase \u0D91\u0D9A\u0DA7 save/index \u0D9A\u0DBB\u0DBD\u0DCF answer \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DB8\u0DCA."
- Only ask the user to upload/type/photo if web search also fails or the user rejects all candidates.

FOR ANSWERS (SUBJECTS, PAPERS, QUESTIONS):
- Identify the subject (SFT, ET, ICT).
- Identify the lesson or subtopic.
- Use the relevant subject syllabus PDF/chunks first.
- Use the official marking scheme if available.
- If the marking scheme is unavailable, search/import it, or label the answer clearly as "Estimated".
- Give exam-style answers with exact marks allocation (e.g., "point 1 - 1 mark") and highlight common student mistakes.
- Maintain a Sinhala-first explanation style.

FOR Z-SCORE & RANK ANALYSIS:
- Use the Exam Score Predictor values from userContext.
- Label Z-score and district/island rank values as "Exam Score Predictor estimate"; never call them official results.
- Explain that the model is driven by saved syllabus progress and uses restored rank-model anchors.
- Never replace the supplied estimate with invented cohort statistics.

FOR LESSON MARKS & WEIGHTING:
- Use the Paper Structure DB first.
- Use the fallback static structure (from src/constants/syllabus.ts) if DB is empty.
- Show MCQ count, structured/essay relation, max marks, optional/compulsory status, and Z-score impact priority.

USER CONTEXT (REAL DATA):
- Student Name: ${contextData?.profile?.name || "Unknown Student"}
- Stream: ${contextData?.profile?.stream || "Technology"}
- Active Subject: ${contextData?.activeSubject || ""}
- Current Time (Colombo): ${contextData?.currentTimeAsiaColombo || ""}

STUDENT EXAM SCORE PREDICTOR CONTEXT:
- Target Z-score: ${contextData?.zScoreContext?.targetZScore ?? contextData?.targetZ ?? "Not set"}
- Predictor Z estimate: ${contextData?.zScoreContext?.latestOverallZScore ?? "Not available"}
- Gap to target: ${contextData?.zScoreContext?.gapToTarget ?? "Not set"}
- Projected marks: ${contextData?.zScoreContext?.projectedMarks ? JSON.stringify(contextData.zScoreContext.projectedMarks) : "Not available"}
- Predictor subject estimates (SFT, ET, ICT): ${contextData?.zScoreContext?.subjectZScores ? JSON.stringify(contextData.zScoreContext.subjectZScores) : "Not available"}
- Estimated ranks: ${contextData?.zScoreContext?.rankEstimate ? JSON.stringify(contextData.zScoreContext.rankEstimate) : "Not available"}
- History count: ${contextData?.zScoreContext?.zScoreHistory?.length ?? 0}

WEAK LESSONS: ${JSON.stringify(contextData?.weakLessons?.map((w) => ({ subject: w.subject, topic: w.topic, reason: w.reason })) || [])}
RECENT PROGRESS: ${JSON.stringify(contextData?.recentProgress?.slice(0, 3) || [])}
LATEST MARKS: ${JSON.stringify(contextData?.latestMarks?.slice(0, 3) || [])}
AI MEMORY: ${JSON.stringify(contextData?.aiMemory || [])}
RECENT MISTAKES: ${JSON.stringify((contextData?.recentMistakes || []).slice(0, 8).map((m) => ({ subject: m.subject, lesson: m.lesson, errorText: m.errorText || m.questionText, hasImage: Boolean(m.imageStoragePath), createdAt: m.createdAt })))}

MISTAKE NOTEBOOK RULES:
- When the user asks about recent mistakes, diagnosis, revision, or a quiz, use RECENT MISTAKES as the primary evidence.
- If a saved mistake image is attached to the current model request, inspect it and connect the explanation to its saved subject and lesson.
- Never invent the content of a missing or unreadable mistake image.

WRITING STYLE:
- Use natural conversational Sinhala with the English technical terms students see in class.
- Answer directly. Do not introduce yourself, name a persona, repeat the user's name, or use motivational filler in every response.
- Use short paragraphs. Keep one idea per paragraph and leave a blank line between paragraphs.
- Use a heading only when it makes a multi-part answer easier to scan. Never force a fixed answer template onto ordinary chat.
- Prefer concise bullets for options, steps, source lists, marks, and comparisons.
- Explain from first principles only when the question needs it or the user asks for detail.
- Ask at most one useful follow-up question.

RESPONSE ARCHITECTURE (DYNAMIC, INTENT-BASED FORMATTING):
${dynamicFormatRules}

Format your answer naturally, elegantly, and concisely based on the user's explicit intent. Never show fake progress counters, fake island/district rank updates, or simulated database telemetry.

MATH OUTPUT RULES

1. Use Markdown with KaTeX-compatible LaTeX only.

2. Inline mathematics must use:
   $F = 100,mathrm{N}$

3. Display mathematics must use separate-line delimiters:

   $
   sigma = \frac{F}{A}
   $

4. Never output raw LaTeX commands outside math delimiters.

Incorrect:
	ext{Stress} = \frac{F}{A}

Correct:
$
sigma = \frac{F}{A}
$

5. Always use:
   	imes
Never output:
   times
   xtimes
   2times10

6. Write powers using braces:
   10^{-6}
   mathrm{m^2}
   mathrm{N,m^{-2}}

7. Never place individual formula symbols on separate lines.

Incorrect:
F
F

Correct:
$F$

8. Never repeat a variable or equation in both plain text and LaTeX.

9. Use mathrm{} for SI units:
   $100,mathrm{N}$
   $2 	imes 10^{-6},mathrm{m^2}$
   $5 	imes 10^7,mathrm{N,m^{-2}}$

10. Keep complete equations inside one math block.

11. Do not use HTML for formulas.

12. If valid LaTeX cannot be produced, use readable Unicode plain text,
such as:
   5 \xD7 10\u2077 N m\u207B\xB2
Do not output malformed LaTeX.

VISUAL POLICY:
- Default: no visual blocks.
- Never output raw JSON visual_block/formula_card/table JSON in final text.
- Use normal Markdown and LaTeX only.
- Visuals are allowed only when:
  user asks "diagram", "graph", "visual", "draw", "waguwa", "table"
  OR the answer truly needs a formula/table.
- For official paper answers, visuals are disabled unless explicitly requested.
- Visual blocks must be generated by backend structured event only, not by the model text.

CRITICAL UPLOADED PDF RULES:
- If hasExactQuestionText is false, inform the user clearly in Sinhala that the requested Q1/question is not found in the uploaded document. Do NOT generate a fake essay/MCQ question unless the user explicitly requested a model/mock question.
- Never output the actual answer text or explanation inside '<thought_process>' or 'Thought Process' blocks. All final answer text must be in the main body of the response.

Do not reveal hidden reasoning or internal systems.

=========================================
STRICT AI ROUTED MODE SPECIFIC CONTEXT:
=========================================
${(() => {
    switch (mode) {
      case "zscore_prediction":
        return `
MODE: Z-score Calculation / Prediction Context
- Focus strictly on predicting and calculating the user's estimated and target Z-score.
- Explain the standardization process (how raw marks are standardized across SFT, ET, and ICT).
- Emphasize how raw score changes will affect their district or island rank.
- Highlight the target raw marks necessary to bridge the current Z-score gap to their target university courses (e.g., Engineering Technology, Biosystems Technology, or ICT at USJ, MRT, etc.).
- Suggest concrete micro-marks goals for SFT, ET, and ICT to hit their target.
`;
      case "paper_question_qa":
        return `
MODE: Official Paper Question Q&A (Strict Evidence Mode)
- Your goal is to provide the EXACT official answer for the requested G.C.E. A/L paper question.
- DO NOT provide "Estimated" or "Progress-based" answers. 
- DO NOT reference the user's weaknesses or progress in your answer.
- REQUIRE exact source evidence (official marking scheme or clear paper text).
- If the marking scheme or official answer is not found in the provided context, state clearly in Sinhala that the official evidence is missing and you cannot provide a confirmed answer.
- DO NOT generate visual_block (coordinate_plane/scratch_steps) for official paper answers unless explicitly requested by the user.
- RULE: Do not output raw JSON. Do not output visual_block JSON. Do not output formula_card JSON. Do not output tables as JSON. Use plain Sinhala explanation and markdown only.
- Never output HTML tags such as <details> or <summary>. Use Markdown headings and lists only.
- For official paper answers, include the exact source and answer status, then present the question, answer, and explanation in the shortest clear structure. Do not print empty sections.
  Never include: { "visual_block": ... }.
- Focus strictly on the question text and official marking criteria.
`;
      case "study_plan":
      case "today_plan":
        return `
MODE: Study Planning Context
- Focus on building an ultra-personalized, structured daily calendar and revision schedule.
- Rationally divide remaining days/hours for SFT, ET, and ICT based on the student's current progress and documented weak lessons.
- Provide step-by-step revision micro-targets and days-left-based checklists.
- Maintain high-encouragement, task-driven tone to keep the student focused.
`;
      case "past_paper_analysis":
        return `
MODE: Past Paper Exam Analysis Context
- Focus heavily on statistical topic frequencies, recurring G.C.E. A/L exam trends, and structural weight distribution.
- Identify which lessons are most critical for MCQ (25 questions in SFT), Structured (4 questions), and Essay (compulsory vs. optional).
- Analyze probability of certain concepts/questions reappearing.
- Point out standard examiners' traps and highlight exactly where students typically lose easy marks.
`;
      case "notes_generation":
        return `
MODE: Short Notes & Revision Notes Generation Context
- Deliver clean, structured revision summaries of high-yield G.C.E. A/L Tech subject units.
- Always include: Definition, Core Formulas/Principles, bulleted Key points, and memorable Mnemonics/Triggers.
- Ensure all technical terms are clearly written in English with standard Sinhala descriptions.
- Where appropriate, encourage the use of LaTeX equations and clean visual markdown blocks.
`;
      case "tutor_explanation":
        return `
MODE: Tutor Explanation Context (Legendary A/L Master Teacher - "0 indan igannuwa wage")
- Act as a legendary Sri Lankan G.C.E. A/L master teacher who can explain anything to a student starting from absolute zero ("0 indan igannuwa wage").
- Start with the basic physical/mathematical foundation. Detail *why* we take each step (e.g. "We resolve forces perpendicular to force $P$ because $P$'s component in that direction is $P cos(90^circ) = 0$, which instantly eliminates $P$ and lets us solve for $R$ and $Q$ directly!").
- Use extremely intuitive, relatable household/practical analogies to deconstruct complex SFT, ET, or ICT concepts.
- Show every single mathematical step and substitution clearly (e.g. step-by-step substitution of $sin(30^circ) = \frac{1}{2}$). Never skip steps or jump to the final answer.
- Ensure ALL equations, variables, k\u0DDD\u0DAB (angles), fractions, and ratios (e.g., $R:Q = 1:2$) are strictly wrapped in LaTeX ($...$ and $$...$$).
- Highlight examiner traps, syllabus alignment, and where students usually lose easy marks in exams.
`;
      default:
        return `
MODE: General Chat / Contextual Chat
- Maintain helpful, high-context study assistance across SFT, ET, and ICT.
- Reference user progress and weaknesses naturally.
`;
    }
  })()}

Current Mode: ${mode}
`;
}
var init_prompts = __esm({
  "server/ai/prompts.ts"() {
    "use strict";
    init_answerFormatPolicy();
  }
});

// server/ai-core/answer/stripVisualBlocks.ts
function stripRawVisualBlocks(text) {
  if (!text) return text;
  let output = text;
  output = output.replace(/```(?:json)?\s*{\s*"visual_block"[\s\S]*?}\s*```/gi, "");
  output = output.replace(/\{\s*"visual_block"\s*:\s*\{[\s\S]*?\n?\}\s*\}/gi, "");
  output = output.replace(/\{\s*"visual_block"[\s\S]*?(?=\n\n|$)/gi, "");
  output = output.replace(/"type"\s*:\s*"formula_card"[\s\S]*?(?=\n\n|$)/gi, "");
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  return output;
}
var init_stripVisualBlocks = __esm({
  "server/ai-core/answer/stripVisualBlocks.ts"() {
    "use strict";
  }
});

// server/data/userRepository.ts
async function syncUserFromFirestore(email) {
  if (!email || !email.includes("@") || !apiKey) return;
  const cleanEmail = email.trim().toLowerCase();
  const file = getUserFile(cleanEmail);
  if (import_fs2.default.existsSync(file)) {
    try {
      const data = import_fs2.default.readFileSync(file);
      const unzipped = import_zlib.default.gunzipSync(data).toString("utf-8");
      if (unzipped.length > 0) return;
    } catch (e) {
      console.warn("Local file is corrupted, re-syncing from Firestore:", file);
      import_fs2.default.unlinkSync(file);
    }
  }
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/backups/${encodeURIComponent(cleanEmail)}?key=${apiKey}`;
    const res = await fetch(url);
    if (res.status === 200) {
      const data = await res.json();
      const userDataEncrypted = data?.fields?.userData?.stringValue;
      if (userDataEncrypted) {
        const zipped = import_zlib.default.gzipSync(userDataEncrypted);
        import_fs2.default.writeFileSync(file, zipped);
        console.log(`Successfully restored user ${cleanEmail} from Firestore REST backup to local disk.`);
      }
    }
  } catch (err) {
    console.error(`Failed to restore user ${cleanEmail} from Firestore REST:`, err);
  }
}
function decrypt(text) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = import_crypto.default.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}
function getUserFile(email) {
  const cleanEmail = email.trim().toLowerCase();
  const hash = import_crypto.default.createHash("md5").update(cleanEmail).digest("hex");
  return import_path.default.join(DB_DIR, `${hash}.json.gz`);
}
function readUser(email) {
  const file = getUserFile(email);
  if (!import_fs2.default.existsSync(file)) {
    return { data: null, history: [], cookies: null, profile: null, notifications: [] };
  }
  try {
    const raw = import_fs2.default.readFileSync(file);
    const unzipped = import_zlib.default.gunzipSync(raw).toString("utf-8");
    let jsonStr = unzipped;
    if (!jsonStr.startsWith("{")) {
      jsonStr = decrypt(jsonStr);
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return { data: null, history: [], cookies: null, profile: null, notifications: [] };
  }
}
var import_fs2, import_path, import_crypto, import_zlib, isVercel, DB_DIR, rawKey, ENCRYPTION_KEY, SOURCE_DIR, projectId, databaseId, apiKey;
var init_userRepository = __esm({
  "server/data/userRepository.ts"() {
    "use strict";
    import_fs2 = __toESM(require("fs"), 1);
    import_path = __toESM(require("path"), 1);
    import_crypto = __toESM(require("crypto"), 1);
    import_zlib = __toESM(require("zlib"), 1);
    isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV || process.env.VERCEL_URL;
    DB_DIR = isVercel ? "/tmp/data_users" : import_path.default.join(process.cwd(), "data_users");
    rawKey = process.env.ENCRYPTION_KEY || "default_encryption_key_32_chars!";
    if (rawKey.length > 32) rawKey = rawKey.substring(0, 32);
    if (rawKey.length < 32) rawKey = rawKey.padEnd(32, "0");
    ENCRYPTION_KEY = rawKey;
    try {
      if (!import_fs2.default.existsSync(DB_DIR)) import_fs2.default.mkdirSync(DB_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create DB_DIR, using /tmp fallback", e);
      DB_DIR = "/tmp/data_users";
      if (!import_fs2.default.existsSync(DB_DIR)) import_fs2.default.mkdirSync(DB_DIR, { recursive: true });
    }
    SOURCE_DIR = import_path.default.join(process.cwd(), "data_users");
    if (isVercel && import_fs2.default.existsSync(SOURCE_DIR)) {
      try {
        const files = import_fs2.default.readdirSync(SOURCE_DIR);
        for (const file of files) {
          if (file.endsWith(".json.gz")) {
            const srcPath = import_path.default.join(SOURCE_DIR, file);
            const destPath = import_path.default.join(DB_DIR, file);
            if (!import_fs2.default.existsSync(destPath)) {
              import_fs2.default.copyFileSync(srcPath, destPath);
            }
          }
        }
        console.log("Successfully seeded pre-existing user data on Vercel.");
      } catch (err) {
        console.error("Failed to seed pre-existing user data:", err);
      }
    }
    projectId = "al-ai-chat";
    databaseId = "ai-studio-c097068e-a4a9-4ea3-9b00-0b3195093c42";
    apiKey = "";
    try {
      const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs2.default.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(import_fs2.default.readFileSync(configPath, "utf-8"));
        projectId = firebaseConfig.projectId || projectId;
        databaseId = firebaseConfig.firestoreDatabaseId || databaseId;
        apiKey = firebaseConfig.apiKey || "";
      }
    } catch (e) {
      console.warn("Failed to load firebase-applet-config.json for REST client:", e);
    }
  }
});

// src/constants/syllabus.ts
var SYLLABUS;
var init_syllabus = __esm({
  "src/constants/syllabus.ts"() {
    "use strict";
    SYLLABUS = {
      sft: {
        mcqMax: 50,
        mcqMult: 1,
        mcqItems: [
          { q: "Q1-5", title: "\u0DC3\u0DDB\u0DBD (\u0D9A\u0DCA\u0DC2\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DA2\u0DD3\u0DC0 \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0 \u0D87\u0DAD\u0DD4\u0DC5\u0DD4\u0DC0)", count: 5 },
          { q: "Q6-7", title: "\u0DA2\u0DDB\u0DC0\u0DCF\u0DAB\u0DD4", count: 2 },
          { q: "Q8", title: "\u0DAD\u0DCF\u0DB4 \u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DBA", count: 1 },
          { q: "Q9", title: "\u0DA0\u0DCF\u0DBD\u0D9A \u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DBA", count: 1 },
          { q: "Q10-11", title: "\u0DB6\u0DC4\u0DD4\u0D85\u0DC0\u0DBA\u0DC0\u0DD2\u0D9A", count: 2 },
          { q: "Q12-13", title: "\u0DC3\u0DCA\u0DC0\u0DB7\u0DCF\u0DC0\u0DD2\u0D9A \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1", count: 2 },
          { q: "Q14-15", title: "\u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DD2\u0D9A \u0D9A\u0DBB\u0DCA\u0DB8\u0DCF\u0DB1\u0DCA\u0DAD", count: 2 },
          { q: "Q16-17", title: "\u0DB4\u0DBB\u0DD2\u0DC3\u0DBB\u0DBA", count: 2 },
          { q: "Q18", title: "\u0DB8\u0DD2\u0DB1\u0DD4\u0DB8\u0DCA \u0D8B\u0DB4\u0D9A\u0DBB\u0DAB", count: 1 },
          { q: "Q19-21", title: "\u0DC0\u0DBB\u0DCA\u0D9C\u0DB5\u0DBD\u0DBA \u0DC4\u0DCF \u0DB4\u0DBB\u0DD2\u0DB8\u0DCF\u0DC0", count: 3 },
          { q: "Q22-23", title: "\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DDD\u0DAB\u0DB8\u0DD2\u0DAD\u0DD2\u0DBA", count: 2 },
          { q: "Q24-25", title: "\u0D9B\u0DAB\u0DCA\u0DA9\u0DCF\u0D82\u0D9A \u0DA2\u0DCA\u200D\u0DBA\u0DCF\u0DB8\u0DD2\u0DAD\u0DD2\u0DBA", count: 2 },
          { q: "Q26-28", title: "\u0DC3\u0D82\u0D9B\u0DCA\u200D\u0DBA\u0DCF\u0DB1\u0DBA", count: 3 },
          { q: "Q29-36", title: "ICT (\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA)", count: 8 },
          { q: "Q37-39", title: "\u0DA0\u0DBD\u0DD2\u0DAD\u0DBA", count: 3 },
          { q: "Q40-41", title: "\u0DB6\u0DBD\u0DBA", count: 2 },
          { q: "Q42", title: "\u0DBA\u0DCF\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A \u0DC1\u0D9A\u0DCA\u0DAD\u0DD2\u0DBA", count: 1 },
          { q: "Q43-44", title: "\u0DB4\u0DAF\u0DCF\u0DBB\u0DCA\u0DAE\u0DBA\u0DDA \u0DBA\u0DCF\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A \u0D9C\u0DD4\u0DAB", count: 2 },
          { q: "Q45-46", title: "\u0DAD\u0DBB\u0DBD", count: 2 },
          { q: "Q47-48", title: "\u0DAD\u0DCF\u0DB4\u0DBA", count: 2 },
          { q: "Q49-50", title: "\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DD4\u0DAD\u0DBA", count: 2 }
        ],
        partAMax: 400,
        partAItems: [
          { q: "Q1", title: "Q1", subTitle: "\u0DA2\u0DD3\u0DC0 \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0", max: 100, topics: ["\u0DC3\u0DDB\u0DBD (\u0D9A\u0DCA\u0DC2\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DA2\u0DD3\u0DC0 \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0 \u0D87\u0DAD\u0DD4\u0DC5\u0DD4\u0DC0)", "\u0DA2\u0DDB\u0DC0\u0DCF\u0DAB\u0DD4"] },
          { q: "Q2", title: "Q2", subTitle: "\u0DBB\u0DC3\u0DCF\u0DBA\u0DB1 \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0", max: 100, topics: ["\u0DB6\u0DC4\u0DD4\u0D85\u0DC0\u0DBA\u0DC0\u0DD2\u0D9A", "\u0DA0\u0DCF\u0DBD\u0D9A \u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DBA", "\u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DD2\u0D9A \u0D9A\u0DBB\u0DCA\u0DB8\u0DCF\u0DB1\u0DCA\u0DAD"] },
          { q: "Q3", title: "Q3", subTitle: "\u0DB8\u0DD2\u0DC1\u0DCA\u200D\u0DBB \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA", max: 100, topics: ["\u0DB8\u0DD2\u0DB1\u0DD4\u0DB8\u0DCA \u0D8B\u0DB4\u0D9A\u0DBB\u0DAB", "\u0DAD\u0DBB\u0DBD", "\u0DAD\u0DCF\u0DB4\u0DBA", "\u0DAD\u0DCF\u0DB4 \u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DBA", "\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DD4\u0DAD\u0DBA"] },
          { q: "Q4", title: "Q4", subTitle: "\u0DB7\u0DDE\u0DAD\u0DD2\u0D9A \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0", max: 100, topics: ["\u0DB6\u0DBD\u0DBA", "\u0DA0\u0DBD\u0DD2\u0DAD\u0DBA", "\u0DBA\u0DCF\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A \u0DC1\u0D9A\u0DCA\u0DAD\u0DD2\u0DBA"] }
        ],
        partBCDMax: 600,
        partBCDItems: [],
        bcdGroups: [
          {
            title: "\u0D9C\u0DAB\u0DD2\u0DAD\u0DBA & ICT",
            label: "Part B",
            items: [
              { q: "Q5", title: "Q5", max: 150, topics: ["\u0DC3\u0D82\u0D9B\u0DCA\u200D\u0DBA\u0DCF\u0DB1\u0DBA"] },
              { q: "Q6", title: "Q6", subTitle: "\u0DB8\u0DD2\u0DC1\u0DCA\u200D\u0DBB \u0D9C\u0DAB\u0DD2\u0DAD\u0DBA", max: 150, topics: ["\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DDD\u0DAB\u0DB8\u0DD2\u0DAD\u0DD2\u0DBA", "\u0D9B\u0DAB\u0DCA\u0DA9\u0DCF\u0D82\u0D9A \u0DA2\u0DCA\u200D\u0DBA\u0DCF\u0DB8\u0DD2\u0DAD\u0DD2\u0DBA", "\u0DC0\u0DBB\u0DCA\u0D9C\u0DB5\u0DBD\u0DBA \u0DC4\u0DCF \u0DB4\u0DBB\u0DD2\u0DB8\u0DCF\u0DC0"] }
            ]
          },
          {
            title: "\u0DA2\u0DDB\u0DC0 \u0DC4\u0DCF \u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DD2\u0D9A \u0D9A\u0DBB\u0DCA\u0DB8\u0DCF\u0DB1\u0DCA\u0DAD",
            label: "Part C",
            items: [
              { q: "Q7", title: "Q7", max: 150, topics: ["\u0DB4\u0DBB\u0DD2\u0DC3\u0DBB\u0DBA", "\u0DC3\u0DCA\u0DC0\u0DB7\u0DCF\u0DC0\u0DD2\u0D9A \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1"] },
              { q: "Q8", title: "Q8", max: 150, topics: ["\u0DBB\u0DC3\u0DCF\u0DBA\u0DB1\u0DD2\u0D9A \u0D9A\u0DBB\u0DCA\u0DB8\u0DCF\u0DB1\u0DCA\u0DAD"] }
            ]
          },
          {
            title: "\u0DB7\u0DDE\u0DAD\u0DD2\u0D9A \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0",
            label: "Part D",
            items: [
              { q: "Q9", title: "Q9", max: 150, topics: ["\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DD4\u0DAD\u0DBA", "\u0DA0\u0DBD\u0DD2\u0DAD\u0DBA"] },
              { q: "Q10", title: "Q10", max: 150, topics: ["\u0DAD\u0DCF\u0DB4\u0DBA", "\u0DB4\u0DAF\u0DCF\u0DBB\u0DCA\u0DAE\u0DBA\u0DDA \u0DBA\u0DCF\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A \u0D9C\u0DD4\u0DAB", "\u0DAD\u0DBB\u0DBD"] }
            ]
          }
        ]
      },
      et: {
        mcqMax: 50,
        mcqMult: 1,
        mcqItems: [
          { q: "Q1", title: "\u0DC4\u0DAF\u0DD2\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8", count: 1 },
          { q: "Q2-3", title: "\u0DB8\u0DD2\u0DB1\u0DD4\u0DB8\u0DCA", count: 2 },
          { q: "Q4", title: "\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DD2\u0DAD\u0DD2 \u0DC3\u0DC4 \u0DB4\u0DD2\u0DBB\u0DD2\u0DC0\u0DD2\u0DAD\u0DBB", count: 1 },
          { q: "Q5-6", title: "Drawing", count: 2 },
          { q: "Q7", title: "Safety", count: 1 },
          { q: "Q8-10", title: "\u0DC0\u0DCA\u200D\u0DBA\u0DC0\u0DC3\u0DCF\u0DBA\u0D9A\u0DAD\u0DCA\u0DC0\u0DBA", count: 3 },
          { q: "Q11-15", title: "Civil", count: 5 },
          { q: "Q16-18", title: "\u0DB6\u0DD2\u0DB8\u0DCA \u0DB8\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA", count: 3 },
          { q: "Q19-20", title: "TDS", count: 2 },
          { q: "Q21-22", title: "\u0D9A\u0DC3\u0DC5 \u0D85\u0DB4\u0DC0\u0DC4\u0DB1\u0DBA", count: 2 },
          { q: "Q23-24", title: "\u0DA0\u0DBD\u0DD2\u0DAD\u0DBA", count: 2 },
          { q: "Q25-29", title: "AutoMobile", count: 5 },
          { q: "Q30-31", title: "\u0DAD\u0DBB\u0DBD \u0DBA\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB", count: 2 },
          { q: "Q32-38", title: "production", count: 7 },
          { q: "Q39-40", title: "\u0DC0\u0DD2\u0DAF\u0DD4\u0DBD\u0DD2 \u0DBA\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB", count: 2 },
          { q: "Q41-44", title: "electrical", count: 4 },
          { q: "Q45-50", title: "electronic", count: 6 }
        ],
        partAMax: 300,
        partAItems: [
          { q: "Q1", title: "Q1", max: 75, topics: ["Drawing"] },
          { q: "Q2", title: "Q2", max: 75, topics: ["Civil", "\u0DB6\u0DD2\u0DB8\u0DCA \u0DB8\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA", "\u0DAD\u0DBB\u0DBD \u0DBA\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB", "\u0D9A\u0DC3\u0DC5 \u0D85\u0DB4\u0DC0\u0DC4\u0DB1\u0DBA"] },
          { q: "Q3", title: "Q3", max: 75, topics: ["production", "\u0DB8\u0DD2\u0DB1\u0DD4\u0DB8\u0DCA", "Safety", "\u0DA0\u0DBD\u0DD2\u0DAD\u0DBA"] },
          { q: "Q4", title: "Q4", max: 75, topics: ["\u0DC0\u0DCA\u200D\u0DBA\u0DC0\u0DC3\u0DCF\u0DBA\u0D9A\u0DAD\u0DCA\u0DC0\u0DBA"] }
        ],
        partBCDMax: 400,
        partBCDItems: [],
        bcdGroups: [
          {
            title: "\u0DC3\u0DD2\u0DC0\u0DD2\u0DBD\u0DCA \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA",
            label: "Part B",
            items: [
              { q: "Q5", title: "Q5", max: 100, topics: ["Civil"] },
              { q: "Q6", title: "Q6", max: 100, topics: ["TDS", "\u0DB6\u0DD2\u0DB8\u0DCA \u0DB8\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA"] }
            ]
          },
          {
            title: "\u0DBA\u0DCF\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA",
            label: "Part C",
            items: [
              { q: "Q7", title: "Q7", max: 100, topics: ["AutoMobile"] },
              { q: "Q8", title: "Q8", max: 100, topics: ["production", "\u0DAD\u0DBB\u0DBD \u0DBA\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB"] }
            ]
          },
          {
            title: "\u0DC0\u0DD2\u0DAF\u0DD4\u0DBD\u0DD2 \u0DC4\u0DCF \u0D89\u0DBD\u0DD9\u0D9A\u0DCA\u0DA7\u0DCA\u200D\u0DBB\u0DDC\u0DB1\u0DD2\u0D9A \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA",
            label: "Part D",
            items: [
              { q: "Q9", title: "Q9", max: 100, topics: ["electrical", "\u0DC0\u0DD2\u0DAF\u0DD4\u0DBD\u0DD2 \u0DBA\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB"] },
              { q: "Q10", title: "Q10", max: 100, topics: ["electronic"] }
            ]
          }
        ]
      },
      ict: {
        mcqMax: 50,
        mcqMult: 1,
        mcqItems: [
          { q: "Q1-6", title: "Concept of ICT & Intro", count: 6 },
          { q: "Q7-10", title: "Number System", count: 4 },
          { q: "Q11-14", title: "Logic Gates", count: 4 },
          { q: "Q15-18", title: "OS", count: 4 },
          { q: "Q19-24", title: "Networking", count: 6 },
          { q: "Q25-29", title: "Information System", count: 5 },
          { q: "Q30-34", title: "Database", count: 5 },
          { q: "Q35-40", title: "Python", count: 6 },
          { q: "Q41-45", title: "Web", count: 5 },
          { q: "Q46-50", title: "IoT, E-commerce, New Trends", count: 5 }
        ],
        partAMax: 40,
        partAItems: [
          { q: "Q1", title: "Q1", max: 10, topics: ["Web", "Number System"] },
          { q: "Q2", title: "Q2", max: 10, topics: ["OS", "Logic Gates"] },
          { q: "Q3", title: "Q3", max: 10, topics: ["Python"] },
          { q: "Q4", title: "Q4", max: 10, topics: ["Web", "OS"] }
        ],
        partBCDMax: 60,
        partBCDItems: [],
        bcdGroups: [
          {
            title: "\u0DBB\u0DA0\u0DB1\u0DCF \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 (6\u0DB1\u0DCA 4\u0D9A\u0DCA \u0DB4\u0DB8\u0DAB\u0DD2)",
            label: "Part B",
            items: [
              { q: "Q5", title: "Q5", max: 15, topics: ["Python"] },
              { q: "Q6", title: "Q6", max: 15, topics: ["Database"] },
              { q: "Q7", title: "Q7", max: 15, topics: ["Networking"] },
              { q: "Q8", title: "Q8", max: 15, topics: ["Information System", "OS"] },
              { q: "Q9", title: "Q9", max: 15, topics: ["Logic Gates"] },
              { q: "Q10", title: "Q10", max: 15, topics: ["IoT, E-commerce, New Trends"] }
            ]
          }
        ]
      }
    };
  }
});

// src/shared/zscore.ts
function estimateSubjectZFromMark(subject, mark) {
  const finalMark = Math.min(95, Math.max(0, Number(mark)));
  const points = CURVES[subject];
  for (let index = 0; index < points.length - 1; index += 1) {
    const upper = points[index];
    const lower = points[index + 1];
    if (finalMark <= upper.x && finalMark >= lower.x) {
      const ratio = (finalMark - lower.x) / (upper.x - lower.x);
      const computed = lower.y + ratio * (upper.y - lower.y);
      return Number(Math.min(3, Math.max(-2.5, computed)).toFixed(4));
    }
  }
  return -2.3;
}
var CURVES;
var init_zscore = __esm({
  "src/shared/zscore.ts"() {
    "use strict";
    CURVES = {
      sft: [
        { x: 95, y: 2.9 },
        { x: 89, y: 2.71 },
        { x: 80, y: 2.15 },
        { x: 75, y: 1.8 },
        { x: 65, y: 1.25 },
        { x: 55, y: 0.8 },
        { x: 35, y: 0.05 },
        { x: 0, y: -2.3 }
      ],
      et: [
        { x: 95, y: 2.9 },
        { x: 87, y: 2.68 },
        { x: 80, y: 2.1 },
        { x: 75, y: 1.6 },
        { x: 65, y: 1 },
        { x: 55, y: 0.5 },
        { x: 35, y: -0.05 },
        { x: 0, y: -2.3 }
      ],
      ict: [
        { x: 95, y: 2.9 },
        { x: 89, y: 2.77 },
        { x: 80, y: 2.2 },
        { x: 75, y: 1.8 },
        { x: 65, y: 1.25 },
        { x: 55, y: 0.85 },
        { x: 35, y: 0.25 },
        { x: 0, y: -2.3 }
      ]
    };
  }
});

// src/lib/scoreUtils.ts
function interpolateEstimatedRank(zScore, points) {
  const sorted = [...points].sort((a, b) => b[0] - a[0]);
  if (zScore >= sorted[0][0]) return sorted[0][1];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const [upperZ, upperRank] = sorted[index];
    const [lowerZ, lowerRank] = sorted[index + 1];
    if (zScore <= upperZ && zScore >= lowerZ) {
      const ratio = (upperZ - zScore) / Math.max(1e-4, upperZ - lowerZ);
      return Math.max(1, Math.round(upperRank + ratio * (lowerRank - upperRank)));
    }
  }
  const [lowestZ, lowestRank] = sorted[sorted.length - 1];
  const [highestZ, highestRank] = sorted[0];
  const fullSlope = (lowestRank - highestRank) / Math.max(1e-4, highestZ - lowestZ);
  return Math.max(lowestRank, Math.round(lowestRank + (lowestZ - zScore) * fullSlope));
}
var calculateSubjectZ, ISLAND_RANK_MODEL, DISTRICT_RANK_MODEL, getEstimatedIslandRank, getEstimatedDistrictRank, calculateExamScoreProjection, buildExamScorePrediction;
var init_scoreUtils = __esm({
  "src/lib/scoreUtils.ts"() {
    "use strict";
    init_syllabus();
    init_zscore();
    calculateSubjectZ = (subject, mark) => {
      return estimateSubjectZFromMark(subject, mark);
    };
    ISLAND_RANK_MODEL = [
      [2.9999, 1],
      [2.6557, 45],
      [2.3537, 212],
      [2.2295, 228],
      [2.2003, 250],
      [2, 511],
      [1.6553, 1033],
      [1.5238, 1358],
      [1.2663, 2032],
      [1.2293, 2170],
      [1.1375, 2473],
      [0.7249, 4155],
      [0.6274, 4155]
    ];
    DISTRICT_RANK_MODEL = [
      [2.9999, 1],
      [2.6557, 2],
      [2.3537, 3],
      [2.2295, 5],
      [2.2003, 6],
      [2, 10],
      [1.6553, 32],
      [1.5238, 40],
      [1.2663, 55],
      [1.2293, 56],
      [1.1375, 65],
      [0.7249, 113],
      [0.6274, 119]
    ];
    getEstimatedIslandRank = (zScore) => interpolateEstimatedRank(zScore, ISLAND_RANK_MODEL);
    getEstimatedDistrictRank = (zScore) => interpolateEstimatedRank(zScore, DISTRICT_RANK_MODEL);
    calculateExamScoreProjection = (subjectKey, data) => {
      const def = SYLLABUS[subjectKey];
      const subjectData = data[subjectKey];
      if (!def || !subjectData) {
        return { minimum: 0, maximum: 0, midpoint: 0, mcqCompleted: 0, partARaw: 0, partBcdRaw: 0 };
      }
      let mcqCheckedCount = 0;
      def.mcqItems.forEach((item) => {
        if (subjectData.topics[item.title]?.checked) mcqCheckedCount += item.count || 0;
      });
      let partAScore = 0;
      def.partAItems.forEach((item) => {
        const completed = item.topics?.filter((topic) => subjectData.topics[topic]?.checked).length || 0;
        if (item.topics?.length) partAScore += completed / item.topics.length * (item.max || 0);
      });
      const bcdScores = [];
      const allBcd = [...def.partBCDItems];
      def.bcdGroups?.forEach((group) => allBcd.push(...group.items));
      allBcd.forEach((item) => {
        const completed = item.topics?.filter((topic) => subjectData.topics[topic]?.checked).length || 0;
        if (item.topics?.length) bcdScores.push(completed / item.topics.length * (item.max || 0));
      });
      const top4BcdScore = bcdScores.sort((a, b) => b - a).slice(0, 4).reduce((sum, value) => sum + value, 0);
      const partAMax = subjectKey === "et" ? 300 : subjectKey === "ict" ? 40 : 400;
      const partBcdMax = subjectKey === "et" ? 400 : subjectKey === "ict" ? 60 : 600;
      const mcqRatio = mcqCheckedCount / Math.max(1, def.mcqMax || 50);
      const minimumMcq = Math.min(45, Math.round(mcqRatio * 40)) * def.mcqMult;
      const maximumMcq = Math.min(50, Math.round(mcqRatio * 45)) * def.mcqMult;
      const partARatio = partAScore / Math.max(1, partAMax);
      const bcdRatio = top4BcdScore / Math.max(1, partBcdMax);
      const minimumPaper2 = Math.min(0.9, partARatio * 0.85) * partAMax + Math.min(145 / 150, bcdRatio * (130 / 150)) * partBcdMax;
      const maximumPaper2 = Math.min(1, partARatio * 0.9) * partAMax + Math.min(1, bcdRatio * (145 / 150)) * partBcdMax;
      let minimum = 0;
      let maximum = 0;
      if (subjectKey === "sft") {
        minimum = minimumPaper2 / 20 + minimumMcq;
        maximum = maximumPaper2 / 20 + maximumMcq;
      } else if (subjectKey === "et") {
        minimum = minimumMcq * 0.75 + minimumPaper2 * (37.5 / 700) + 25;
        maximum = maximumMcq * 0.75 + maximumPaper2 * (37.5 / 700) + 25;
      } else {
        minimum = minimumMcq + minimumPaper2 / 2;
        maximum = maximumMcq + maximumPaper2 / 2;
      }
      minimum = Math.max(0, Math.min(95, Math.round(minimum)));
      maximum = Math.max(minimum, Math.min(95, Math.round(maximum)));
      return {
        minimum,
        maximum,
        midpoint: Number(((minimum + maximum) / 2).toFixed(1)),
        mcqCompleted: mcqCheckedCount,
        partARaw: partAScore,
        partBcdRaw: top4BcdScore
      };
    };
    buildExamScorePrediction = (data) => {
      const projections = {
        sft: calculateExamScoreProjection("sft", data),
        et: calculateExamScoreProjection("et", data),
        ict: calculateExamScoreProjection("ict", data)
      };
      const subjectZScores = {
        sft: calculateSubjectZ("sft", projections.sft.midpoint),
        et: calculateSubjectZ("et", projections.et.midpoint),
        ict: calculateSubjectZ("ict", projections.ict.midpoint)
      };
      const zScore = Number(((subjectZScores.sft + subjectZScores.et + subjectZScores.ict) / 3).toFixed(4));
      return {
        projections,
        projectedMarks: {
          sft: projections.sft.midpoint,
          et: projections.et.midpoint,
          ict: projections.ict.midpoint
        },
        subjectZScores,
        zScore,
        estimatedIslandRank: getEstimatedIslandRank(zScore),
        estimatedDistrictRank: getEstimatedDistrictRank(zScore),
        calculationBasis: "exam_score_predictor",
        official: false
      };
    };
  }
});

// server/firebase/userContext.ts
var userContext_exports = {};
__export(userContext_exports, {
  loadUserAIContext: () => loadUserAIContext
});
async function loadUserAIContext(uid, email) {
  const cacheKey = `${uid}_${email || ""}`;
  const now = Date.now();
  const cached = contextCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  try {
    const db = getAdminDb();
    const userUidRef = db.collection("users").doc(uid);
    const userEmailRef = email ? db.collection("users").doc(email.toLowerCase()) : null;
    const [uidSnap, emailSnap, uidProfileSnap, emailProfileSnap, uidProg, emailProg] = await Promise.all([
      userUidRef.get().catch(() => null),
      userEmailRef ? userEmailRef.get().catch(() => null) : null,
      userUidRef.collection("profile").doc("main").get().catch(() => null),
      userEmailRef ? userEmailRef.collection("profile").doc("main").get().catch(() => null) : null,
      userUidRef.collection("progress").doc("data").get().catch(() => null),
      userEmailRef ? userEmailRef.collection("progress").doc("data").get().catch(() => null) : null
    ]);
    let profileData = {};
    if (emailSnap && emailSnap.exists) {
      profileData = { ...profileData, ...emailSnap.data() };
    }
    if (uidSnap && uidSnap.exists) {
      profileData = { ...profileData, ...uidSnap.data() };
    }
    if (emailProfileSnap && emailProfileSnap.exists) {
      profileData = { ...profileData, ...emailProfileSnap.data() };
    }
    if (uidProfileSnap && uidProfileSnap.exists) {
      profileData = { ...profileData, ...uidProfileSnap.data() };
    }
    let localDbData = null;
    if (email) {
      try {
        await syncUserFromFirestore(email);
        localDbData = readUser(email);
        if (localDbData && Object.keys(localDbData).length > 0) {
          if (localDbData.profile) profileData = { ...localDbData.profile, ...profileData };
        }
      } catch (e) {
        console.warn("Failed to read local user data:", e);
      }
    }
    let appData = null;
    let loadedFrom = "none";
    if (uidProg && uidProg.exists) {
      const p = uidProg.data();
      appData = p?.data || p;
      loadedFrom = "uid_progress_data";
    } else if (emailProg && emailProg.exists) {
      const p = emailProg.data();
      appData = p?.data || p;
      loadedFrom = "email_progress_data";
    } else if (profileData.appData) {
      appData = profileData.appData;
      loadedFrom = "root_appData";
    } else if (profileData.data) {
      appData = profileData.data;
      loadedFrom = "root_data";
    }
    if (!appData && localDbData && (localDbData.data || localDbData.appData)) {
      appData = localDbData.data || localDbData.appData;
      loadedFrom = "local_db_fallback";
    }
    const [memoryUid, memoryEmail] = await Promise.all([
      userUidRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })),
      userEmailRef ? userEmailRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);
    const [chatUid, chatEmail] = await Promise.all([
      userUidRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })),
      userEmailRef ? userEmailRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);
    const mistakeSnapshot = await userUidRef.collection("mistake_notebook").orderBy("createdAt", "desc").limit(20).get().catch(() => ({ docs: [] }));
    const recentMistakes = mistakeSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const memoryDocs = [...memoryUid.docs, ...memoryEmail.docs];
    const aiMemory = Array.from(new Map(memoryDocs.map((d) => [d.id, d.data()])).values());
    const chatDocs = [...chatUid.docs, ...chatEmail.docs];
    const chatHistoryLast10 = Array.from(new Map(chatDocs.map((d) => [d.id, d.data()])).values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-10);
    const weakLessons = [];
    const progressSummary = [];
    if (appData) {
      for (const subject of ["sft", "et", "ict"]) {
        const subjectData = appData[subject];
        if (!subjectData) continue;
        const topics = subjectData.topics || {};
        const topicKeys = Object.keys(topics);
        const checkedKeys = topicKeys.filter((k) => topics[k]?.checked);
        const totalCount = topicKeys.length;
        const checkedCount = checkedKeys.length;
        const percent = totalCount > 0 ? Math.round(checkedCount / totalCount * 100) : 0;
        const completedLessonNames = checkedKeys;
        const pendingLessonNames = topicKeys.filter((k) => !topics[k]?.checked);
        progressSummary.push({
          subject,
          totalTopics: totalCount,
          completedTopics: checkedCount,
          coveragePercent: percent,
          completedLessonNames,
          pendingLessonNames
        });
        topicKeys.forEach((topicName) => {
          const topicInfo = topics[topicName];
          if (!topicInfo) return;
          let isWeak = false;
          let reason = "";
          if (topicInfo.notes) {
            const notesLower = topicInfo.notes.toLowerCase();
            const weakKeywords = [
              "hard",
              "difficult",
              "fail",
              "forget",
              "weak",
              "revise",
              "doubt",
              "wrong",
              "problem",
              "amaru",
              "baha",
              "patalila",
              "puluwan na",
              "mathaka na",
              "epawa",
              "patali",
              "vadiyen",
              "karanna oni",
              "amaruida"
            ];
            const foundKeyword = weakKeywords.find((kw) => notesLower.includes(kw));
            if (foundKeyword) {
              isWeak = true;
              reason = `User noted: "${topicInfo.notes}"`;
            }
          }
          const qMarks = subjectData.questionMarks?.[topicName] || [];
          if (qMarks.length > 0) {
            qMarks.forEach((q) => {
              const score = q.total !== void 0 ? q.total : (q.mcqRaw || 0) + (q.partARaw || 0) + (q.partBcdRaw || 0);
              if (score > 0 && score < 45) {
                isWeak = true;
                reason = `Low score (${score}) on question: "${q.title}"`;
              }
            });
          }
          if (isWeak) {
            weakLessons.push({
              subject,
              topic: topicName,
              reason,
              notes: topicInfo.notes || ""
            });
          }
        });
      }
    }
    const latestMarks = appData ? [
      ...(appData.sft?.paperMarks || []).map((m) => ({ ...m, subject: "sft" })),
      ...(appData.et?.paperMarks || []).map((m) => ({ ...m, subject: "et" })),
      ...(appData.ict?.paperMarks || []).map((m) => ({ ...m, subject: "ict" }))
    ] : [];
    const zScoreContext = {
      hasZScoreData: false,
      zScoreHistory: [],
      dataSources: [loadedFrom]
    };
    const targetZ = profileData.targetZScore ?? profileData.targetZ ?? profileData.zTarget ?? profileData.profile?.targetZScore ?? profileData.profile?.targetZ ?? (uidProg && uidProg.exists ? uidProg.data()?.targetZScore ?? uidProg.data()?.data?.targetZ : void 0) ?? (emailProg && emailProg.exists ? emailProg.data()?.targetZScore ?? emailProg.data()?.data?.targetZ : void 0) ?? appData?.targetZScore ?? appData?.targetZ ?? appData?.zTarget ?? appData?.profile?.targetZ;
    if (targetZ !== void 0 && targetZ !== null) {
      zScoreContext.targetZScore = Number(targetZ);
      zScoreContext.hasZScoreData = true;
    }
    let currentZ = profileData.estimatedZScore ?? profileData.currentZScore ?? profileData.zScore ?? profileData.overallZScore ?? profileData.predictedZScore ?? profileData.latestZScore ?? profileData.latestEstimate ?? profileData.latestResult ?? appData?.estimatedZScore ?? appData?.currentZScore ?? appData?.zScore ?? appData?.overallZScore ?? appData?.predictedZScore ?? appData?.latestZScore ?? appData?.latestEstimate ?? appData?.latestResult;
    if (currentZ !== void 0 && currentZ !== null) {
      zScoreContext.latestOverallZScore = Number(currentZ);
      zScoreContext.hasZScoreData = true;
    }
    const subjZ = profileData.subjectZScores ?? appData?.subjectZScores;
    const flatSubjZ = {
      sft: profileData.sftZ ?? appData?.sftZ ?? subjZ?.sft,
      et: profileData.etZ ?? appData?.etZ ?? subjZ?.et,
      ict: profileData.ictZ ?? appData?.ictZ ?? subjZ?.ict
    };
    if ([flatSubjZ.sft, flatSubjZ.et, flatSubjZ.ict].some((value) => value !== void 0 && value !== null)) {
      zScoreContext.subjectZScores = {
        sft: flatSubjZ.sft !== void 0 && flatSubjZ.sft !== null ? Number(flatSubjZ.sft) : void 0,
        et: flatSubjZ.et !== void 0 && flatSubjZ.et !== null ? Number(flatSubjZ.et) : void 0,
        ict: flatSubjZ.ict !== void 0 && flatSubjZ.ict !== null ? Number(flatSubjZ.ict) : void 0
      };
      zScoreContext.hasZScoreData = true;
    }
    const ranks = profileData.rankEstimate ?? appData?.rankEstimate;
    const flatRanks = {
      districtRank: profileData.districtRank ?? appData?.districtRank ?? ranks?.districtRank,
      islandRank: profileData.islandRank ?? appData?.islandRank ?? ranks?.islandRank,
      district: profileData.district ?? appData?.district ?? ranks?.district
    };
    if (flatRanks.districtRank || flatRanks.islandRank) {
      zScoreContext.rankEstimate = {
        districtRank: flatRanks.districtRank ? Number(flatRanks.districtRank) : void 0,
        islandRank: flatRanks.islandRank ? Number(flatRanks.islandRank) : void 0,
        district: flatRanks.district
      };
      zScoreContext.hasZScoreData = true;
    }
    let rawHistory = profileData.zScoreHistory ?? profileData.zHistory ?? profileData.predictions ?? profileData.admissionPrediction ?? appData?.zScoreHistory ?? appData?.zHistory ?? appData?.predictions ?? appData?.admissionPrediction;
    if (Array.isArray(rawHistory) && rawHistory.length > 0) {
      zScoreContext.zScoreHistory = rawHistory.map((r) => ({
        date: r.date ?? r.createdAt ?? r.timestamp,
        overall: r.overall ?? r.zScore ?? r.overallZScore,
        sft: r.sft ?? r.sftZ ?? r.subjectZScores?.sft,
        et: r.et ?? r.etZ ?? r.subjectZScores?.et,
        ict: r.ict ?? r.ictZ ?? r.subjectZScores?.ict,
        source: r.source ?? "history_array"
      })).filter((r) => r.overall !== void 0);
      if (zScoreContext.zScoreHistory.length > 0) {
        zScoreContext.hasZScoreData = true;
        zScoreContext.zScoreHistory.sort((a, b) => {
          if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
          return 0;
        });
        const latestHist = zScoreContext.zScoreHistory[zScoreContext.zScoreHistory.length - 1];
        if (zScoreContext.latestOverallZScore === void 0 || latestHist.date && new Date(latestHist.date).getTime() > 0) {
          zScoreContext.latestOverallZScore = latestHist.overall;
          zScoreContext.latestUpdatedAt = latestHist.date;
          if (!zScoreContext.subjectZScores && [latestHist.sft, latestHist.et, latestHist.ict].some((value) => value !== void 0 && value !== null)) {
            zScoreContext.subjectZScores = {
              sft: latestHist.sft,
              et: latestHist.et,
              ict: latestHist.ict
            };
          }
        }
      }
    }
    const predictor = buildExamScorePrediction(appData || {});
    const predictorHistory = Array.isArray(appData?.zScoreHistory) ? appData.zScoreHistory.filter((entry) => Number.isFinite(Number(entry?.zScore ?? entry?.overall))).map((entry) => ({
      date: entry.date,
      overall: Number(entry.zScore ?? entry.overall),
      sft: entry.subjectZScores?.sft,
      et: entry.subjectZScores?.et,
      ict: entry.subjectZScores?.ict,
      source: entry.calculationBasis || "legacy_exam_score_predictor",
      official: false
    })) : [];
    zScoreContext.hasZScoreData = true;
    zScoreContext.calculationBasis = predictor.calculationBasis;
    zScoreContext.official = false;
    zScoreContext.complete = true;
    zScoreContext.reliability = "planning_estimate";
    zScoreContext.message = "Derived from the Exam Score Predictor syllabus-completion model.";
    zScoreContext.projectedMarks = predictor.projectedMarks;
    zScoreContext.rawPaperAverages = predictor.projectedMarks;
    zScoreContext.subjectZScores = predictor.subjectZScores;
    zScoreContext.zScoreHistory = predictorHistory;
    zScoreContext.latestOverallZScore = predictor.zScore;
    zScoreContext.rankEstimate = {
      districtRank: predictor.estimatedDistrictRank,
      islandRank: predictor.estimatedIslandRank,
      district: flatRanks.district,
      estimated: true
    };
    const rawLatestPredictorDate = predictorHistory[predictorHistory.length - 1]?.date;
    const parsedLatestPredictorDate = new Date(String(rawLatestPredictorDate || ""));
    zScoreContext.latestUpdatedAt = Number.isFinite(parsedLatestPredictorDate.getTime()) && parsedLatestPredictorDate.getFullYear() >= 2024 && parsedLatestPredictorDate.getFullYear() <= (/* @__PURE__ */ new Date()).getFullYear() + 1 ? parsedLatestPredictorDate.toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    zScoreContext.gapToTarget = zScoreContext.targetZScore !== void 0 ? Number((zScoreContext.targetZScore - predictor.zScore).toFixed(4)) : void 0;
    const contextData = {
      loadedFrom,
      profile: {
        uid,
        name: profileData?.name || profileData?.username || profileData?.displayName || (email ? email.split("@")[0] : "Student"),
        email: email || profileData?.email,
        stream: profileData?.stream || "Technology",
        district: profileData?.district || "Unknown"
      },
      preferences: profileData?.preferences || {},
      latestMarks,
      weakLessons,
      recentProgress: progressSummary,
      aiMemory,
      chatHistoryLast10,
      recentMistakes,
      examDates: profileData?.examDates || {},
      targetZ: zScoreContext.targetZScore,
      zScoreContext,
      currentTimeAsiaColombo: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: process.env.APP_TIME_ZONE || "Asia/Colombo" })
    };
    contextCache.set(cacheKey, { data: contextData, timestamp: now });
    return contextData;
  } catch (e) {
    console.error("loadUserAIContext error", e);
    return {
      profile: { uid, name: "Student", email },
      preferences: {},
      latestMarks: [],
      weakLessons: [],
      recentProgress: [],
      aiMemory: [],
      chatHistoryLast10: [],
      recentMistakes: [],
      examDates: {},
      currentTimeAsiaColombo: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Colombo" })
    };
  }
}
var contextCache, CACHE_TTL;
var init_userContext = __esm({
  "server/firebase/userContext.ts"() {
    "use strict";
    init_userRepository();
    init_admin();
    init_scoreUtils();
    contextCache = /* @__PURE__ */ new Map();
    CACHE_TTL = 1e4;
  }
});

// server/ai/memoryExtractor.ts
async function extractStableMemoryIfUseful(params) {
  if (process.env.ENABLE_MEMORY_EXTRACTION !== "true") {
    return {
      ok: false,
      skipped: true,
      reason: "MEMORY_EXTRACTION_DISABLED"
    };
  }
  try {
    const ai9 = getAIClient();
    const extractionPrompt = `
Extract only stable, useful study-related facts from the conversation.
Return ONLY a JSON array. Do not return markdown blocks like \`\`\`json.
If nothing useful, return [].
Do not extract sensitive personal information.
Do not extract temporary emotions.
Only extract facts that help future A/L study support.

Types allowed: "stable_preference" | "weakness" | "target" | "study_pattern" | "mistake"

User Prompt: ${params.prompt}
Assistant Answer: ${params.answer}
`;
    const response = await ai9.models.generateContent({
      model: AI_MODELS.default,
      contents: extractionPrompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });
    let text = response.text || "[]";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const items = JSON.parse(text);
    if (Array.isArray(items) && items.length > 0) {
      const db = getAdminDb();
      const batch = db.batch();
      for (const item of items) {
        if (item.type && item.value) {
          const ref = db.collection("users").doc(params.uid).collection("ai_memory").doc();
          batch.set(ref, {
            type: item.type,
            value: item.value,
            confidence: item.confidence || 0.8,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      await batch.commit();
      return items;
    }
  } catch (e) {
    if (e?.status === 429 || e?.code === 429) {
      console.warn("MEMORY_EXTRACTION_SKIPPED_QUOTA");
      return { ok: false, skipped: true, reason: "RESOURCE_EXHAUSTED" };
    }
    console.warn("MEMORY_EXTRACTION_FAILED", e?.message || e);
    return { ok: false, skipped: true, reason: "FAILED" };
  }
  return [];
}
var init_memoryExtractor = __esm({
  "server/ai/memoryExtractor.ts"() {
    "use strict";
    init_client();
    init_admin();
  }
});

// server/knowledge/lessonResolver.ts
function normalizeLessonText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}
function meaningfulTokens(value) {
  return normalizeLessonText(value).split(/\s+/).filter((token) => token.length > 1 && !FILLER_WORDS.has(token));
}
function resolveLessonReference(prompt, explicitLesson) {
  const combined = normalizeLessonText(`${explicitLesson || ""} ${prompt || ""}`);
  for (const entry of LESSON_ALIASES) {
    if (entry.aliases.some((alias) => combined.includes(normalizeLessonText(alias)))) {
      return {
        label: entry.label,
        aliases: [...entry.aliases],
        tokens: [...new Set(entry.aliases.flatMap(meaningfulTokens))]
      };
    }
  }
  const tokens = meaningfulTokens(explicitLesson || prompt);
  if (tokens.length === 0) return null;
  const label = tokens.slice(0, 8).join(" ");
  return { label, aliases: [label], tokens };
}
function sourceLessonText(source) {
  return normalizeLessonText([
    source?.lesson,
    source?.title,
    source?.fileName,
    ...Array.isArray(source?.tags) ? source.tags : []
  ].filter(Boolean).join(" "));
}
function scoreLessonSource(source, reference) {
  const candidate = sourceLessonText(source);
  if (!candidate) return 0;
  let score = 0;
  for (const alias of reference.aliases) {
    const normalizedAlias = normalizeLessonText(alias);
    if (normalizedAlias && candidate.includes(normalizedAlias)) score = Math.max(score, 100);
  }
  const candidateTokens = new Set(meaningfulTokens(candidate));
  const matchingTokens = reference.tokens.filter((token) => candidateTokens.has(token));
  if (reference.tokens.length > 0) {
    score = Math.max(score, Math.round(matchingTokens.length / reference.tokens.length * 85));
  }
  const explicitLesson = normalizeLessonText(source?.lesson);
  if (explicitLesson && reference.tokens.some((token) => explicitLesson.includes(token))) score += 20;
  return Math.min(120, score);
}
function findLessonSources(sources, prompt, explicitLesson) {
  const reference = resolveLessonReference(prompt, explicitLesson);
  if (!reference) return { reference: null, sources: [] };
  const ranked = (sources || []).map((source) => ({ source, score: scoreLessonSource(source, reference) })).filter((entry) => entry.score >= 40).sort((a, b) => b.score - a.score);
  return {
    reference,
    sources: ranked.map((entry) => ({ ...entry.source, lessonMatchScore: entry.score }))
  };
}
function isLessonEvidenceMode(mode) {
  return ["lesson_pdf_search", "lesson_question_discussion", "lesson_theory_explanation", "past_paper_lesson_search"].includes(String(mode || ""));
}
var FILLER_WORDS, LESSON_ALIASES;
var init_lessonResolver = __esm({
  "server/knowledge/lessonResolver.ts"() {
    "use strict";
    FILLER_WORDS = /* @__PURE__ */ new Set([
      "a",
      "an",
      "the",
      "of",
      "for",
      "from",
      "in",
      "on",
      "and",
      "to",
      "me",
      "my",
      "lesson",
      "lessons",
      "topic",
      "unit",
      "pdf",
      "paper",
      "past",
      "question",
      "questions",
      "prashna",
      "prasna",
      "discuss",
      "karamu",
      "krmu",
      "gamu",
      "gmu",
      "eka",
      "eke",
      "tik",
      "tika",
      "walin",
      "wlin",
      "wala",
      "oni",
      "need",
      "use",
      "all",
      "sft",
      "et",
      "ict",
      "\u0DB4\u0DCF\u0DA9\u0DB8",
      "\u0DB4\u0DCF\u0DA9\u0DB8\u0DDA",
      "\u0DB4\u0DCF\u0DA9\u0DB8\u0DCA",
      "\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1",
      "\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA",
      "\u0DB4\u0DAD\u0DCA\u200D\u0DBB",
      "\u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA",
      "\u0D9A\u0DBB\u0DB8\u0DD4",
      "\u0DA7\u0DD2\u0D9A"
    ]);
    LESSON_ALIASES = [
      { label: "\u0DAD\u0DBB\u0DBD / Fluid mechanics", aliases: ["\u0DAD\u0DBB\u0DBD", "\u0DAF\u0DCA\u200D\u0DBB\u0DC0", "tharala", "tarala", "fluid", "fluids", "fluid mechanics"] },
      { label: "\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DD4\u0DAD\u0DBA / Electricity", aliases: ["\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DD4\u0DAD", "\u0DC0\u0DD2\u0DAF\u0DD4\u0DBD\u0DD2", "vidyuth", "vidyutha", "electricity", "electrical"] },
      { label: "\u0D89\u0DBD\u0DD9\u0D9A\u0DCA\u0DA7\u0DCA\u200D\u0DBB\u0DDC\u0DB1\u0DD2\u0D9A \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0 / Electronics", aliases: ["\u0D89\u0DBD\u0DD9\u0D9A\u0DCA\u0DA7\u0DCA\u200D\u0DBB\u0DDC\u0DB1\u0DD2\u0D9A", "electronics", "electronic"] },
      { label: "\u0D9A\u0DD8\u0DC2\u0DD2 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA / Agro technology", aliases: ["\u0D9A\u0DD8\u0DC2\u0DD2", "agro", "agriculture", "agro technology"] },
      { label: "\u0D86\u0DC4\u0DCF\u0DBB \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA / Food technology", aliases: ["\u0D86\u0DC4\u0DCF\u0DBB", "food", "food technology"] },
      { label: "\u0DA2\u0DDB\u0DC0 \u0DB4\u0DAF\u0DCA\u0DB0\u0DAD\u0DD2 / Bio systems", aliases: ["\u0DA2\u0DDB\u0DC0", "bio systems", "biosystems", "bio-systems"] },
      { label: "Python", aliases: ["python", "\u0DB4\u0DBA\u0DD2\u0DAD\u0DB1\u0DCA"] },
      { label: "Networking", aliases: ["networking", "network", "\u0DA2\u0DCF\u0DBD"] },
      { label: "Civil engineering", aliases: ["civil", "\u0DC3\u0DD2\u0DC0\u0DD2\u0DBD\u0DCA"] },
      { label: "Database", aliases: ["database", "databases", "\u0DAF\u0DAD\u0DCA\u0DAD \u0DC3\u0DB8\u0DD4\u0DAF\u0DCF"] }
    ];
  }
});

// server/knowledge/knowledgeRouter.ts
var knowledgeRouter_exports = {};
__export(knowledgeRouter_exports, {
  routeKnowledgeRequest: () => routeKnowledgeRequest
});
function parseDeterministicIntent(prompt, activeSubject) {
  const lower = prompt.toLowerCase();
  const lessonReference = resolveLessonReference(prompt);
  const isPredictionRequest = /\b(?:guess|guessing|prediction|predict|likely|forecast)\b|අනුමාන|අපේක්ෂිත|පුරෝකථන/i.test(lower);
  const isExamPrediction = isPredictionRequest && (lower.includes("paper") || lower.includes("mcq") || lower.includes("essay") || lower.includes("\u0DC0\u0DD2\u0DB7\u0DCF\u0D9C") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB") || /\b20\d{2}\b/.test(lower));
  if (isExamPrediction) {
    let predictionSubject;
    if (/\bsft\b|science for technology|තාක්ෂණවේදය සඳහා විද්(?:‍ය|ය)ාව/i.test(lower)) predictionSubject = "SFT";
    else if (/\bict\b|information and communication|තොරතුරු හා සන්නිවේදන/i.test(lower)) predictionSubject = "ICT";
    else if (/\bet\b|engineering technology|ඉංජිනේරු තාක්ෂණවේදය/i.test(lower)) predictionSubject = "ET";
    else if (["SFT", "ET", "ICT"].includes(String(activeSubject || "").toUpperCase())) predictionSubject = String(activeSubject).toUpperCase();
    return {
      mode: "past_paper_analysis",
      entities: {
        subject: predictionSubject,
        year: lower.match(/\b(20\d{2})\b/)?.[1],
        paperType: lower.includes("mcq") ? "mcq" : lower.includes("essay") ? "essay" : "unknown",
        needsClarification: !predictionSubject,
        clarificationQuestion: !predictionSubject ? "2026 prediction \u0D91\u0D9A \u0DC4\u0DAF\u0DB1\u0DCA\u0DB1 subject \u0D91\u0D9A \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1: SFT, ET, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA ICT?" : void 0
      },
      answerHints: {
        mustUseRag: true,
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustAskClarification: !predictionSubject
      }
    };
  }
  const isPdfInventory = lower.includes("give all pdfs") || lower.includes("all pdfs") || lower.includes("mage pdf") || lower.includes("thiyena pdf") || lower.includes("firebase eke") || lower.includes("uploaded pdfs") || lower.includes("past papers list") || lower.includes("syllabus pdf") || lower.includes("paper structure pdf") || lower.includes("pdf list") || lower.includes("\u0DB4\u0DD3\u0DA9\u0DD3\u0D91\u0DC6\u0DCA \u0DBD\u0DD2\u0DC3\u0DCA\u0DA7\u0DCA") || lower.includes("\u0DB4\u0DD3\u0DA9\u0DD3\u0D91\u0DC6\u0DCA \u0DA7\u0DD2\u0D9A") || lower.includes("tika denna") || lower.includes("tika ko");
  if (isPdfInventory) {
    let inventorySubject;
    if (/\bsft\b|science for technology|තාක්ෂණවේදය සඳහා විද්(?:‍ය|ය)ාව/i.test(lower)) inventorySubject = "SFT";
    else if (/\bict\b|information and communication|තොරතුරු හා සන්නිවේදන/i.test(lower)) inventorySubject = "ICT";
    else if (/\bet\b|engineering technology|ඉංජිනේරු තාක්ෂණවේදය/i.test(lower)) inventorySubject = "ET";
    else if (["SFT", "ET", "ICT"].includes(String(activeSubject || "").toUpperCase())) inventorySubject = String(activeSubject).toUpperCase();
    return {
      mode: "pdf_inventory_request",
      entities: {
        subject: inventorySubject
      },
      answerHints: {
        mustUseRag: true,
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustAskClarification: false
      }
    };
  }
  const pdfMatch = prompt.match(/\[Uploaded PDF:\s*([^\]]+)\]/i);
  if (pdfMatch) {
    const uploadedFileName = pdfMatch[1].trim();
    let questionNo2 = void 0;
    if (lower.includes("1st") || lower.includes("first") || lower.includes("q1") || lower.includes("question 1") || lower.includes("question 01") || lower.includes("palaweni") || lower.includes("\u0DB4\u0DC5\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("\u0DB4\u0DC5\u0DB8\u0DD4")) {
      questionNo2 = "Q1";
    } else if (lower.includes("2nd") || lower.includes("second") || lower.includes("q2") || lower.includes("question 2") || lower.includes("question 02") || lower.includes("deweni") || lower.includes("\u0DAF\u0DD9\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("\u0DAF\u0DD9\u0DC0\u0DB1")) {
      questionNo2 = "Q2";
    } else if (lower.includes("3rd") || lower.includes("third") || lower.includes("q3") || lower.includes("question 3") || lower.includes("question 03") || lower.includes("thunweni") || lower.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DB1")) {
      questionNo2 = "Q3";
    }
    let requestedAnswerType = void 0;
    if (lower.includes("essay") || lower.includes("structured essay") || lower.includes("\u0DBB\u0DA0\u0DB1\u0DCF")) {
      requestedAnswerType = "essay";
    } else if (lower.includes("mcq")) {
      requestedAnswerType = "mcq";
    }
    const hasQ = questionNo2 || requestedAnswerType || lower.includes("question") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1") || lower.includes("hdn") || lower.includes("hadana") || lower.includes("hadanna") || lower.includes("essay");
    if (hasQ) {
      return {
        mode: "uploaded_pdf_question_qa",
        entities: {
          uploadedFileName,
          questionNo: questionNo2,
          requestedAnswerType,
          subject: activeSubject,
          resourceType: "uploaded_pdf"
        },
        answerHints: {
          mustUseRag: true,
          mustUseGoogleSearch: false,
          mustUseUrlContext: false,
          mustAskClarification: false
        }
      };
    }
  }
  if (lower.includes("zscore") || lower.includes("z score") || lower.includes("zcore") || lower.includes("rank") || lower.includes("district rank") || lower.includes("island rank") || lower.includes("z-score") || lower.includes("\u0DB8\u0D9C\u0DDA z") || lower.includes("target z")) {
    return {
      mode: "zscore_prediction",
      entities: {
        subject: void 0,
        year: void 0
      }
    };
  }
  let subject = void 0;
  if (lower.includes("sft") || lower.includes("science for technology") || lower.includes("\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0") || lower.includes("\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0")) {
    subject = "SFT";
  } else if (lower.includes("et") || lower.includes("engineering technology") || lower.includes("\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA") || lower.includes("\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4")) {
    subject = "ET";
  } else if (lower.includes("ict") || lower.includes("information technology") || lower.includes("\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1") || lower.includes("\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA") || lower.includes("\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4")) {
    subject = "ICT";
  }
  if (!subject && activeSubject) {
    const sUpper = activeSubject.toUpperCase();
    if (sUpper === "SFT") subject = "SFT";
    else if (sUpper === "ET") subject = "ET";
    else if (sUpper === "ICT") subject = "ICT";
  }
  let year = void 0;
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }
  let questionNo = void 0;
  const mcqMatch = lower.match(/\bmcq\s*[-_]?\s*(\d+)\b/);
  const numberBeforeMcqMatch = lower.match(/\b(\d{1,2})\s*(?:(?:වෙනි|වැනි|weni|th|st|nd|rd)\s*)?mcq\b/i);
  const qMatch = lower.match(/\b(?:q|question)\s*[-_]?\s*(\d+)\b/);
  const sinhalaNoMatch = lower.match(/\b(\d+)\s*(?:වෙනි|වැනි|th|st|nd|rd)\b/i);
  if (mcqMatch) {
    questionNo = parseInt(mcqMatch[1]).toString();
  } else if (numberBeforeMcqMatch) {
    questionNo = parseInt(numberBeforeMcqMatch[1]).toString();
  } else if (qMatch) {
    questionNo = parseInt(qMatch[1]).toString();
  } else if (sinhalaNoMatch) {
    questionNo = parseInt(sinhalaNoMatch[1]).toString();
  } else if (lower.includes("palaweni") || lower.includes("first") || lower.includes("1st") || lower.includes("\u0DB4\u0DC5\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("\u0DB4\u0DC5\u0DB8\u0DD4")) {
    questionNo = "1";
  } else if (lower.includes("deweni") || lower.includes("second") || lower.includes("2nd") || lower.includes("\u0DAF\u0DD9\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("\u0DAF\u0DD9\u0DC0\u0DB1")) {
    questionNo = "2";
  } else if (lower.includes("thunweni") || lower.includes("third") || lower.includes("3rd") || lower.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DB1")) {
    questionNo = "3";
  } else if (lower.includes("\u0DC4\u0DAD\u0DBB\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("fourth") || lower.includes("4th")) {
    questionNo = "4";
  } else if (lower.includes("\u0DB4\u0DC3\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || lower.includes("fifth") || lower.includes("5th")) {
    questionNo = "5";
  }
  if (lower === "ehem krmu" || lower === "next" || lower === "continue" || lower === "first question" || lower === "ehem karamu") {
    return {
      mode: "continue_grounded_discussion",
      entities: {
        subject
      }
    };
  }
  if (lower.includes("model question") || lower.includes("model prashna") || lower.includes("model") && lower.includes("hadanna") || lower.includes("practice question")) {
    return {
      mode: "model_question_generation",
      entities: {
        subject
      }
    };
  }
  if (lower.includes("oya mona awrudde ekd") || lower.includes("awurudda mokakda") || lower.includes("what year is this")) {
    return {
      mode: "continue_grounded_discussion",
      entities: { subject }
    };
  }
  const asksPastPaperLesson = (lower.includes("past paper") || lower.includes("pastpaper") || lower.includes("past papers") || lower.includes("paper prashna")) && (lower.includes("prashna") || lower.includes("prasna") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1") || lower.includes("question") || lower.includes("gmu") || lower.includes("gamu") || lower.includes("karamu") || lower.includes("\u0D9A\u0DBB\u0DB8\u0DD4"));
  if (lower.includes("kelinama past paper prashna walata ymu") || lower.includes("kelinma past paper prashna walata ymu") || asksPastPaperLesson && lessonReference) {
    return {
      mode: "past_paper_lesson_search",
      entities: { subject, lesson: lessonReference?.label }
    };
  }
  if (lessonReference && (lower.includes("pdf") || lower.includes("resource") || lower.includes("note") || lower.includes("tute"))) {
    return {
      mode: "lesson_pdf_search",
      entities: { subject, lesson: lessonReference.label }
    };
  }
  const asksLessonQuestions = (lower.includes("prashna") || lower.includes("prasna") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1") || lower.includes("question") || lower.includes("quiz")) && (lower.includes("lesson") || lower.includes("\u0DB4\u0DCF\u0DA9\u0DB8") || lower.includes("pdf") || Boolean(lessonReference));
  if (lower.includes("tharala prashna pdf discuss krmu") || lower.includes("prashna pdf discuss") || lower.includes("pdf") && lower.includes("discuss") || asksLessonQuestions) {
    return {
      mode: "lesson_question_discussion",
      entities: { subject, lesson: lessonReference?.label }
    };
  }
  const isLessonMarks = lower.includes("marks") || lower.includes("\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4") || lower.includes("lkunu") || lower.includes("weighting");
  const isSyllabusOrLesson = lower.includes("lesson") || lower.includes("\u0DB4\u0DCF\u0DA9\u0DB8") || lower.includes("\u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DD4\u0DAD\u0DBA") || lower.includes("electrical") || lower.includes("electronics") || lower.includes("python") || lower.includes("networking") || lower.includes("civil");
  if (isLessonMarks && isSyllabusOrLesson && !questionNo && !year) {
    return {
      mode: "lesson_marks_intent",
      entities: {
        subject,
        lesson: prompt
      }
    };
  }
  const isPastPaperTerm = lower.includes("past paper") || lower.includes("paper") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB");
  const isMarkingSchemeTerm = lower.includes("marking scheme") || lower.includes("marking") || lower.includes("\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA") || lower.includes("marking schem");
  if (questionNo && (year || isPastPaperTerm || isMarkingSchemeTerm)) {
    if (isMarkingSchemeTerm) {
      return {
        mode: "marking_scheme_request",
        entities: {
          subject,
          year,
          questionNo,
          resourceType: "marking_scheme",
          paperType: "marking"
        }
      };
    }
    return {
      mode: "paper_question_qa",
      entities: {
        subject,
        year,
        questionNo,
        resourceType: "past_paper",
        paperType: "paper"
      }
    };
  }
  const isDownloadOrLink = lower.includes("download") || lower.includes("link") || lower.includes("pdf") || lower.includes("\u0DBD\u0DD2\u0DB1\u0DCA\u0D9A\u0DCA") || lower.includes("\u0DA9\u0DC0\u0DD4\u0DB1\u0DCA\u0DBD\u0DDD\u0DA9\u0DCA") || lower.includes("\u0DB4\u0DD3\u0DA9\u0DD3\u0D91\u0DC6\u0DCA");
  if (isDownloadOrLink && (year || isPastPaperTerm || isMarkingSchemeTerm)) {
    return {
      mode: "pdf_link_request",
      entities: {
        subject,
        year,
        resourceType: isMarkingSchemeTerm ? "marking_scheme" : "past_paper",
        paperType: isMarkingSchemeTerm ? "marking" : "paper"
      }
    };
  }
  return null;
}
async function routeKnowledgeRequest({
  prompt,
  uid,
  email,
  subject,
  activeSubject,
  files,
  conversationHistory
}) {
  const deterministic = parseDeterministicIntent(prompt, activeSubject || subject);
  if (deterministic) {
    return {
      mode: deterministic.mode,
      entities: deterministic.entities,
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: deterministic.answerHints?.mustUseGoogleSearch ?? deterministic.mode === "web_search",
        mustUseUrlContext: deterministic.answerHints?.mustUseUrlContext ?? false,
        mustUseRag: deterministic.answerHints?.mustUseRag ?? true,
        mustAskClarification: deterministic.answerHints?.mustAskClarification ?? false
      }
    };
  }
  if (process.env.ENABLE_LLM_ROUTER !== "true") {
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false
      }
    };
  }
  try {
    checkAiBillingCircuit();
  } catch (err) {
    console.warn("Skipping LLM knowledge routing due to AI billing circuit open.");
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false
      }
    };
  }
  const ai9 = getAIClient();
  const systemInstruction = `
You are an intent extractor for a Sri Lankan A/L study assistant. 
Extract the user's intent, requested year (2015-2026), subject (SFT/ET/ICT), paperType, and URLs.
Return a valid JSON object matching the requested schema.

Subject mapping:
- SFT = Science for Technology / SFT / \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0
- ET = Engineering Technology / ET / \u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA
- ICT = Information and Communication Technology / ICT / \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA

Rules:
- If past paper intent is detected but subject is missing, set needsClarification = true and subject = undefined.
- paperType can be: "paper", "marking", "mcq", "essay", "structured", "unknown"
- modes: "lesson_question_discussion", "lesson_theory_explanation", "official_paper_question", "past_paper_lesson_search", "selected_resource_discussion", "attachment_question", "model_question_generation", "marking_scheme_request", "continue_grounded_discussion", "normal_chat", "web_search", "url_context", "pdf_link_request"
- "lesson_question_discussion": asking to discuss questions from a lesson PDF (e.g., "\u0DAD\u0DBB\u0DBD \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 PDF discuss \u0D9A\u0DBB\u0DB8\u0DD4")
- "lesson_theory_explanation": asking to explain a lesson theory without specific questions
- "past_paper_lesson_search": asking for past paper questions for a specific lesson without a year (e.g., "\u0DAD\u0DBB\u0DBD past paper \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1")
- "official_paper_question": asking for a specific year's past paper question
- "model_question_generation": asking for a model question to be generated
- "continue_grounded_discussion": follow-up to continue a previous question discussion (e.g., "ehem krmu", "next", "continue")
- Set mode to "pdf_link_request" if the user explicitly asks for a PDF file download, file link, or download link of a paper/syllabus.
- If a URL is in the prompt, extract it to urls array and set mode to url_context.
- If asking about current events or general knowledge outside syllabus, mode = web_search.
- If normal subject question, mode = normal_chat or rag_qa.
  `;
  const promptText = `
User Prompt: "${prompt}"
Active Subject Context: "${activeSubject || subject || ""}"

Respond strictly in this JSON format:
{
  "mode": "...",
  "entities": {
    "year": "YYYY",
    "subject": "SFT",
    "paperType": "paper",
    "urls": [],
    "needsClarification": false,
    "clarificationQuestion": ""
  }
}
  `;
  try {
    const response = await ai9.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json"
      }
    });
    const result = JSON.parse(response.text || "{}");
    let { mode, entities } = result;
    if (!entities) entities = {};
    const lowerPrompt = prompt.toLowerCase();
    const isSft = lowerPrompt.includes("sft") || lowerPrompt.includes("\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0");
    const isEt = lowerPrompt.includes("et") || lowerPrompt.includes("\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA");
    const isIct = lowerPrompt.includes("ict") || lowerPrompt.includes("\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1");
    const yearMatch = lowerPrompt.match(/\b(20\d{2})\b/);
    const extractedYear = yearMatch ? yearMatch[1] : void 0;
    const isDownloadRequest = lowerPrompt.includes("download") || lowerPrompt.includes("link") || lowerPrompt.includes("pdf") || lowerPrompt.includes("\u0DBD\u0DD2\u0DB1\u0DCA\u0D9A\u0DCA") || lowerPrompt.includes("\u0DA9\u0DC0\u0DD4\u0DB1\u0DCA\u0DBD\u0DDD\u0DA9\u0DCA") || lowerPrompt.includes("\u0DB4\u0DD3\u0DA9\u0DD3\u0D91\u0DC6\u0DCA") || lowerPrompt.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB");
    if (isDownloadRequest && (mode === "past_paper_search" || mode === "normal_chat")) {
      mode = "pdf_link_request";
    }
    if (mode === "pdf_link_request") {
      if (!entities.subject && activeSubject) {
        entities.subject = activeSubject;
      }
      if (isSft) entities.subject = "SFT";
      if (isEt) entities.subject = "ET";
      if (isIct) entities.subject = "ICT";
      if (extractedYear) entities.year = extractedYear;
      if (!entities.subject) {
        entities.needsClarification = true;
        entities.clarificationQuestion = "\u{1F50D} \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB subject \u0D91\u0D9A \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1. SFT, ET, ICT \u0D85\u0DAD\u0DBB\u0DD2\u0DB1\u0DCA \u0DB8\u0DDC\u0D9A\u0D9A\u0DCA\u0DAF?";
      } else if (!entities.year) {
        entities.needsClarification = true;
        entities.clarificationQuestion = "\u0D94\u0DBA\u0DCF\u0DA7 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA paper year \u0D91\u0D9A \u0DB8\u0DDC\u0D9A\u0D9A\u0DCA\u0DAF? (\u0D8B\u0DAF\u0DCF: 2025, 2023 \u0DC0\u0D9C\u0DDA)";
      }
    }
    if (entities.needsClarification && !entities.clarificationQuestion) {
      entities.clarificationQuestion = "\u{1F50D} \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0D94\u0DB6 \u0DC3\u0DDC\u0DBA\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA\u0DDA \u0DC0\u0DD2\u0DC2\u0DBA \u0DC3\u0DB3\u0DC4\u0DB1\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. SFT, ET, ICT \u0D85\u0DAD\u0DBB\u0DD2\u0DB1\u0DCA \u0DB8\u0DDC\u0DB1 subject \u0D91\u0D9A\u0DAF?";
    }
    return {
      mode: mode || "normal_chat",
      entities,
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: mode === "web_search",
        mustUseUrlContext: mode === "url_context" || entities.urls && entities.urls.length > 0,
        mustUseRag: mode === "rag_qa",
        mustAskClarification: !!entities.needsClarification
      }
    };
  } catch (err) {
    console.error("Knowledge router error:", err);
    try {
      const classification = classifyAiError(err);
      if (classification.code === "AI_BILLING_EXHAUSTED") {
        handleAiError(err);
      }
    } catch (e) {
    }
    return {
      mode: "normal_chat",
      entities: {},
      contextBlocks: [],
      answerHints: {
        mustUseGoogleSearch: false,
        mustUseUrlContext: false,
        mustUseRag: false,
        mustAskClarification: false
      }
    };
  }
}
var init_knowledgeRouter = __esm({
  "server/knowledge/knowledgeRouter.ts"() {
    "use strict";
    init_client();
    init_aiCircuitBreaker();
    init_aiErrorClassifier();
    init_lessonResolver();
  }
});

// server/sources/sourceInventoryService.ts
var sourceInventoryService_exports = {};
__export(sourceInventoryService_exports, {
  computeIndexStatus: () => computeIndexStatus,
  extractTitleYear: () => extractTitleYear,
  getSourceInventory: () => getSourceInventory,
  inferResourceType: () => inferResourceType,
  inferSubject: () => inferSubject,
  invalidateInventoryCache: () => invalidateInventoryCache
});
function extractTitleYear(...values) {
  for (const value of values) {
    const match = String(value || "").match(/\b(20\d{2})\b/);
    if (match) return match[1];
  }
  return "";
}
function inferSubject(...values) {
  const text = values.map((value) => String(value || "")).join(" ");
  if (/\b(?:SFT|SCIENCE\s+FOR\s+TECHNOLOGY|67\s*S(?:\s|[-_/])*I{1,2})\b|තාක්ෂණවේදය\s+සඳහා\s+විද්(?:‍ය|ය)ාව/iu.test(text)) return "SFT";
  if (/\b(?:ICT|INFORMATION\s+(?:AND|&)\s+COMMUNICATION\s+TECHNOLOGY)\b|තොරතුරු\s+හා\s+සන්නිවේදන/iu.test(text)) return "ICT";
  if (/\b(?:ET|ENGINEERING\s+TECHNOLOGY)\b|ඉංජිනේරු\s+තාක්ෂණවේදය/iu.test(text)) return "ET";
  return "";
}
function inferResourceType(src) {
  const explicit = String(src.resourceType || src.sourceType || "").trim().toLowerCase();
  const text = `${src.title || ""} ${src.fileName || ""} ${src.storagePath || ""}`.toLowerCase();
  if (explicit === "marking" || explicit === "marking_scheme") return "marking_scheme";
  if (/marking[ _-]*scheme|\bfull\s*sm\b|\banswers?\b|පිළිතුරු\s*පත්‍ර|ලකුණු\s*සම්මුතිය/.test(text)) return "marking_scheme";
  if (explicit === "paper_structure" || /paper[ _-]*structure|ප්‍රශ්න\s*පත්‍ර\s*ව්‍යුහ/.test(text)) return "paper_structure";
  if (explicit === "syllabus" || /\bsyllabus\b|විෂය\s*නිර්දේශ/.test(text)) return "syllabus";
  if (explicit === "past_paper" || /past[ _-]*paper|official[ _-]*paper|\b(?:sft|et|ict)\s*paper\b|විභාග\s*ප්‍රශ්න\s*පත්‍ර/.test(text)) return "past_paper";
  if (explicit === "image" || explicit === "image_upload") return explicit;
  return explicit || "uploaded_pdf";
}
function normalizedUrl(value) {
  return String(value || "").trim();
}
function canonicalSourceKey(src) {
  const title = String(src.title || src.fileName || "").toLowerCase().replace(/\.pdf$/i, "").replace(/\(\d+\)/g, "").replace(/[^a-z0-9\u0d80-\u0dff]+/g, " ").trim();
  if (title.length >= 6 && (src.subject || src.year || src.resourceType !== "uploaded_pdf")) {
    return `meta:${src.subject || ""}:${src.year || ""}:${src.resourceType || ""}:${title}`;
  }
  const storage = String(src.storagePath || "").replace(/^gs:\/\/[^/]+\//, "").toLowerCase();
  if (storage) return `storage:${storage}`;
  const downloadUrl = normalizedUrl(src.downloadUrl || src.firebaseDownloadUrl || src.url).replace(/[?&]token=[^&]+/i, "").toLowerCase();
  if (downloadUrl) return `url:${downloadUrl}`;
  return `meta:${src.subject || ""}:${src.year || ""}:${src.resourceType || ""}:${title}`;
}
function sourceQuality(src) {
  return (src.storagePath ? 40 : 0) + (src.downloadUrl || src.url ? 25 : 0) + (Number(src.chunkCount || 0) > 0 ? 20 : 0) + (src.visibility === "official" || src.sourceScope === "official" ? 15 : 0) + (src.subject ? 5 : 0) + (src.year ? 5 : 0);
}
function mergeSources(left, right) {
  const primary = sourceQuality(right) > sourceQuality(left) ? right : left;
  const secondary = primary === right ? left : right;
  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    sourceId: primary.sourceId || primary.id || secondary.sourceId || secondary.id,
    title: primary.title || secondary.title,
    fileName: primary.fileName || secondary.fileName,
    storagePath: primary.storagePath || secondary.storagePath || null,
    downloadUrl: primary.downloadUrl || secondary.downloadUrl || null,
    firebaseDownloadUrl: primary.firebaseDownloadUrl || secondary.firebaseDownloadUrl || null,
    url: primary.url || secondary.url || null,
    chunkCount: Math.max(Number(left.chunkCount || 0), Number(right.chunkCount || 0)),
    tags: [.../* @__PURE__ */ new Set([...Array.isArray(left.tags) ? left.tags : [], ...Array.isArray(right.tags) ? right.tags : []])],
    duplicateSourceIds: [...new Set([
      ...Array.isArray(left.duplicateSourceIds) ? left.duplicateSourceIds : [left.sourceId || left.id],
      ...Array.isArray(right.duplicateSourceIds) ? right.duplicateSourceIds : [right.sourceId || right.id]
    ].filter(Boolean))]
  };
}
function lessonFromStoragePath(storagePath) {
  const path5 = String(storagePath || "").replace(/^gs:\/\/[^/]+\//, "");
  const parts = path5.split("/").filter(Boolean);
  const marker = parts.indexOf("paper_structure");
  if (marker < 0 || !parts[marker + 2]) return null;
  try {
    return decodeURIComponent(parts[marker + 2]).replace(/_/g, " ").trim() || null;
  } catch {
    return parts[marker + 2].replace(/_/g, " ").trim() || null;
  }
}
function invalidateInventoryCache(uid) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${uid}:`) || key.startsWith("all:") || key.startsWith("admin:")) {
      cache.delete(key);
    }
  }
}
function computeIndexStatus(src) {
  const chunkCount = Number(src.chunkCount || 0);
  const currentStatus = String(src.indexStatus || "").toLowerCase();
  const hasLegacyTextLayer = String(src.textEncoding || "").startsWith("legacy_");
  const needsOcr = !hasLegacyTextLayer && (src.needsOcr === true || src.indexStatus === "needs_ocr");
  const needsLegacy = src.needsLegacyConversion === true || src.indexStatus === "needs_legacy_conversion";
  if (["queued", "running", "processing", "indexing"].includes(currentStatus)) return currentStatus;
  if (currentStatus === "failed") return "failed";
  if (chunkCount > 0 && (src.needsOcr === false || src.indexStatus === "ready")) {
    return "ready";
  }
  if (needsLegacy) {
    return "needs_legacy_conversion";
  }
  if (needsOcr) return "needs_ocr";
  if (chunkCount === 0) return "not_indexed";
  return "not_indexed";
}
async function getSourceInventory(params) {
  const { uid, subject, year, resourceType, isAdmin } = params;
  const cacheKey = `${uid}:${subject || "all"}:${year || "all"}:${resourceType || "all"}:${isAdmin ? "admin" : "user"}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  const db = getAdminDb();
  let ppQuery = db.collection("past_papers");
  const ppSnap = await ppQuery.get();
  const ppDocs = ppSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  let ragQuery = db.collection("rag_sources");
  const ragSnap = await ragQuery.get();
  const ragDocs = ragSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  let syllabusDocs = [];
  try {
    const sylSnap = await db.collection("users").doc(uid).collection("syllabus_resources").get();
    syllabusDocs = sylSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn("Failed to query syllabus_resources for inventory", e);
  }
  const subjectQuery = subject ? String(subject).toUpperCase() : null;
  const yearQuery = year ? String(year) : null;
  const typeQuery = resourceType ? String(resourceType).toLowerCase() : null;
  const canonicalSources = /* @__PURE__ */ new Map();
  function addSource(src) {
    if (!src) return;
    const sId = src.sourceId || src.id;
    if (!sId) return;
    const title = src.title || src.fileName || "Untitled PDF";
    const fileName = src.fileName || src.title || "untitled.pdf";
    const explicitSubject = String(src.subject || "").trim().toUpperCase();
    const normSubject = (["SFT", "ET", "ICT"].includes(explicitSubject) ? explicitSubject : "") || inferSubject(title, fileName, src.storagePath, src.tags);
    const titleYear = extractTitleYear(title, fileName, src.storagePath);
    const explicitYear = String(src.year || "").trim();
    const normYear = titleYear || explicitYear;
    const normResourceType = inferResourceType(src);
    const normSourceScope = String(src.sourceScope || "").trim().toLowerCase();
    if (subjectQuery && normSubject !== subjectQuery) return;
    if (yearQuery && normYear !== yearQuery) return;
    if (typeQuery && normResourceType !== typeQuery) return;
    const isOwner = src.ownerUid === uid;
    const isPublic = ["official", "shared", "public"].includes(String(src.visibility || "").toLowerCase()) || ["official", "shared", "public"].includes(normSourceScope);
    if (!isOwner && !isPublic && !isAdmin) return;
    const calcStatus = computeIndexStatus({
      chunkCount: Number(src.chunkCount || 0),
      needsOcr: src.needsOcr === true,
      needsLegacyConversion: src.needsLegacyConversion === true,
      textEncoding: src.textEncoding,
      indexStatus: src.indexStatus
    });
    const hasLegacyTextLayer = String(src.textEncoding || "").startsWith("legacy_");
    const normalizedNeedsOcr = !hasLegacyTextLayer && src.needsOcr === true;
    const normalized = {
      id: sId,
      sourceId: sId,
      title,
      fileName,
      subject: normSubject || null,
      lesson: src.lesson || src.topic || lessonFromStoragePath(src.storagePath) || null,
      year: normYear || null,
      metadataYear: explicitYear || null,
      resourceType: normResourceType || "uploaded_pdf",
      sourceScope: normSourceScope || null,
      storagePath: src.storagePath || null,
      downloadUrl: src.downloadUrl || src.firebaseDownloadUrl || null,
      firebaseDownloadUrl: src.firebaseDownloadUrl || src.downloadUrl || null,
      url: src.url || src.downloadUrl || src.firebaseDownloadUrl || null,
      ownerUid: src.ownerUid || null,
      chunkCount: Number(src.chunkCount || 0),
      needsOcr: normalizedNeedsOcr,
      needsLegacyConversion: src.needsLegacyConversion === true,
      textEncoding: src.textEncoding || "unknown",
      indexStatus: calcStatus,
      visibility: src.visibility || "private",
      sourceType: src.sourceType || normResourceType || null,
      tags: Array.isArray(src.tags) ? src.tags : [],
      textIndexed: Number(src.chunkCount || 0) > 0 && !normalizedNeedsOcr,
      createdAt: src.createdAt || null,
      duplicateSourceIds: [sId]
    };
    const key = canonicalSourceKey(normalized);
    const existing = canonicalSources.get(key);
    canonicalSources.set(key, existing ? mergeSources(existing, normalized) : normalized);
  }
  syllabusDocs.forEach((doc) => {
    addSource({ ...doc, resourceType: "syllabus", sourceScope: "owner_syllabus" });
  });
  ppDocs.forEach((doc) => {
    addSource({
      ...doc,
      resourceType: inferResourceType(doc) === "uploaded_pdf" ? "past_paper" : inferResourceType(doc),
      sourceScope: doc.sourceScope || "official",
      visibility: doc.visibility || "official"
    });
  });
  ragDocs.forEach((doc) => {
    addSource(doc);
  });
  const allSources = [...canonicalSources.values()];
  const groups = {
    pastPapers: [],
    markingSchemes: [],
    syllabus: [],
    paperStructure: [],
    uploadedPdfs: [],
    images: []
  };
  allSources.forEach((src) => {
    const rt = src.resourceType;
    const ss = src.sourceScope;
    if (rt === "marking_scheme" || rt === "marking") {
      groups.markingSchemes.push(src);
    } else if (rt === "syllabus" || ss === "owner_syllabus") {
      groups.syllabus.push(src);
    } else if (rt === "paper_structure" || ss === "paper_structure") {
      groups.paperStructure.push(src);
    } else if (rt === "image" || rt === "image_upload") {
      groups.images.push(src);
    } else if (rt === "past_paper") {
      groups.pastPapers.push(src);
    } else {
      groups.uploadedPdfs.push(src);
    }
  });
  const sortByYearAndTitle = (a, b) => {
    const yearDiff = Number(b.year || 0) - Number(a.year || 0);
    return yearDiff || String(a.title || "").localeCompare(String(b.title || ""));
  };
  Object.values(groups).forEach((list) => list.sort(sortByYearAndTitle));
  const result = {
    groups,
    total: allSources.length,
    all: allSources
  };
  cache.set(cacheKey, {
    data: result,
    expiry: now + 5 * 60 * 1e3
  });
  return result;
}
var cache;
var init_sourceInventoryService = __esm({
  "server/sources/sourceInventoryService.ts"() {
    "use strict";
    init_admin();
    cache = /* @__PURE__ */ new Map();
  }
});

// server/knowledge/retrieve.ts
async function retrieveRelevantKnowledge({
  query,
  uid,
  subject,
  limit = 8,
  lesson,
  strictLesson = false,
  allowedSourceIds = []
}) {
  const db = getAdminDb();
  const chunks = [];
  const lowerQ = query.toLowerCase();
  if (uid && strictLesson) {
    const inventory = await getSourceInventory({ uid, subject, isAdmin: false });
    const lessonMatch = findLessonSources(inventory.all, query, lesson);
    let sources = lessonMatch.sources;
    if (lessonMatch.reference) {
      const knownIds = new Set(sources.map((source) => String(source.sourceId || source.id)));
      const accessibleSourceMap = new Map(
        inventory.all.map((source) => [String(source.sourceId || source.id), source])
      );
      const [ownedChunks, sharedChunks] = await Promise.all([
        db.collection("rag_chunks").where("ownerUid", "==", uid).get().catch(() => ({ docs: [] })),
        db.collection("rag_chunks").where("visibility", "in", ["official", "shared"]).get().catch(() => ({ docs: [] }))
      ]);
      for (const document of [...ownedChunks.docs, ...sharedChunks.docs]) {
        const chunk = document.data();
        const sourceId = String(chunk.sourceId || "");
        const source = accessibleSourceMap.get(sourceId);
        if (!source || knownIds.has(sourceId)) continue;
        const score = scoreLessonSource({ lesson: chunk.lesson, title: source.title }, lessonMatch.reference);
        if (score < 40) continue;
        sources.push({ ...source, lesson: chunk.lesson || source.lesson, lessonMatchScore: score });
        knownIds.add(sourceId);
      }
      sources = sources.sort((a, b) => Number(b.lessonMatchScore || 0) - Number(a.lessonMatchScore || 0));
    }
    for (const source of sources.slice(0, 10)) {
      const sourceId = source.sourceId || source.id;
      const chunkSnapshot = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
      chunkSnapshot.docs.sort((a, b) => Number(a.data().chunkIndex || 0) - Number(b.data().chunkIndex || 0)).slice(0, 8).forEach((document) => {
        const data = document.data();
        if (!data.text) return;
        chunks.push({
          sourceType: data.sourceType || source.sourceType || "Lesson PDF",
          title: source.title,
          text: data.text,
          confidence: Math.min(1, Number(source.lessonMatchScore || 100) / 100),
          year: data.year || source.year,
          lesson: data.lesson || source.lesson || lessonMatch.reference?.label,
          subject: data.subject || source.subject,
          id: document.id,
          sourceId,
          storagePath: source.storagePath,
          pageNumber: data.pageNumber
        });
      });
    }
    const bySource = /* @__PURE__ */ new Map();
    for (const chunk of chunks) {
      const key = String(chunk.sourceId || "unknown");
      const list = bySource.get(key) || [];
      list.push(chunk);
      bySource.set(key, list);
    }
    const selected = [];
    const maximum = Math.max(limit, Math.min(40, sources.length * 4));
    for (let index = 0; selected.length < maximum; index += 1) {
      let added = false;
      for (const source of sources) {
        const sourceChunks = bySource.get(String(source.sourceId || source.id)) || [];
        if (sourceChunks[index]) {
          selected.push(sourceChunks[index]);
          added = true;
          if (selected.length >= maximum) break;
        }
      }
      if (!added) break;
    }
    return {
      chunks: selected,
      sources: sources.map((source) => ({
        id: source.sourceId || source.id,
        sourceId: source.sourceId || source.id,
        title: source.title,
        lesson: source.lesson || lessonMatch.reference?.label,
        storagePath: source.storagePath,
        confidence: Math.min(1, Number(source.lessonMatchScore || 100) / 100),
        sourceType: source.sourceType || source.resourceType,
        usedInAnswer: selected.some((chunk) => chunk.sourceId === (source.sourceId || source.id))
      })),
      lesson: lessonMatch.reference?.label || lesson || null,
      status: selected.length > 0 ? "success" : sources.length > 0 ? "index_required" : "not_found"
    };
  }
  try {
    const isPdfQuery = query.toLowerCase().includes("pdf") || query.match(/mcq|essay|structured|prashna|q\d|ප්‍රශ්න|paper|marking|scheme|answer/i);
    let activePdfSourceIds = [];
    if (uid && isPdfQuery) {
      try {
        const chatContextDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
        if (chatContextDoc.exists) {
          const data = chatContextDoc.data();
          if (data && Array.isArray(data.temporaryPdfs)) {
            activePdfSourceIds = data.temporaryPdfs.map((pdf) => pdf.sourceId);
          }
        }
      } catch (err) {
        console.warn("Failed to retrieve temporary PDFs context:", err.message);
      }
    }
    if (uid && activePdfSourceIds.length > 0) {
      try {
        for (const sId of activePdfSourceIds) {
          const sourceSnap = await db.collection("rag_sources").doc(sId).get();
          const sourceData = sourceSnap.exists ? sourceSnap.data() : null;
          const sourceTitle = sourceData?.title || sourceData?.fileName || "Uploaded PDF";
          const storagePath = sourceData?.storagePath || "";
          const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sId).get();
          chunksSnap.docs.forEach((doc) => {
            const data = doc.data();
            const textLower = (data.text || "").toLowerCase();
            const matchesSearch = textLower.includes(lowerQ) || data.tags && data.tags.some((t) => lowerQ.includes(t.toLowerCase()));
            if (matchesSearch) {
              chunks.push({
                sourceType: "Uploaded PDF",
                title: sourceTitle,
                text: data.text,
                confidence: 1,
                subject: data.subject,
                lesson: data.lesson,
                year: data.year,
                id: doc.id,
                sourceId: sId,
                storagePath
              });
            }
          });
        }
      } catch (err) {
        console.warn("Failed to retrieve chunks for active temporary PDFs:", err.message);
      }
    }
    const uploadedPdfMatch = query.match(/\[Uploaded PDF:\s*([^\]]+)\]/i);
    if (uploadedPdfMatch && uid) {
      const uploadedFileName = uploadedPdfMatch[1].trim();
      try {
        const sourcesSnap = await db.collection("rag_sources").where("ownerUid", "==", uid).where("fileName", "==", uploadedFileName).limit(1).get();
        let sourceId = "";
        let sourceTitle = uploadedFileName;
        let recentSources = null;
        if (!sourcesSnap.empty) {
          sourceId = sourcesSnap.docs[0].id;
          sourceTitle = sourcesSnap.docs[0].data().title || uploadedFileName;
        } else {
          recentSources = await db.collection("rag_sources").where("ownerUid", "==", uid).orderBy("createdAt", "desc").limit(1).get();
          if (!recentSources.empty) {
            sourceId = recentSources.docs[0].id;
            sourceTitle = recentSources.docs[0].data().title || recentSources.docs[0].data().fileName;
          }
        }
        if (sourceId) {
          const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).limit(limit).get();
          chunksSnap.docs.forEach((doc) => {
            const data = doc.data();
            chunks.push({
              sourceType: "Uploaded PDF",
              title: sourceTitle,
              text: data.text,
              confidence: 1,
              subject: data.subject,
              lesson: data.lesson,
              year: data.year,
              id: doc.id,
              sourceId: data.sourceId || sourceId,
              storagePath: data.storagePath || sourcesSnap?.docs[0]?.data()?.storagePath || recentSources?.docs[0]?.data()?.storagePath
            });
          });
        }
      } catch (pdfErr) {
        console.warn("Failed to retrieve chunks for uploaded PDF:", pdfErr.message);
      }
    }
    if (uid && chunks.length < limit) {
      const roleDoc = await db.collection("user_roles").doc(uid).get();
      const userRoles = roleDoc.exists ? roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : []) : [];
      const isOwner = userRoles.includes("admin") || userRoles.includes("teacher") || userRoles.includes("content_editor");
      if (isOwner) {
        const sylSnap = await db.collection("users").doc(uid).collection("syllabus_chunks").where("subject", "==", subject || null).limit(limit).get();
        sylSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.text?.toLowerCase().includes(lowerQ) || lowerQ.includes(data.subject?.toLowerCase() || "")) {
            chunks.push({
              sourceType: "Syllabus Library",
              title: data.tags?.[0] || data.subject || "Private Syllabus",
              text: data.text,
              confidence: 1,
              subject: data.subject,
              lesson: data.lesson,
              year: data.year,
              id: doc.id,
              sourceId: data.sourceId,
              storagePath: data.storagePath
            });
          }
        });
      }
    }
    if (uid && chunks.length < limit) {
      try {
        const userChunksSnap = await db.collection("rag_chunks").where("ownerUid", "==", uid).limit(limit * 2).get();
        userChunksSnap.docs.forEach((doc) => {
          const data = doc.data();
          const matchesSearch = data.text?.toLowerCase().includes(lowerQ) || data.tags && data.tags.some((t) => lowerQ.includes(t.toLowerCase()));
          if (matchesSearch) {
            chunks.push({
              sourceType: data.sourceScope === "owner_syllabus" ? "Syllabus Library" : "My Uploaded PDF",
              title: data.tags?.[0] || "My Document",
              text: data.text,
              confidence: 0.95,
              subject: data.subject,
              lesson: data.lesson,
              year: data.year,
              id: doc.id,
              sourceId: data.sourceId,
              storagePath: data.storagePath
            });
          }
        });
      } catch (err) {
        console.warn("User private chunks search failed:", err.message);
      }
    }
    if (chunks.length < limit) {
      let ragQuery = db.collection("rag_chunks").where("visibility", "in", ["official", "shared"]);
      const ragSnap = await ragQuery.limit(limit).get();
      ragSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.text?.toLowerCase().includes(lowerQ)) {
          chunks.push({
            sourceType: data.sourceScope === "owner_syllabus" ? "Syllabus Library" : "RAG DB",
            title: data.tags?.[0] || "RAG Resource",
            text: data.text,
            confidence: 0.9,
            subject: data.subject,
            lesson: data.lesson,
            year: data.year,
            id: doc.id,
            sourceId: data.sourceId,
            storagePath: data.storagePath
          });
        }
      });
    }
    chunks.sort((a, b) => b.confidence - a.confidence);
    return {
      chunks: chunks.slice(0, limit),
      sources: chunks.slice(0, limit).map((c) => ({
        id: c.sourceId || c.id,
        sourceId: c.sourceId || c.id,
        title: c.title,
        storagePath: c.storagePath,
        url: c.url,
        confidence: c.confidence,
        sourceType: c.sourceType,
        usedInAnswer: true,
        pageNumber: c.pageNumber
      })),
      status: "success"
    };
  } catch (e) {
    console.warn("Firestore retrieve failed:", e.message);
    return {
      chunks: [],
      sources: [],
      status: "firestore_unavailable",
      errorCode: e.code || "PERMISSION_DENIED",
      usedFallback: true
    };
  }
}
async function retrieveUploadedPdfQuestion({
  uid,
  uploadedFileName,
  sourceId,
  questionNo,
  query,
  limit = 8
}) {
  const db = getAdminDb();
  let activeSourceId = sourceId;
  let sourceData = null;
  if (!activeSourceId) {
    try {
      const chatCtxDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
      if (chatCtxDoc.exists) {
        const data = chatCtxDoc.data();
        if (data && data.activePdf && data.activePdf.sourceId) {
          activeSourceId = data.activePdf.sourceId;
          sourceData = data.activePdf;
        }
      }
    } catch (err) {
      console.warn("Failed to read activePdf from chat_context/current:", err.message);
    }
  }
  if (!activeSourceId && uploadedFileName) {
    try {
      const chatCtxDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
      if (chatCtxDoc.exists) {
        const data = chatCtxDoc.data();
        if (data && Array.isArray(data.temporaryPdfs)) {
          const matchedPdf = data.temporaryPdfs.find(
            (pdf) => pdf.fileName && pdf.fileName.toLowerCase() === uploadedFileName.toLowerCase() || pdf.title && pdf.title.toLowerCase() === uploadedFileName.toLowerCase()
          );
          if (matchedPdf) {
            activeSourceId = matchedPdf.sourceId;
            sourceData = matchedPdf;
          }
        }
      }
    } catch (err) {
      console.warn("Failed to check temporaryPdfs:", err.message);
    }
  }
  if (!activeSourceId && uploadedFileName) {
    try {
      const sourcesSnap = await db.collection("rag_sources").where("ownerUid", "==", uid).where("fileName", "==", uploadedFileName).limit(1).get();
      let recentSources = null;
      if (!sourcesSnap.empty) {
        activeSourceId = sourcesSnap.docs[0].id;
        sourceData = sourcesSnap.docs[0].data();
      }
    } catch (err) {
      console.warn("Failed to query rag_sources by fileName:", err.message);
    }
  }
  if (!activeSourceId) {
    try {
      const recentSources = await db.collection("rag_sources").where("ownerUid", "==", uid).orderBy("createdAt", "desc").limit(1).get();
      if (!recentSources.empty) {
        activeSourceId = recentSources.docs[0].id;
        sourceData = recentSources.docs[0].data();
      }
    } catch (err) {
      console.warn("Failed fallback to recent rag_sources:", err.message);
    }
  }
  if (activeSourceId && !sourceData) {
    try {
      const srcSnap = await db.collection("rag_sources").doc(activeSourceId).get();
      if (srcSnap.exists) {
        sourceData = srcSnap.data();
      }
    } catch (err) {
      console.warn("Failed to retrieve rag_source doc:", err);
    }
  }
  if (!activeSourceId) {
    return {
      chunks: [],
      source: null,
      hasExactQuestionText: false,
      needsOcr: false
    };
  }
  const needsOcr = !!sourceData?.needsOcr;
  let chunks = [];
  try {
    const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", activeSourceId).get();
    chunks = chunksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("Failed to retrieve rag_chunks:", err);
  }
  let hasExactQuestionText = false;
  const scoredChunks = chunks.map((c) => {
    let score = 0;
    const lowerText = (c.text || "").toLowerCase();
    if (questionNo && c.questionNo === questionNo) {
      score += 1e3;
      hasExactQuestionText = true;
    } else if (questionNo) {
      const isQ1 = questionNo === "Q1" && (lowerText.includes("q1") || lowerText.includes("question 1") || lowerText.includes("question 01") || lowerText.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 1") || lowerText.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 01") || lowerText.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 1") || lowerText.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 01") || lowerText.includes("\u0DB4\u0DC5\u0DB8\u0DD4") || lowerText.includes("\u0DB4\u0DC5\u0DC0\u0DD9\u0DB1\u0DD2") || /(?:^|\s|\n)0?1\.\s/.test(lowerText));
      const isQ2 = questionNo === "Q2" && (lowerText.includes("q2") || lowerText.includes("question 2") || lowerText.includes("question 02") || lowerText.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 2") || lowerText.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 02") || lowerText.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 2") || lowerText.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 02") || lowerText.includes("\u0DAF\u0DD9\u0DC0\u0DB1") || lowerText.includes("\u0DAF\u0DD9\u0DC0\u0DD9\u0DB1\u0DD2") || /(?:^|\s|\n)0?2\.\s/.test(lowerText));
      const isQ3 = questionNo === "Q3" && (lowerText.includes("q3") || lowerText.includes("question 3") || lowerText.includes("question 03") || lowerText.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 3") || lowerText.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 03") || lowerText.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 3") || lowerText.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 03") || lowerText.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DB1") || lowerText.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || /(?:^|\s|\n)0?3\.\s/.test(lowerText));
      if (isQ1 || isQ2 || isQ3) {
        score += 500;
        hasExactQuestionText = true;
      }
    }
    if (c.pageNumber) {
      if (c.pageNumber === 1) score += 100;
      else if (c.pageNumber === 2) score += 50;
      else if (c.pageNumber === 3) score += 20;
    } else {
      if (c.chunkIndex === 0) score += 80;
      else if (c.chunkIndex === 1) score += 40;
    }
    if (query) {
      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      queryWords.forEach((w) => {
        if (lowerText.includes(w)) {
          score += 10;
        }
      });
    }
    return { chunk: c, score };
  });
  scoredChunks.sort((a, b) => b.score - a.score);
  const finalChunks = scoredChunks.slice(0, limit).map((sc) => ({
    sourceType: "Uploaded PDF",
    title: sourceData?.title || sourceData?.fileName || "Uploaded PDF",
    text: sc.chunk.text,
    confidence: sc.score > 0 ? 1 : 0.8,
    pageNumber: sc.chunk.pageNumber || null,
    questionNo: sc.chunk.questionNo || null,
    id: sc.chunk.id
  }));
  return {
    chunks: finalChunks,
    source: {
      id: activeSourceId,
      title: sourceData?.title || sourceData?.fileName || "Uploaded PDF",
      fileName: sourceData?.fileName || "uploaded_source.pdf",
      storagePath: sourceData?.storagePath || "",
      ownerUid: sourceData?.ownerUid || uid
    },
    hasExactQuestionText,
    needsOcr
  };
}
function checkBadTextQuality(text) {
  if (!text) return true;
  const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCharCount > 3) {
    const ratio = replacementCharCount / text.length;
    if (ratio > 0.015 || replacementCharCount > 10) return true;
  }
  const hasSinhalaChars = /[\u0D80-\u0DFF]/.test(text);
  if (hasSinhalaChars) {
    const sinhalaCount = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
    if (sinhalaCount < 15 && replacementCharCount > 2) {
      return true;
    }
  }
  const garbageSymbolsCount = (text.match(/[^a-zA-Z0-9\s\.,\?\!\"'\(\)\u0D80-\u0DFF\-\+\=\/\*]/g) || []).length;
  if (text.length > 50 && garbageSymbolsCount / text.length > 0.25) {
    return true;
  }
  return false;
}
async function retrieveExactPaperQuestion({
  uid,
  sourceId,
  subject,
  year,
  questionNo,
  questionType
}) {
  const db = getAdminDb();
  let sourceDoc = null;
  let sourceData = null;
  try {
    const ragSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (ragSnap.exists) {
      sourceDoc = ragSnap;
      sourceData = ragSnap.data();
    } else {
      const ppSnap = await db.collection("past_papers").doc(sourceId).get();
      if (ppSnap.exists) {
        sourceDoc = ppSnap;
        sourceData = ppSnap.data();
      }
    }
  } catch (err) {
    console.warn("retrieveExactPaperQuestion: failed to fetch source document:", err);
  }
  if (!sourceData) {
    return {
      source: null,
      chunks: [],
      allChunks: [],
      hasExactQuestionText: false,
      badTextQuality: false,
      needsOcr: false,
      needsLegacyConversion: false,
      reason: "Source details not found in library."
    };
  }
  const hasLegacyTextLayer = String(sourceData.textEncoding || "").startsWith("legacy_");
  const needsOcr = !hasLegacyTextLayer && (sourceData.needsOcr === true || sourceData.indexStatus === "needs_ocr");
  const needsLegacyConversion = sourceData.needsLegacyConversion === true || sourceData.indexStatus === "needs_legacy_conversion";
  if (needsOcr) {
    return {
      source: sourceData,
      chunks: [],
      allChunks: [],
      hasExactQuestionText: false,
      badTextQuality: hasLegacyTextLayer,
      needsOcr,
      needsLegacyConversion,
      reason: "This source has no searchable text layer."
    };
  }
  let chunks = [];
  try {
    const chunkSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    chunks = chunkSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("retrieveExactPaperQuestion: failed to fetch rag_chunks:", err);
  }
  let matchedChunks = [];
  let hasExactQuestionText = false;
  let badTextQuality = hasLegacyTextLayer;
  const numOnly = questionNo ? questionNo.replace(/\D/g, "") : "";
  if (numOnly) {
    const patterns = [
      new RegExp(`\\b${numOnly}\\.\\s`),
      new RegExp(`\\b${numOnly}\\)`),
      new RegExp(`\\(${numOnly}\\)`),
      new RegExp(`mcq\\s*${numOnly}\\b`, "i"),
      new RegExp(`(?:\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA|\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA)\\s*${numOnly}\\b`),
      new RegExp(`${numOnly}\\s*\u0DC0\u0DB1`),
      new RegExp(`${numOnly}\\s*\u0DC0\u0DD9\u0DB1\u0DD2`)
    ];
    matchedChunks = chunks.filter((c) => {
      const text = c.text || "";
      const lower = text.toLowerCase();
      if (c.questionNo && String(c.questionNo).replace(/\D/g, "") === numOnly) {
        return true;
      }
      const matchedText = patterns.some((p) => p.test(text) || p.test(lower));
      return matchedText;
    });
    if (matchedChunks.length > 0) {
      hasExactQuestionText = true;
      const allGarbage = matchedChunks.every((c) => checkBadTextQuality(c.text));
      if (allGarbage) {
        badTextQuality = true;
      }
      const orderedChunks = [...chunks].sort(
        (a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0)
      );
      const selectedIds = new Set(matchedChunks.map((chunk) => String(chunk.id || chunk.chunkIndex)));
      for (const matched of [...matchedChunks]) {
        const index = orderedChunks.findIndex(
          (chunk) => String(chunk.id || chunk.chunkIndex) === String(matched.id || matched.chunkIndex)
        );
        if (index < 0) continue;
        for (let offset = -2; offset <= 2; offset += 1) {
          const neighbour = orderedChunks[index + offset];
          if (!neighbour) continue;
          const key = String(neighbour.id || neighbour.chunkIndex);
          if (selectedIds.has(key)) continue;
          selectedIds.add(key);
          matchedChunks.push(neighbour);
        }
      }
    }
  } else {
    matchedChunks = chunks.slice(0, 5);
    if (matchedChunks.length > 0) {
      const allGarbage = matchedChunks.every((c) => checkBadTextQuality(c.text));
      if (allGarbage) {
        badTextQuality = true;
      }
    }
  }
  return {
    source: {
      id: sourceId,
      ...sourceData
    },
    chunks: matchedChunks,
    allChunks: chunks,
    hasExactQuestionText,
    badTextQuality,
    needsOcr,
    needsLegacyConversion,
    reason: matchedChunks.length > 0 ? "Exact matching chunks successfully retrieved." : "Exact question chunks missing from index."
  };
}
var init_retrieve = __esm({
  "server/knowledge/retrieve.ts"() {
    "use strict";
    init_admin();
    init_sourceInventoryService();
    init_lessonResolver();
  }
});

// server/ai/tools/urlContext.ts
async function readUrlsWithGemini(params) {
  const { urls, question, subject } = params;
  if (!urls || urls.length === 0) {
    return { answer: "No URLs provided.", sources: [] };
  }
  const ai9 = getAIClient();
  const model = process.env.GEMINI_URL_CONTEXT_MODEL || "gemini-2.5-flash";
  let fetchedContext = "";
  const sources = [];
  for (const url of urls.slice(0, 20)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5e3);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        fetchedContext += `
--- Content from ${url} ---
${text.substring(0, 1e4)}
`;
        sources.push({ title: "Fetched URL", url, status: "success" });
      } else {
        sources.push({ url, status: "failed" });
      }
    } catch (e) {
      sources.push({ url, status: "failed" });
    }
  }
  const promptText = `
Subject Context: ${subject || "General"}
User Question: ${question}

Context from URLs:
${fetchedContext}

Please answer the user's question based on the provided URL context. If the text is raw HTML or noisy, extract the relevant information. Answer in Sinhala if the question implies it.
  `;
  try {
    const response = await ai9.models.generateContent({
      model,
      contents: promptText,
      config: {
        temperature: 0.3
      }
    });
    return {
      answer: response.text || "Failed to generate answer.",
      sources
    };
  } catch (error) {
    console.error("URL Context error:", error);
    return {
      answer: "Could not read the provided URLs or generate an answer.",
      sources
    };
  }
}
var init_urlContext = __esm({
  "server/ai/tools/urlContext.ts"() {
    "use strict";
    init_client();
  }
});

// server/ai/tools/googleSearchGrounding.ts
async function groundedSearch(query, options) {
  try {
    const ai9 = getAIClient();
    const model = process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash";
    let enhancedQuery = query;
    if (options?.language === "si") {
      enhancedQuery += " (Please provide answer in Sinhala if possible)";
    }
    const response = await ai9.models.generateContent({
      model,
      contents: enhancedQuery,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2
      }
    });
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const searchChunks = groundingMetadata?.groundingChunks || [];
    const sources = searchChunks.map((chunk) => {
      const web = chunk.web || chunk.webSource;
      return {
        title: web?.title || "Web Search Result",
        url: web?.uri || web?.url || "",
        snippet: web?.snippet || "",
        confidence: 0.9
      };
    }).filter((s) => s.url);
    return {
      summary: response.text || "No summary provided.",
      sources,
      rawGroundingMetadata: groundingMetadata
    };
  } catch (error) {
    console.error("Grounded search error:", error);
    return {
      summary: "Search tool temporarily unavailable.",
      sources: []
    };
  }
}
var init_googleSearchGrounding = __esm({
  "server/ai/tools/googleSearchGrounding.ts"() {
    "use strict";
    init_client();
  }
});

// server/knowledge/conversationState.ts
async function getConversationState(uid) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("state").doc("conversation");
  const doc = await ref.get();
  if (doc.exists) {
    return doc.data();
  }
  const defaultState = {
    uid,
    conversationId: "conv_" + Date.now(),
    activeLessonIds: [],
    activeSourceIds: [],
    selectedSourceId: null,
    selectedQuestionId: null,
    currentQuestionIndex: null,
    requestedResourceType: null,
    evidenceMode: "strict",
    allowGeneratedContent: false,
    lastIntent: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await ref.set(defaultState);
  return defaultState;
}
async function updateConversationState(uid, updates) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("state").doc("conversation");
  const currentState = await getConversationState(uid);
  const newState = {
    ...currentState,
    ...updates,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await ref.set(newState);
  return newState;
}
var init_conversationState = __esm({
  "server/knowledge/conversationState.ts"() {
    "use strict";
    init_admin();
  }
});

// server/ai-core/intent/paperQuestionParser.ts
var paperQuestionParser_exports = {};
__export(paperQuestionParser_exports, {
  detectOfficialPaperCandidate: () => detectOfficialPaperCandidate,
  normalizeSubject: () => normalizeSubject,
  parsePaperQuestionIntent: () => parsePaperQuestionIntent
});
function normalizeSubject(input) {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return null;
  const isSft = /\b(SFT|SCIENCE FOR TECHNOLOGY|තාක්ෂණවේදය සඳහා විද්‍යාව|තාක්ෂණවේදය සඳහා විද්යාව|තාක්ෂණවේදය|S\.F\.T)\b/i.test(s);
  const isEt = /\b(ET|ENGINEERING TECHNOLOGY|ඉංජිනේරු තාක්ෂණවේදය|ඉංජිනේරු තාක්ෂණය|E\.T)\b/i.test(s);
  const isIct = /\b(ICT|INFORMATION AND COMMUNICATION TECHNOLOGY|තොරතුරු හා සන්නිවේදන තාක්ෂණය|තොරතුරු සන්නිවේදන තාක්ෂණය|තොරතුරු හා සන්නිවේදන|I\.C\.T)\b/i.test(s);
  if (isSft) return "SFT";
  if (isEt) return "ET";
  if (isIct) return "ICT";
  return null;
}
function detectOfficialPaperCandidate(prompt, activeSubject) {
  const promptLower = prompt.toLowerCase();
  const yearMatch = prompt.match(/\b(20\d{2})\b/);
  let year = yearMatch ? yearMatch[1] : null;
  let questionType = null;
  if (promptLower.includes("mcq") || promptLower.includes("\u0DB6\u0DC4\u0DD4\u0DC0\u0DBB\u0DAB")) questionType = "MCQ";
  else if (promptLower.includes("structured essay") || promptLower.includes("structured") || promptLower.includes("\u0DC0\u0DCA\u200D\u0DBA\u0DD4\u0DC4\u0D9C\u0DAD")) questionType = "Structured";
  else if (promptLower.includes("essay") || promptLower.includes("\u0DBB\u0DA0\u0DB1\u0DCF")) questionType = "Essay";
  let questionNo = null;
  const mcqNoMatch = prompt.match(/\bmcq\s*[-_]?\s*(\d+)\b/i);
  const numberBeforeMcqMatch = prompt.match(/\b(\d{1,2})\s*(?:(?:වෙනි|වැනි|weni|th|st|nd|rd)\s*)?mcq\b/i);
  const qNoMatch = prompt.match(/(?:question|q|ප්‍රශ්න|ප්‍රශ්නය|අංක|no)\s*(\d+)/i) || prompt.match(/\b(\d+)\s*(?:වෙනි|වැනි|th|st|nd|rd)\b/i) || prompt.match(/\b(?:පළවෙනි|පළමු|දෙවෙනි|දෙවන|තුන්වෙනි|හතරවෙනි|පස්වෙනි|හයවෙනි|හත්වෙනි|අටවෙනි|නවවෙනි|දහවෙනි|first|second|third)\b/i);
  if (mcqNoMatch) {
    questionNo = mcqNoMatch[1];
  } else if (numberBeforeMcqMatch) {
    questionNo = numberBeforeMcqMatch[1];
  } else if (qNoMatch) {
    let val = qNoMatch[1] || qNoMatch[0].toLowerCase();
    if (val.includes("\u0DB4\u0DC5\u0DC0\u0DD9\u0DB1\u0DD2") || val.includes("\u0DB4\u0DC5\u0DB8\u0DD4") || val.includes("first")) questionNo = "1";
    else if (val.includes("\u0DAF\u0DD9\u0DC0\u0DD9\u0DB1\u0DD2") || val.includes("\u0DAF\u0DD9\u0DC0\u0DB1") || val.includes("second")) questionNo = "2";
    else if (val.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || val.includes("third")) questionNo = "3";
    else if (val.includes("\u0DC4\u0DAD\u0DBB\u0DC0\u0DD9\u0DB1\u0DD2") || val.includes("fourth")) questionNo = "4";
    else if (val.includes("\u0DB4\u0DC3\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || val.includes("fifth")) questionNo = "5";
    else if (!isNaN(parseInt(val))) questionNo = val;
    else questionNo = "1";
  } else {
    const allNumbers = prompt.match(/\b([1-9]|10)\b/g);
    if (allNumbers && allNumbers.length === 1 && allNumbers[0] !== year) {
      questionNo = allNumbers[0];
    }
  }
  const hasAnswerIntent = /\b(answers?|uththara|පිළිතුරු|hdn heti|explain)\b/i.test(promptLower);
  let parsedSubject = normalizeSubject(prompt);
  let subject = parsedSubject || normalizeSubject(activeSubject || "") || null;
  const isOfficialPaperCandidate = !!(year && (parseInt(year) >= 2015 && parseInt(year) <= 2026) && questionNo && (questionType || hasAnswerIntent || promptLower.includes("paper")));
  const needsSubjectClarification = isOfficialPaperCandidate && !subject;
  return {
    isOfficialPaperCandidate,
    year,
    subject,
    questionNo,
    questionType: questionType || "MCQ",
    // default if unknown
    needsSubjectClarification
  };
}
function parsePaperQuestionIntent(prompt) {
  const candidate = detectOfficialPaperCandidate(prompt);
  let confidence = 0;
  if (candidate.isOfficialPaperCandidate) confidence += 0.5;
  if (candidate.questionType) confidence += 0.3;
  if (prompt.toLowerCase().includes("paper") || prompt.toLowerCase().includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA")) confidence += 0.2;
  return {
    isPaperQuestion: candidate.isOfficialPaperCandidate && !!candidate.subject,
    year: candidate.year,
    subject: candidate.subject,
    questionType: candidate.questionType,
    questionNo: candidate.questionNo,
    strictOfficialPaper: candidate.isOfficialPaperCandidate && !!candidate.subject && confidence > 0.7,
    confidence
  };
}
var init_paperQuestionParser = __esm({
  "server/ai-core/intent/paperQuestionParser.ts"() {
    "use strict";
  }
});

// server/ai-core/sources/sourceNormalizer.ts
var normalizeSubject2;
var init_sourceNormalizer = __esm({
  "server/ai-core/sources/sourceNormalizer.ts"() {
    "use strict";
    init_paperQuestionParser();
    normalizeSubject2 = normalizeSubject;
  }
});

// server/ai-core/sources/sourceResolver.ts
var sourceResolver_exports = {};
__export(sourceResolver_exports, {
  getSourceScore: () => getSourceScore,
  resolveStrictSource: () => resolveStrictSource
});
function getSourceScore(src, params) {
  const { year, subject, activeSourceId, prompt, expectedResourceType } = params;
  const promptLower = prompt.toLowerCase();
  let score = 0;
  const srcId = src.sourceId || src.id;
  const textToScan = ((src.title || "") + " " + (src.fileName || "")).toLowerCase();
  const srcNormSub = normalizeSubject2(src.subject || src.title);
  const srcYearStr = src.year ? String(src.year) : src.title.match(/\b(20\d{2})\b/)?.[1] || null;
  if (activeSourceId && srcId === activeSourceId) score += 100;
  if (src.storagePath) score += 50;
  else if (src.downloadUrl || src.firebaseDownloadUrl || src.url) score += 35;
  if (subject) {
    if (srcNormSub === subject) {
      score += 100;
    } else if (srcNormSub) {
      score -= 1e3;
    }
  }
  if (year) {
    if (srcYearStr === year) {
      score += 100;
    } else if (srcYearStr) {
      score -= 1e3;
    }
  }
  const isPastPaper = src.resourceType === "past_paper" || textToScan.includes("past paper") || textToScan.includes("\u0DC0\u0DD2\u0DB7\u0DCF\u0D9C");
  if (isPastPaper) score += 80;
  const isMarking = src.resourceType === "marking_scheme" || textToScan.includes("marking") || textToScan.includes("\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4");
  if (isMarking) score += 60;
  if (expectedResourceType === "past_paper") {
    score += isPastPaper && !isMarking ? 120 : -180;
  } else if (expectedResourceType === "marking_scheme") {
    score += isMarking ? 140 : -180;
  }
  const isPaperQuestion = promptLower.includes("paper") || promptLower.includes("mcq") || year && !promptLower.includes("lesson");
  if (isPaperQuestion) {
    const isTute = textToScan.includes("tute") || textToScan.includes("lesson") || textToScan.includes("revision") || textToScan.includes("\u0DB4\u0DCF\u0DA9\u0DB8");
    if (isTute) score -= 500;
  }
  return score;
}
function resolveStrictSource(sources, params) {
  const allScored = sources.map((s) => ({
    source: s,
    score: getSourceScore(s, params)
  }));
  const scored = allScored.filter((s) => s.score > 50);
  const rejected = allScored.filter((s) => s.score <= 50).map((s) => ({
    sourceId: s.source.sourceId || s.source.id,
    title: s.source.title,
    score: s.score,
    reason: s.score < -400 ? "Mismatch (Year/Subject/Type)" : "Low relevance score"
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const sourceLocked = !!(best && best.score >= 180);
  const selectedSourceId = best?.source ? best.source.sourceId || best.source.id : null;
  return {
    sourceFound: !!best,
    selectedSource: best?.source || null,
    selectedSourceId,
    confidence: best ? Math.min(best.score / 300, 1) : 0,
    sourceLocked,
    allowedSourceIds: sourceLocked ? [selectedSourceId] : scored.map((s) => s.source.sourceId || s.source.id),
    rejectedSources: rejected
  };
}
var init_sourceResolver = __esm({
  "server/ai-core/sources/sourceResolver.ts"() {
    "use strict";
    init_sourceNormalizer();
  }
});

// server/knowledge/evidenceRetrieval.ts
async function retrieveEvidence(uid, prompt, route, policy, activeConversationState) {
  const lower = prompt.toLowerCase();
  let intent = policy.intent || route.mode;
  let subject = route.entities?.subject || activeConversationState?.activeSubject || "SFT";
  let lessonIds = activeConversationState?.activeLessonIds || [];
  let selectedSource = null;
  let selectedQuestion = null;
  let candidates = [];
  let evidenceStatus = "not_found";
  let exactTextBlocks = [];
  let allowedSourceIds = activeConversationState?.activeSourceIds || [];
  let allowAnswerGeneration = !policy.requireEvidence;
  let allowModelQuestionGeneration = intent === "model_question_generation";
  if (policy.requireEvidence) {
    const inventory = await getSourceInventory({ uid, subject, isAdmin: false });
    const allAvailableSources = [...inventory.groups.pastPapers, ...inventory.groups.markingSchemes, ...inventory.groups.syllabus, ...inventory.groups.uploadedPdfs, ...inventory.groups.paperStructure];
    if (isLessonEvidenceMode(intent)) {
      const lessonMatch = findLessonSources(allAvailableSources, prompt, route.entities?.lesson || activeConversationState?.activeLessonIds?.[0]);
      lessonIds = lessonMatch.reference ? [lessonMatch.reference.label] : [];
      candidates = lessonMatch.sources;
      const indexedMatches = lessonMatch.sources.filter((source) => source.textIndexed || Number(source.chunkCount || 0) > 0);
      if (indexedMatches.length > 0) {
        selectedSource = indexedMatches[0];
        allowedSourceIds = indexedMatches.map((source) => source.sourceId || source.id).filter(Boolean);
        evidenceStatus = "verified";
        allowAnswerGeneration = true;
      } else if (lessonMatch.sources.length > 0) {
        selectedSource = lessonMatch.sources[0];
        allowedSourceIds = lessonMatch.sources.map((source) => source.sourceId || source.id).filter(Boolean);
        evidenceStatus = lessonMatch.sources.some((source) => source.needsOcr) ? "ocr_required" : "index_required";
        allowAnswerGeneration = false;
      }
    }
    const requestedYear = route.entities?.year;
    const strictRes = isLessonEvidenceMode(intent) ? { selectedSource: null } : resolveStrictSource(allAvailableSources, {
      year: requestedYear,
      subject,
      activeSourceId: activeConversationState?.selectedSourceId || null,
      prompt
    });
    if (intent === "continue_grounded_discussion" && activeConversationState?.selectedSourceId) {
      selectedSource = allAvailableSources.find((s) => s.id === activeConversationState.selectedSourceId || s.sourceId === activeConversationState.selectedSourceId);
      if (selectedSource) {
        evidenceStatus = "verified";
        allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
        allowAnswerGeneration = true;
      }
    }
    if (strictRes.selectedSource) {
      selectedSource = strictRes.selectedSource;
      evidenceStatus = "verified";
      allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
      allowAnswerGeneration = true;
    } else if (!isLessonEvidenceMode(intent)) {
      if (allAvailableSources.length > 0) {
        const matches = allAvailableSources.filter((s) => {
          if (requestedYear && s.year !== requestedYear) return false;
          if (subject && s.subject !== subject) return false;
          return true;
        });
        if (matches.length > 0) {
          selectedSource = matches[0];
          evidenceStatus = "verified";
          allowedSourceIds = [selectedSource.id || selectedSource.sourceId];
          allowAnswerGeneration = true;
        }
      }
    }
  }
  return {
    intent,
    subject,
    lessonIds,
    selectedSource,
    selectedQuestion,
    candidates,
    evidenceStatus,
    exactTextBlocks,
    allowedSourceIds,
    allowAnswerGeneration,
    allowModelQuestionGeneration
  };
}
var init_evidenceRetrieval = __esm({
  "server/knowledge/evidenceRetrieval.ts"() {
    "use strict";
    init_sourceResolver();
    init_sourceInventoryService();
    init_lessonResolver();
  }
});

// server/ai/modelRouter.ts
function setLastOk(ok, err = null) {
  lastOk = ok;
  lastError = err;
}
function getModelForTask(task) {
  switch (task) {
    case "direct_pdf_extract":
      return {
        primary: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash",
        fallback: process.env.GEMINI_PDF_QA_FALLBACK || "gemini-3.5-flash"
      };
    case "direct_pdf_solve":
      return {
        primary: process.env.GEMINI_PDF_QA_MODEL || process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash",
        fallback: process.env.GEMINI_PDF_QA_FALLBACK || "gemini-2.5-flash"
      };
    case "final_answer":
      return {
        primary: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview",
        fallback: process.env.GEMINI_FINAL_FALLBACK || "gemini-3.1-pro-preview"
      };
    case "normal_chat":
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: "gemini-3.5-flash"
      };
    case "fast_background":
      return {
        primary: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash"
      };
    case "embeddings":
      return {
        primary: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
        fallback: "text-embedding-004"
      };
    case "image_understanding":
      return {
        primary: process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash",
        fallback: "gemini-3.5-flash"
      };
    case "ocr":
      return {
        primary: process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash",
        fallback: "gemini-3.5-flash"
      };
    case "tts":
      return {
        primary: process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview"
      };
    case "image_generation":
      return {
        primary: process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002"
      };
    default:
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash"
      };
  }
}
async function callGeminiWithFallback(task, payload, aiClient) {
  assertAiAvailable();
  const models = getModelForTask(task);
  const client2 = aiClient || getAIClient();
  try {
    console.log(`[modelRouter] Attempting primary model ${models.primary} for task ${task}`);
    payload.model = models.primary;
    const result = await client2.models.generateContent(payload);
    if (task === "normal_chat") {
      lastOk = true;
      lastError = null;
    }
    return { result, modelUsed: models.primary };
  } catch (err) {
    if (task === "normal_chat") {
      lastOk = false;
      lastError = err.message || String(err);
    }
    console.warn(`[modelRouter] Primary model ${models.primary} failed for task ${task}: ${err.message}`);
    const classification = classifyAiError(err);
    if (classification.code === "AI_BILLING_EXHAUSTED") {
      openAiBillingCircuit(err);
      const e = new Error(classification.userMessage);
      e.code = "AI_BILLING_EXHAUSTED";
      e.status = 429;
      e.retryable = false;
      throw e;
    }
    const isRetryable = classification.retryable && (err.status === 404 || err.status >= 500);
    if (isRetryable && models.fallback) {
      console.log(`[modelRouter] Falling back to model ${models.fallback} for task ${task}`);
      try {
        payload.model = models.fallback;
        const result = await client2.models.generateContent(payload);
        return { result, modelUsed: models.fallback, warning: `Primary model unavailable, used fallback ${models.fallback}` };
      } catch (fallbackErr) {
        console.error(`[modelRouter] Fallback model ${models.fallback} also failed: ${fallbackErr.message}`);
        const fallbackClassification = classifyAiError(fallbackErr);
        if (fallbackClassification.code === "AI_BILLING_EXHAUSTED") {
          openAiBillingCircuit(fallbackErr);
          const e = new Error(fallbackClassification.userMessage);
          e.code = "AI_BILLING_EXHAUSTED";
          e.status = 429;
          e.retryable = false;
          throw e;
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}
async function generateContentStreamWithFallback(task, payload, aiClient, signal) {
  assertAiAvailable();
  const models = getModelForTask(task);
  const client2 = aiClient || getAIClient();
  try {
    console.log(`[modelRouter] Attempting stream with primary model ${models.primary} for task ${task}`);
    payload.model = models.primary;
    if (signal) {
      payload.config = payload.config || {};
      payload.abortSignal = signal;
    }
    const stream = await client2.models.generateContentStream(payload);
    if (task === "normal_chat") {
      lastOk = true;
      lastError = null;
    }
    return { stream, modelUsed: models.primary };
  } catch (err) {
    if (task === "normal_chat") {
      lastOk = false;
      lastError = err.message || String(err);
    }
    console.warn(`[modelRouter] Primary model ${models.primary} stream failed for task ${task}: ${err.message}`);
    const classification = classifyAiError(err);
    if (classification.code === "AI_BILLING_EXHAUSTED") {
      openAiBillingCircuit(err);
      const e = new Error(classification.userMessage);
      e.code = "AI_BILLING_EXHAUSTED";
      e.status = 429;
      e.retryable = false;
      throw e;
    }
    const isRetryable = classification.retryable && (err.status === 404 || err.status >= 500);
    if (isRetryable && models.fallback) {
      console.log(`[modelRouter] Falling back stream to model ${models.fallback} for task ${task}`);
      try {
        payload.model = models.fallback;
        if (signal) {
          payload.config = payload.config || {};
          payload.abortSignal = signal;
        }
        const stream = await client2.models.generateContentStream(payload);
        return { stream, modelUsed: models.fallback, warning: `Primary model unavailable, used fallback ${models.fallback}` };
      } catch (fallbackErr) {
        console.error(`[modelRouter] Fallback stream model ${models.fallback} also failed: ${fallbackErr.message}`);
        const fallbackClassification = classifyAiError(fallbackErr);
        if (fallbackClassification.code === "AI_BILLING_EXHAUSTED") {
          openAiBillingCircuit(fallbackErr);
          const e = new Error(fallbackClassification.userMessage);
          e.code = "AI_BILLING_EXHAUSTED";
          e.status = 429;
          e.retryable = false;
          throw e;
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}
var lastOk, lastError;
var init_modelRouter = __esm({
  "server/ai/modelRouter.ts"() {
    "use strict";
    init_client();
    init_aiCircuitBreaker();
    init_aiErrorClassifier();
    lastOk = false;
    lastError = null;
    if (process.env.GEMINI_DEFAULT_MODEL && (process.env.GEMINI_DEFAULT_MODEL.includes("pro") || process.env.GEMINI_DEFAULT_MODEL.includes("preview"))) {
      process.env.GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
    }
    if (!process.env.GEMINI_DEFAULT_MODEL) {
      process.env.GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
    }
    if (!process.env.GEMINI_FAST_MODEL) {
      process.env.GEMINI_FAST_MODEL = "gemini-3.5-flash";
    }
    if (!process.env.GEMINI_PDF_QA_MODEL) {
      process.env.GEMINI_PDF_QA_MODEL = "gemini-3.5-flash";
    }
    if (!process.env.GEMINI_PDF_QA_FALLBACK) {
      process.env.GEMINI_PDF_QA_FALLBACK = "gemini-2.5-flash";
    }
    if (!process.env.GEMINI_FINAL_MODEL) {
      process.env.GEMINI_FINAL_MODEL = "gemini-3.1-pro-preview";
    }
    if (!process.env.GEMINI_FINAL_FALLBACK) {
      process.env.GEMINI_FINAL_FALLBACK = "gemini-2.5-pro";
    }
    if (!process.env.GEMINI_LITE_MODEL) {
      process.env.GEMINI_LITE_MODEL = "gemini-3.1-flash-lite";
    }
  }
});

// server/ai/answerPolicy.ts
function resolveAnswerPolicy(prompt, route, activeSubject, attachments) {
  const p = prompt.toLowerCase();
  if (p.includes("suicide") || p.includes("kill") || p.includes("hack") || p.includes("illegal")) {
    return {
      intent: "blocked_or_unsafe",
      allowSources: false,
      allowedSourceTypes: [],
      requireEvidence: false,
      allowVisuals: false,
      maxAnswerStyle: "concise",
      shouldUseStudentContext: false,
      shouldUseSyllabus: false,
      blockingMessage: "I cannot assist with that request. Please seek professional help if you are in distress."
    };
  }
  if (p.includes("debug") && p.includes("developer")) {
    return {
      intent: "developer_debug",
      allowSources: false,
      allowedSourceTypes: [],
      requireEvidence: false,
      allowVisuals: false,
      maxAnswerStyle: "detailed",
      shouldUseStudentContext: false,
      shouldUseSyllabus: false
    };
  }
  if (["lesson_pdf_search", "lesson_question_discussion", "lesson_theory_explanation", "past_paper_lesson_search"].includes(route?.mode)) {
    return {
      intent: route.mode,
      allowSources: true,
      allowedSourceTypes: route.mode === "past_paper_lesson_search" ? ["past_paper", "marking_scheme", "paper_structure"] : ["uploaded_pdf", "paper_structure", "notes", "past_paper", "marking_scheme"],
      requireEvidence: true,
      allowVisuals: true,
      maxAnswerStyle: "exam_style",
      shouldUseStudentContext: true,
      shouldUseSyllabus: false
    };
  }
  const isOfficialPaper = (p.includes("mcq") || p.includes("essay") || p.includes("structured") || p.includes("q") || p.includes("prashna") || p.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1") || p.includes("marking scheme") || p.includes("answer") || p.includes("\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4")) && p.match(/\b(201\d|202\d)\b/) || route?.mode === "paper_question_qa";
  if (isOfficialPaper) {
    return {
      intent: "official_paper_question",
      allowSources: true,
      allowedSourceTypes: ["past_paper", "marking_scheme"],
      requireEvidence: true,
      allowVisuals: p.includes("diagram") || p.includes("graph") || p.includes("waguwa") || p.includes("\u0DBB\u0DD6\u0DB4"),
      maxAnswerStyle: "exam_style",
      shouldUseStudentContext: false,
      shouldUseSyllabus: false
    };
  }
  if (route?.mode === "direct_pdf_solve" || attachments && attachments.length > 0 || p.includes("paper eke") || p.includes("meke") || p.includes("upload") || p.includes("\u0DB8\u0DD9\u0DB8 pdf")) {
    return {
      intent: "uploaded_pdf_question",
      allowSources: true,
      allowedSourceTypes: ["uploaded_pdf", "chat_upload"],
      requireEvidence: true,
      allowVisuals: true,
      maxAnswerStyle: "detailed",
      shouldUseStudentContext: true,
      shouldUseSyllabus: false
    };
  }
  if (p.includes("tired") || p.includes("focus") || p.includes("motivate") || p.includes("fear") || p.includes("kammali") || p.includes("epa wela") || p.includes("baya") || p.includes("ba wage") || p.includes("mahansi") || p.includes("padam karanna")) {
    return {
      intent: "student_support",
      allowSources: false,
      allowedSourceTypes: [],
      requireEvidence: false,
      allowVisuals: false,
      maxAnswerStyle: "concise",
      shouldUseStudentContext: true,
      shouldUseSyllabus: false
    };
  }
  if (p.includes("facebook") || p.includes("youtube") || p.includes("pc ") || p.includes("money") || p.includes("girlfriend") || p.includes("boyfriend")) {
    return {
      intent: "general_non_syllabus",
      allowSources: false,
      allowedSourceTypes: [],
      requireEvidence: false,
      allowVisuals: false,
      maxAnswerStyle: "concise",
      shouldUseStudentContext: false,
      shouldUseSyllabus: false
    };
  }
  return {
    intent: "syllabus_lesson_explanation",
    allowSources: true,
    allowedSourceTypes: ["syllabus", "textbook", "notes", "past_paper"],
    requireEvidence: false,
    allowVisuals: true,
    maxAnswerStyle: "detailed",
    shouldUseStudentContext: true,
    shouldUseSyllabus: true
  };
}
var init_answerPolicy = __esm({
  "server/ai/answerPolicy.ts"() {
    "use strict";
  }
});

// server/sources/sourceScoring.ts
function scoreSource(source, request) {
  let score = 0;
  if (request.subject && source.subject === request.subject) score += 40;
  else if (request.subject && source.subject !== request.subject) score -= 50;
  if (request.year && source.year === request.year) score += 30;
  else if (request.year && source.year && source.year !== request.year) score -= 40;
  if (request.resourceType && source.resourceType === request.resourceType) score += 25;
  else if (request.resourceType && source.resourceType && source.resourceType !== request.resourceType) score -= 40;
  if (request.paperType && source.paperType === request.paperType) score += 20;
  if (request.keywords && request.keywords.length > 0 && source.title) {
    const titleLower = source.title.toLowerCase();
    for (const kw of request.keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        score += 15;
      }
    }
  }
  if (request.ownerUid && source.ownerUid === request.ownerUid) score += 10;
  if (!source.storagePath && !source.url) score -= 30;
  if (source.sourceScope === "irrelevant") score -= 30;
  return score;
}
var init_sourceScoring = __esm({
  "server/sources/sourceScoring.ts"() {
    "use strict";
  }
});

// server/ai/selectedPdfFollowup.ts
function parseSelectedPdfQuestionFollowup(prompt) {
  const text = String(prompt || "").trim().toLowerCase();
  if (!text || text.length > 80) return null;
  const explicit = text.match(/\b(?:mcq|q|question|prashna|prasna)\s*[-:#]?\s*0*(\d{1,3})\b/i);
  const ordinal = text.match(/\b0*(\d{1,3})(?:st|nd|rd|th)\b/i);
  const numericOnly = text.match(/^0*(\d{1,3})$/);
  const sinhalaOrdinal = text.match(/(?:^|\s)0*(\d{1,3})\s*(?:වෙනි|වැනි)(?:\s|$)/);
  const firstWord = text.match(/(?:^|\s)(?:first|පළමු)(?:\s+(?:mcq|q|question|ප්‍රශ්නය))?(?:\s|$)/i);
  const match = explicit || ordinal || numericOnly || sinhalaOrdinal;
  if (firstWord && !match) {
    return {
      questionNo: "1",
      questionType: /essay|structured|රචනා/i.test(text) ? "ESSAY" : "MCQ"
    };
  }
  if (!match) return null;
  const questionNo = String(Number(match[1]));
  if (!questionNo || questionNo === "0") return null;
  return {
    questionNo,
    questionType: /essay|structured|රචනා/i.test(text) ? "ESSAY" : "MCQ"
  };
}
var init_selectedPdfFollowup = __esm({
  "server/ai/selectedPdfFollowup.ts"() {
    "use strict";
  }
});

// shared/text/assistantText.ts
function normalizeSinhalaUnicode(value) {
  return String(value ?? "").normalize("NFC").replace(/\u0DCA[\u200C\uFEFF]+(?=[\u0DBA\u0DBB])/g, "\u0DCA\u200D").replace(/\u0DCA(?!\u200D)(?=[\u0DBA\u0DBB])/g, "\u0DCA\u200D").replace(/\u0DCA\u200D{2,}/g, "\u0DCA\u200D").replace(/(^|[\s\n])\u0DCA+(?=[\u0D80-\u0DFF])/g, "$1").replace(/([\u0D80-\u0DFF])\uFEFF(?=[\u0D80-\u0DFF])/g, "$1");
}
function normalizeComparable(value) {
  return value.toLowerCase().replace(/[*_#>`~\-–—:;,.!?()[\]{}|]/g, " ").replace(/\s+/g, " ").trim();
}
function removeRepeatedParagraphs(value) {
  const blocks = value.split(/\n{2,}/);
  const seen = /* @__PURE__ */ new Set();
  const kept = [];
  for (const block of blocks) {
    const key = normalizeComparable(block);
    if (key.length >= 80 && seen.has(key)) continue;
    if (key.length >= 80) seen.add(key);
    kept.push(block.trim());
  }
  return kept.filter(Boolean).join("\n\n");
}
function cleanAssistantResponse(value) {
  let text = normalizeSinhalaUnicode(value).replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").replace(/^\s*(?:#{1,6}\s*)?(?:\*\*|__|_)?(?:reasoning|chain of thought|thought process|internal reasoning)(?:\*\*|__|_)?\s*(?:[:,\-–—]\s*)?/gim, "").replace(/^\s*(?:\*\*|__)?source(?:s)?(?:\*\*|__)?\s*:\s*.*$/gim, "").replace(/^\s*exact pdf evidence\s*.*$/gim, "").replace(/^\s*_{1,2}reasoning_{1,2}\s*(?:[:,\-–—]\s*)?/gim, "").replace(/\n{3,}/g, "\n\n").trim();
  text = removeRepeatedParagraphs(text);
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
var init_assistantText = __esm({
  "shared/text/assistantText.ts"() {
    "use strict";
  }
});

// server/ai-core/memory/chatSanitizer.ts
var chatSanitizer_exports = {};
__export(chatSanitizer_exports, {
  removeUndefinedDeep: () => removeUndefinedDeep,
  sanitizeSource: () => sanitizeSource
});
function removeUndefinedDeep(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep);
  }
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== void 0) {
        result[key] = removeUndefinedDeep(value);
      }
    }
  }
  return result;
}
function sanitizeSource(source) {
  if (!source) return null;
  const sanitized = { ...source };
  if (sanitized.url === void 0) {
    sanitized.url = null;
  }
  return removeUndefinedDeep(sanitized);
}
var init_chatSanitizer = __esm({
  "server/ai-core/memory/chatSanitizer.ts"() {
    "use strict";
  }
});

// server/ai-core/quiz/paperMcqQuiz.ts
var paperMcqQuiz_exports = {};
__export(paperMcqQuiz_exports, {
  attachPaperMcqQuizQuestion: () => attachPaperMcqQuizQuestion,
  beginPaperMcqQuiz: () => beginPaperMcqQuiz,
  detectPaperMcqQuizStart: () => detectPaperMcqQuizStart,
  evaluatePaperMcqQuizAnswer: () => evaluatePaperMcqQuizAnswer,
  formatPaperMcqQuizQuestion: () => formatPaperMcqQuizQuestion,
  getActivePaperMcqQuiz: () => getActivePaperMcqQuiz,
  parsePaperMcqQuizAction: () => parsePaperMcqQuizAction
});
function normalizeSubjectText(value) {
  const text = value.toUpperCase();
  if (/\bSFT\b|SCIENCE\s+FOR\s+TECHNOLOGY|තාක්ෂණවේදය\s+සඳහා\s+විද්‍යාව/i.test(text)) return "SFT";
  if (/\bET\b|ENGINEERING\s+TECHNOLOGY|ඉංජිනේරු\s+තාක්ෂණවේදය/i.test(text)) return "ET";
  if (/\bICT\b|INFORMATION\s+(?:AND|&)\s+COMMUNICATION\s+TECHNOLOGY|තොරතුරු\s+හා\s+සන්නිවේදන/i.test(text)) return "ICT";
  return null;
}
function detectPaperMcqQuizStart(prompt, activeSubject) {
  const text = normalizeSinhalaUnicode(prompt).trim();
  const lower = text.toLowerCase();
  const year = text.match(/\b(20\d{2})\b/)?.[1] || null;
  const subject = normalizeSubjectText(text) || normalizeSubjectText(String(activeSubject || ""));
  const hasMcq = /\bmcq\b|බහුවරණ/i.test(text);
  const hasQuizFlow = /one\s*by\s*one|එකින්\s*එක|එක\s*එක|පිළිවෙළින්|wrdina|වැරදි|error\s*(?:log|book)|quiz/i.test(lower);
  const range = text.match(/\b([1-9]|[1-4]\d|50)\s*(?:සිට|ඉඳන්|ඉදන්|idn|indn|to|through|[-–—])\s*([1-9]|[1-4]\d|50)\b/i);
  if (!year || !subject || !hasMcq || !hasQuizFlow || !range) return null;
  const startQuestionNo = Number(range[1]);
  const endQuestionNo = Number(range[2]);
  if (startQuestionNo < 1 || endQuestionNo > 50 || startQuestionNo > endQuestionNo) return null;
  return { isQuizStart: true, year, subject, startQuestionNo, endQuestionNo };
}
function comparable(value) {
  return normalizeSinhalaUnicode(value).toLowerCase().replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/, "").replace(/[\s*_#>`~\-–—:;,.!?()[\]{}|/\\]+/g, " ").trim();
}
function parsePaperMcqQuizAction(prompt, session) {
  const text = normalizeSinhalaUnicode(prompt).trim();
  const lower = text.toLowerCase();
  if (/^(?:stop|end|quit|cancel|නවත්වන්න|අවසන්|ඇති|එපා)$/i.test(lower)) return { kind: "stop" };
  if (/^(?:skip|pass|next|මඟහරින්න|පසුව|ඊළඟ)$/i.test(lower)) return { kind: "skip" };
  const numeric = text.match(/^\s*(?:(?:answer|option|ans|පිළිතුර)\s*[:=-]?\s*)?[\[(]?([1-5])[\])\].]?\s*$/i);
  if (numeric) return { kind: "answer", optionNo: numeric[1] };
  const answerText = comparable(text);
  if (answerText.length >= 2 && Array.isArray(session.options)) {
    const matches = session.options.map((option, index) => ({ optionNo: String(index + 1), text: comparable(option) })).filter((item) => item.text && (item.text === answerText || item.text.includes(answerText) || answerText.includes(item.text)));
    if (matches.length === 1) return { kind: "answer", optionNo: matches[0].optionNo };
  }
  return { kind: "invalid" };
}
async function getActivePaperMcqQuiz(uid) {
  const state = await getConversationState(uid);
  return state.quizSession?.active ? state.quizSession : null;
}
async function beginPaperMcqQuiz(params) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const quizSession = {
    active: true,
    sourceId: params.sourceId,
    storagePath: params.storagePath || null,
    downloadUrl: params.downloadUrl || null,
    title: params.title || null,
    year: params.year,
    subject: params.subject,
    questionType: "MCQ",
    startQuestionNo: params.startQuestionNo,
    endQuestionNo: params.endQuestionNo,
    currentQuestionNo: params.startQuestionNo,
    awaitingAnswer: false,
    expectedOptionNo: null,
    expectedOptionText: null,
    questionText: null,
    options: [],
    explanationSinhala: null,
    lesson: null,
    pageNumber: null,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    answeredCount: 0,
    startedAt: now,
    updatedAt: now
  };
  await updateConversationState(params.uid, {
    selectedSourceId: params.sourceId,
    currentQuestionIndex: params.startQuestionNo,
    lastIntent: "paper_mcq_quiz",
    quizSession
  });
  return quizSession;
}
function stripOptionPrefix(value, optionNo) {
  let text = normalizeSinhalaUnicode(value).trim();
  if (optionNo) {
    const escaped = optionNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*(?:\\(\\s*${escaped}\\s*\\)|${escaped}[.)])\\s*`), "");
  }
  return text.trim();
}
async function attachPaperMcqQuizQuestion(params) {
  const state = await getConversationState(params.uid);
  const current = state.quizSession;
  if (!current?.active || current.sourceId !== params.sourceId || current.currentQuestionNo !== params.questionNo) {
    return null;
  }
  const next = {
    ...current,
    awaitingAnswer: true,
    expectedOptionNo: params.optionNo,
    expectedOptionText: stripOptionPrefix(params.optionText || params.options[Number(params.optionNo) - 1] || "", params.optionNo),
    questionText: normalizeSinhalaUnicode(params.questionText).trim(),
    options: params.options.map((option) => normalizeSinhalaUnicode(option).trim()),
    explanationSinhala: params.explanationSinhala ? cleanAssistantResponse(params.explanationSinhala) : null,
    lesson: params.lesson ? normalizeSinhalaUnicode(params.lesson).trim() : null,
    pageNumber: params.pageNumber ?? null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await updateConversationState(params.uid, {
    currentQuestionIndex: params.questionNo,
    quizSession: next
  });
  return next;
}
function mistakeDocId(session) {
  const base = `${session.sourceId}_MCQ_${session.currentQuestionNo}`.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 180);
  return base || `mcq_${session.currentQuestionNo}`;
}
async function saveWrongMcqAttempt(uid, session, selectedOptionNo) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("mistake_notebook").doc(mistakeDocId(session));
  const now = /* @__PURE__ */ new Date();
  const nextRevision = new Date(now);
  nextRevision.setDate(nextRevision.getDate() + 1);
  const selectedText = stripOptionPrefix(session.options?.[Number(selectedOptionNo) - 1] || "", selectedOptionNo);
  const correctText = stripOptionPrefix(session.expectedOptionText || session.options?.[Number(session.expectedOptionNo || "0") - 1] || "", session.expectedOptionNo);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? snapshot.data() || {} : {};
    const sameErrorCount = Number(existing.sameErrorCount || 0) + 1;
    transaction.set(ref, removeUndefinedDeep({
      uid,
      subject: session.subject,
      lesson: session.lesson || `${session.year} ${session.subject} Past Paper MCQ`,
      errorText: `Q${session.currentQuestionNo}: ${session.questionText || ""}

Student answer: (${selectedOptionNo}) ${selectedText}
Correct answer: (${session.expectedOptionNo}) ${correctText}`.trim(),
      questionText: session.questionText || "",
      options: session.options || [],
      studentAnswer: selectedOptionNo,
      studentAnswerText: selectedText || null,
      correctAnswer: session.expectedOptionNo,
      correctAnswerText: correctText || null,
      explanationSinhala: session.explanationSinhala || null,
      sourceId: session.sourceId,
      sourceTitle: session.title || null,
      pageNumber: session.pageNumber ?? null,
      year: session.year,
      questionNo: session.currentQuestionNo,
      questionType: "MCQ",
      errorReason: `Selected option ${selectedOptionNo} instead of ${session.expectedOptionNo}.`,
      sameErrorCount,
      lastStudentAnswer: selectedOptionNo,
      lastAttemptAt: now.toISOString(),
      retryDate: nextRevision.toISOString(),
      nextRevisionAt: nextRevision.toISOString(),
      repeatCount: Number(existing.repeatCount || 0),
      mastered: false,
      createdAt: existing.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      autoSavedFromQuiz: true
    }), { merge: true });
  });
  return ref.id;
}
async function evaluatePaperMcqQuizAnswer(params) {
  const { uid, session, action } = params;
  if (!session.awaitingAnswer || !session.expectedOptionNo) {
    return {
      kind: "not_ready",
      message: "\u0DC0\u0DAD\u0DCA\u0DB8\u0DB1\u0DCA MCQ \u0D91\u0D9A \u0DAD\u0DC0\u0DB8 load \u0DC0\u0DD9\u0DBD\u0DCF \u0DB1\u0DD0\u0DC4\u0DD0. \u0D91\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA \u0DB1\u0DD0\u0DC0\u0DAD load \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.",
      session
    };
  }
  if (action.kind === "stop") {
    const closed = { ...session, active: false, awaitingAnswer: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await updateConversationState(uid, { quizSession: closed, lastIntent: "paper_mcq_quiz_stopped" });
    return { kind: "stopped", session: closed };
  }
  if (action.kind === "invalid") {
    return {
      kind: "invalid",
      message: `\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB \u0DBD\u0DD9\u0DC3 1, 2, 3, 4 \u0DC4\u0DDD 5 \u0DBA\u0DC0\u0DB1\u0DCA\u0DB1. Skip \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u201Cskip\u201D, \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u201Cstop\u201D \u0DBA\u0DC0\u0DB1\u0DCA\u0DB1.`,
      session
    };
  }
  const selectedOptionNo = action.kind === "skip" ? null : action.optionNo;
  const isCorrect = selectedOptionNo === session.expectedOptionNo;
  let mistakeId = null;
  if (selectedOptionNo && !isCorrect) {
    mistakeId = await saveWrongMcqAttempt(uid, session, selectedOptionNo);
  }
  const completedNo = session.currentQuestionNo;
  const nextQuestionNo = completedNo + 1;
  const finished = nextQuestionNo > session.endQuestionNo;
  const updated = {
    ...session,
    active: !finished,
    currentQuestionNo: finished ? completedNo : nextQuestionNo,
    awaitingAnswer: false,
    expectedOptionNo: null,
    expectedOptionText: null,
    questionText: null,
    options: [],
    explanationSinhala: null,
    lesson: null,
    pageNumber: null,
    correctCount: session.correctCount + (isCorrect ? 1 : 0),
    wrongCount: session.wrongCount + (selectedOptionNo && !isCorrect ? 1 : 0),
    skippedCount: session.skippedCount + (action.kind === "skip" ? 1 : 0),
    answeredCount: session.answeredCount + (selectedOptionNo ? 1 : 0),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await updateConversationState(uid, {
    currentQuestionIndex: finished ? null : nextQuestionNo,
    lastIntent: finished ? "paper_mcq_quiz_completed" : "paper_mcq_quiz",
    quizSession: updated
  });
  const correctText = stripOptionPrefix(session.expectedOptionText || "", session.expectedOptionNo);
  const explanation = cleanAssistantResponse(session.explanationSinhala || "");
  let feedback;
  if (action.kind === "skip") {
    feedback = `\u23ED\uFE0F **Q${completedNo} \u0DB8\u0D9F\u0DC4\u0DD0\u0DBB\u0DD2\u0DBA\u0DCF.**

**\u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB:** (${session.expectedOptionNo})${correctText ? ` ${correctText}` : ""}`;
  } else if (isCorrect) {
    feedback = `\u2705 **\u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2\u0DBA\u0DD2 \u2014 (${session.expectedOptionNo})${correctText ? ` ${correctText}` : ""}**`;
  } else {
    feedback = `\u274C **\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2\u0DBA\u0DD2. \u0D94\u0DB6\u0DDA \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB: (${selectedOptionNo})**

**\u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB:** (${session.expectedOptionNo})${correctText ? ` ${correctText}` : ""}

\u{1F4CC} \u0DB8\u0DD9\u0DB8 \u0DC0\u0DD0\u0DBB\u0DD0\u0DAF\u0DCA\u0DAF Error Log \u0D91\u0D9A\u0DA7 \u0DC3\u0DCA\u0DC0\u0DBA\u0D82\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA\u0DC0 \u0DC3\u0DD4\u0DBB\u0DD0\u0D9A\u0DD4\u0DAB\u0DCF.`;
  }
  if (explanation) feedback += `

${explanation}`;
  return {
    kind: finished ? "finished" : "continue",
    isCorrect,
    selectedOptionNo,
    correctOptionNo: session.expectedOptionNo,
    feedback,
    mistakeId,
    nextQuestionNo: finished ? null : nextQuestionNo,
    session: updated
  };
}
function formatPaperMcqQuizQuestion(params) {
  const questionText = normalizeSinhalaUnicode(params.questionText).trim();
  const options = Array.isArray(params.options) ? params.options.map((option) => normalizeSinhalaUnicode(option).trim()).filter(Boolean) : [];
  const optionLines = options.map((option, index) => {
    const clean = option.replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/, "");
    return `(${index + 1}) ${clean}`;
  });
  const progress = params.startQuestionNo === 1 && params.endQuestionNo === 50 ? `${params.questionNo}/50` : `${params.questionNo} (${params.startQuestionNo}\u2013${params.endQuestionNo})`;
  const blocks = [
    params.feedbackPrefix ? cleanAssistantResponse(params.feedbackPrefix) : "",
    `### ${params.year} ${params.subject} MCQ ${progress}`,
    questionText,
    optionLines.join("\n"),
    `**\u0D94\u0DB6\u0DDA \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB \u0DBD\u0DD9\u0DC3 1\u20135 \u0D85\u0DAD\u0DBB \u0D85\u0D82\u0D9A\u0DBA \u0DB4\u0DB8\u0DAB\u0D9A\u0DCA \u0DBA\u0DC0\u0DB1\u0DCA\u0DB1.**`
  ].filter(Boolean);
  return cleanAssistantResponse(blocks.join("\n\n"));
}
var init_paperMcqQuiz = __esm({
  "server/ai-core/quiz/paperMcqQuiz.ts"() {
    "use strict";
    init_admin();
    init_conversationState();
    init_assistantText();
    init_chatSanitizer();
  }
});

// server/ai/cancellation.ts
function registerRequest(requestId) {
  const controller = new AbortController();
  cancellationRegistry.set(requestId, controller);
  return controller;
}
function cancelRequest(requestId) {
  const controller = cancellationRegistry.get(requestId);
  if (controller) {
    controller.abort(new Error("USER_CANCELLED"));
    cancellationRegistry.delete(requestId);
  }
}
function unregisterRequest(requestId) {
  cancellationRegistry.delete(requestId);
}
var cancellationRegistry;
var init_cancellation = __esm({
  "server/ai/cancellation.ts"() {
    "use strict";
    cancellationRegistry = /* @__PURE__ */ new Map();
  }
});

// server/cost/usageTracker.ts
var usageTracker_exports = {};
__export(usageTracker_exports, {
  calculateGeminiCost: () => calculateGeminiCost,
  checkSpecificLimit: () => checkSpecificLimit,
  isDailyLimitExceeded: () => isDailyLimitExceeded,
  trackAIUsage: () => trackAIUsage
});
function getTodayString() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0].replace(/-/g, "");
}
function calculateGeminiCost(model, inputTokens, outputTokens) {
  const m = model.toLowerCase();
  if (m.includes("pro")) {
    return (inputTokens * 1.25 + outputTokens * 5) / 1e6;
  }
  if (m.includes("flash") && !m.includes("lite")) {
    return (inputTokens * 0.075 + outputTokens * 0.3) / 1e6;
  }
  if (m.includes("lite")) {
    return (inputTokens * 0.0375 + outputTokens * 0.15) / 1e6;
  }
  if (m.includes("embed")) {
    return (inputTokens + outputTokens) * 0.025 / 1e6;
  }
  return (inputTokens + outputTokens) * 0.1 / 1e6;
}
async function loadDailyUsage(uid, date) {
  const cacheKey = `${uid}_${date}`;
  const cached = usageCache[cacheKey];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.usage;
  }
  const db = getAdminDb();
  const usageDocRef = db.collection("usage_daily").doc(cacheKey);
  let usage = {
    date,
    normalMessages: 0,
    directPdfQaCalls: 0,
    solverCalls: 0,
    proCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0
  };
  try {
    const snap = await usageDocRef.get();
    if (snap.exists) {
      const data = snap.data();
      usage = {
        date,
        normalMessages: Number(data?.normalMessages || 0),
        directPdfQaCalls: Number(data?.directPdfQaCalls || 0),
        solverCalls: Number(data?.solverCalls || 0),
        proCalls: Number(data?.proCalls || 0),
        inputTokens: Number(data?.inputTokens || 0),
        outputTokens: Number(data?.outputTokens || 0),
        estimatedCostUsd: Number(data?.estimatedCostUsd || 0)
      };
    }
  } catch (err) {
    console.warn(`[usageTracker] Failed to read usage limits from Firestore for user ${uid}:`, err);
  }
  usageCache[cacheKey] = {
    usage,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  return usage;
}
async function isDailyLimitExceeded(uid) {
  return { exceeded: false };
}
async function checkSpecificLimit(uid, type) {
  return { exceeded: false };
}
async function trackAIUsage(uid, model, inputTokens, outputTokens, type) {
  const todayStr = getTodayString();
  const cost = calculateGeminiCost(model, inputTokens, outputTokens);
  const usage = await loadDailyUsage(uid, todayStr);
  if (typeof usage[type] === "number") {
    usage[type] += 1;
  }
  usage.estimatedCostUsd += cost;
  usage.inputTokens += inputTokens;
  usage.outputTokens += outputTokens;
  const cacheKey = `${uid}_${todayStr}`;
  usageCache[cacheKey] = {
    usage,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  const db = getAdminDb();
  const usageDocRef = db.collection("usage_daily").doc(cacheKey);
  usageDocRef.set({
    ...usage,
    uid,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
    lastModelUsed: model
  }, { merge: true }).catch((err) => {
    console.error(`[usageTracker] Failed to save usage tracking for user ${uid}:`, err);
  });
}
var usageCache, CACHE_TTL_MS;
var init_usageTracker = __esm({
  "server/cost/usageTracker.ts"() {
    "use strict";
    init_admin();
    usageCache = {};
    CACHE_TTL_MS = 60 * 1e3;
  }
});

// server/ai-core/feedback/wrongAnswerHandler.ts
var wrongAnswerHandler_exports = {};
__export(wrongAnswerHandler_exports, {
  handleWrongAnswerFeedback: () => handleWrongAnswerFeedback
});
async function handleWrongAnswerFeedback(params) {
  const { uid, sourceId, questionType, questionNo, reason, originalPrompt, badAnswer, mode, year, subject } = params;
  const db = getAdminDb();
  const cacheId = `${sourceId}_${questionType || "MCQ"}_${questionNo}`.replace(/\//g, "_");
  const cacheRef = db.collection("pdf_question_cache").doc(cacheId);
  const cacheDoc = await cacheRef.get();
  const currentFeedbackCount = cacheDoc.data()?.feedbackCount || 0;
  await cacheRef.set({
    rejected: true,
    validationStatus: "rejected",
    lastFeedback: reason || "User marked as wrong",
    feedbackCount: currentFeedbackCount + 1,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, { merge: true });
  const feedbackId = `FB_${Date.now()}_${uid}`;
  await db.collection("ai_feedback").doc(feedbackId).set({
    uid,
    originalPrompt: originalPrompt || "",
    badAnswer: badAnswer || "",
    reason: reason || "User marked as wrong",
    mode: mode || "paper_question_qa",
    sourceId,
    year: year || "",
    subject: subject || "",
    questionNo,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "needs_review"
  });
  console.info(`[WrongAnswerHandler] Quarantined ${cacheId} and added to ai_feedback queue.`);
  return { ok: true, message: "Feedback recorded. Question quarantined for admin review." };
}
var init_wrongAnswerHandler = __esm({
  "server/ai-core/feedback/wrongAnswerHandler.ts"() {
    "use strict";
    init_admin();
  }
});

// src/data/pastPapersData.ts
var pastPapersData;
var init_pastPapersData = __esm({
  "src/data/pastPapersData.ts"() {
    "use strict";
    pastPapersData = {
      "exam_database": "G.C.E. A/L Past Papers",
      "papers": [
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2024",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 1 },
            { "question": 2, "answer": 5 },
            { "question": 3, "answer": 3 },
            { "question": 4, "answer": 1 },
            { "question": 5, "answer": 5 },
            { "question": 6, "answer": 2 },
            { "question": 7, "answer": 5 },
            { "question": 8, "answer": 5 },
            { "question": 9, "answer": 4 },
            { "question": 10, "answer": 3 },
            { "question": 11, "answer": 5 },
            { "question": 12, "answer": 5 },
            { "question": 13, "answer": 2 },
            { "question": 14, "answer": 5 },
            { "question": 15, "answer": 1 },
            { "question": 16, "answer": 2 },
            { "question": 17, "answer": 1 },
            { "question": 18, "answer": 1 },
            { "question": 19, "answer": 2 },
            { "question": 20, "answer": 4 },
            { "question": 21, "answer": 4 },
            { "question": 22, "answer": 4 },
            { "question": 23, "answer": 4 },
            { "question": 24, "answer": 5 },
            { "question": 25, "answer": 1 },
            { "question": 26, "answer": 2 },
            { "question": 27, "answer": 4 },
            { "question": 28, "answer": 4 },
            { "question": 29, "answer": 3 },
            { "question": 30, "answer": 5 },
            { "question": 31, "answer": 2 },
            { "question": 32, "answer": 2 },
            { "question": 33, "answer": 4 },
            { "question": 34, "answer": 4 },
            { "question": 35, "answer": 2 },
            { "question": 36, "answer": 2 },
            { "question": 37, "answer": 4 },
            { "question": 38, "answer": 3 },
            { "question": 39, "answer": 4 },
            { "question": 40, "answer": 3 },
            { "question": 41, "answer": 2 },
            { "question": 42, "answer": 3 },
            { "question": 43, "answer": 4 },
            { "question": 44, "answer": 2 },
            { "question": 45, "answer": 1 },
            { "question": 46, "answer": 5 },
            { "question": 47, "answer": 2 },
            { "question": 48, "answer": 4 },
            { "question": 49, "answer": 2 },
            { "question": 50, "answer": 3 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2022",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 2 },
            { "question": 2, "answer": 3 },
            { "question": 3, "answer": 5 },
            { "question": 4, "answer": 4 },
            { "question": 5, "answer": 2 },
            { "question": 6, "answer": 4 },
            { "question": 7, "answer": 5 },
            { "question": 8, "answer": 5 },
            { "question": 9, "answer": 5 },
            { "question": 10, "answer": 5 },
            { "question": 11, "answer": 4 },
            { "question": 12, "answer": 1 },
            { "question": 13, "answer": 5 },
            { "question": 14, "answer": 2 },
            { "question": 15, "answer": 3 },
            { "question": 16, "answer": 4 },
            { "question": 17, "answer": 4 },
            { "question": 18, "answer": 4 },
            { "question": 19, "answer": 2 },
            { "question": 20, "answer": 4 },
            { "question": 21, "answer": 4 },
            { "question": 22, "answer": 1 },
            { "question": 23, "answer": 2 },
            { "question": 24, "answer": 2 },
            { "question": 25, "answer": 3 },
            { "question": 26, "answer": 4 },
            { "question": 27, "answer": 3 },
            { "question": 28, "answer": 4 },
            { "question": 29, "answer": 4 },
            { "question": 30, "answer": 5 },
            { "question": 31, "answer": 5 },
            { "question": 32, "answer": 3 },
            { "question": 33, "answer": 2 },
            { "question": 34, "answer": 2 },
            { "question": 35, "answer": 5 },
            { "question": 36, "answer": 3 },
            { "question": 37, "answer": 5 },
            { "question": 38, "answer": 4 },
            { "question": 39, "answer": 3 },
            { "question": 40, "answer": 4 },
            { "question": 41, "answer": 5 },
            { "question": 42, "answer": 1 },
            { "question": 43, "answer": 2 },
            { "question": 44, "answer": 2 },
            { "question": 45, "answer": 3 },
            { "question": 46, "answer": 5 },
            { "question": 47, "answer": 4 },
            { "question": 48, "answer": 4 },
            { "question": 49, "answer": 3 },
            { "question": 50, "answer": 1 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2016",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 2 },
            { "question": 2, "answer": 4 },
            { "question": 3, "answer": 4 },
            { "question": 4, "answer": 2 },
            { "question": 5, "answer": 2 },
            { "question": 6, "answer": 4 },
            { "question": 7, "answer": 2 },
            { "question": 8, "answer": 5 },
            { "question": 9, "answer": 3 },
            { "question": 10, "answer": 4 },
            { "question": 11, "answer": 5 },
            { "question": 12, "answer": 1 },
            { "question": 13, "answer": 3 },
            { "question": 14, "answer": 5 },
            { "question": 15, "answer": 3 },
            { "question": 16, "answer": 2 },
            { "question": 17, "answer": 2 },
            { "question": 18, "answer": 3 },
            { "question": 19, "answer": 3 },
            { "question": 20, "answer": 2 },
            { "question": 21, "answer": 5 },
            { "question": 22, "answer": 3 },
            { "question": 23, "answer": 4 },
            { "question": 24, "answer": 3 },
            { "question": 25, "answer": 3 },
            { "question": 26, "answer": 2 },
            { "question": 27, "answer": 1 },
            { "question": 28, "answer": 3 },
            { "question": 29, "answer": 1 },
            { "question": 30, "answer": 4 },
            { "question": 31, "answer": 5 },
            { "question": 32, "answer": 3 },
            { "question": 33, "answer": 4 },
            { "question": 34, "answer": 5 },
            { "question": 35, "answer": 3 },
            { "question": 36, "answer": 4 },
            { "question": 37, "answer": 3 },
            { "question": 38, "answer": 4 },
            { "question": 39, "answer": 4 },
            { "question": 40, "answer": 2 },
            { "question": 41, "answer": 2 },
            { "question": 42, "answer": 1 },
            { "question": 43, "answer": 1 },
            { "question": 44, "answer": 1 },
            { "question": 45, "answer": 1 },
            { "question": 46, "answer": 5 },
            { "question": 47, "answer": 2 },
            { "question": 48, "answer": 1 },
            { "question": 49, "answer": 3 },
            { "question": 50, "answer": 2 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2017",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 2 },
            { "question": 2, "answer": 5 },
            { "question": 3, "answer": 4 },
            { "question": 4, "answer": 2 },
            { "question": 5, "answer": 3 },
            { "question": 6, "answer": 4 },
            { "question": 7, "answer": 1 },
            { "question": 8, "answer": 1 },
            { "question": 9, "answer": 5 },
            { "question": 10, "answer": 2 },
            { "question": 11, "answer": 3 },
            { "question": 12, "answer": 5 },
            { "question": 13, "answer": 3 },
            { "question": 14, "answer": 4 },
            { "question": 15, "answer": 1 },
            { "question": 16, "answer": 2 },
            { "question": 17, "answer": 4 },
            { "question": 18, "answer": 2 },
            { "question": 19, "answer": 4 },
            { "question": 20, "answer": 4 },
            { "question": 21, "answer": 2 },
            { "question": 22, "answer": 4 },
            { "question": 23, "answer": 1 },
            { "question": 24, "answer": 5 },
            { "question": 25, "answer": 3 },
            { "question": 26, "answer": 3 },
            { "question": 27, "answer": 4 },
            { "question": 28, "answer": 3 },
            { "question": 29, "answer": 5 },
            { "question": 30, "answer": 4 },
            { "question": 31, "answer": 3 },
            { "question": 32, "answer": 4 },
            { "question": 33, "answer": 1 },
            { "question": 34, "answer": 2 },
            { "question": 35, "answer": 4 },
            { "question": 36, "answer": 5 },
            { "question": 37, "answer": 3 },
            { "question": 38, "answer": 4 },
            { "question": 39, "answer": 3 },
            { "question": 40, "answer": 3 },
            { "question": 41, "answer": 1 },
            { "question": 42, "answer": 4 },
            { "question": 43, "answer": 5 },
            { "question": 44, "answer": 2 },
            { "question": 45, "answer": 3 },
            { "question": 46, "answer": 1 },
            { "question": 47, "answer": 4 },
            { "question": 48, "answer": 5 },
            { "question": 49, "answer": 2 },
            { "question": 50, "answer": 1 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2018",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 3 },
            { "question": 2, "answer": 1 },
            { "question": 3, "answer": 5 },
            { "question": 4, "answer": 2 },
            { "question": 5, "answer": 4 },
            { "question": 6, "answer": 3 },
            { "question": 7, "answer": 1 },
            { "question": 8, "answer": 5 },
            { "question": 9, "answer": 2 },
            { "question": 10, "answer": 4 },
            { "question": 11, "answer": 3 },
            { "question": 12, "answer": 2 },
            { "question": 13, "answer": 1 },
            { "question": 14, "answer": 5 },
            { "question": 15, "answer": 4 },
            { "question": 16, "answer": 2 },
            { "question": 17, "answer": 3 },
            { "question": 18, "answer": 1 },
            { "question": 19, "answer": 5 },
            { "question": 20, "answer": 4 },
            { "question": 21, "answer": 2 },
            { "question": 22, "answer": 3 },
            { "question": 23, "answer": 1 },
            { "question": 24, "answer": 4 },
            { "question": 25, "answer": 5 },
            { "question": 26, "answer": 2 },
            { "question": 27, "answer": 3 },
            { "question": 28, "answer": 4 },
            { "question": 29, "answer": 1 },
            { "question": 30, "answer": 5 },
            { "question": 31, "answer": 3 },
            { "question": 32, "answer": 2 },
            { "question": 33, "answer": 4 },
            { "question": 34, "answer": 1 },
            { "question": 35, "answer": 5 },
            { "question": 36, "answer": 2 },
            { "question": 37, "answer": 3 },
            { "question": 38, "answer": 4 },
            { "question": 39, "answer": 1 },
            { "question": 40, "answer": 5 },
            { "question": 41, "answer": 3 },
            { "question": 42, "answer": 2 },
            { "question": 43, "answer": 4 },
            { "question": 44, "answer": 1 },
            { "question": 45, "answer": 5 },
            { "question": 46, "answer": 2 },
            { "question": 47, "answer": 3 },
            { "question": 48, "answer": 4 },
            { "question": 49, "answer": 1 },
            { "question": 50, "answer": 5 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2019",
            "subject": "Engineering Technology",
            "subjectKey": "et",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 5 },
            { "question": 2, "answer": 3 },
            { "question": 3, "answer": 1 },
            { "question": 4, "answer": 1 },
            { "question": 5, "answer": 3 },
            { "question": 6, "answer": 4 },
            { "question": 7, "answer": 3 },
            { "question": 8, "answer": 2 },
            { "question": 9, "answer": 2 },
            { "question": 10, "answer": 5 },
            { "question": 11, "answer": 3 },
            { "question": 12, "answer": 3 },
            { "question": 13, "answer": 1 },
            { "question": 14, "answer": 5 },
            { "question": 15, "answer": 1 },
            { "question": 16, "answer": 2 },
            { "question": 17, "answer": 2 },
            { "question": 18, "answer": 4 },
            { "question": 19, "answer": 1 },
            { "question": 20, "answer": 2 },
            { "question": 21, "answer": 1 },
            { "question": 22, "answer": 3 },
            { "question": 23, "answer": 1 },
            { "question": 24, "answer": 1 },
            { "question": 25, "answer": 4 },
            { "question": 26, "answer": 2 },
            { "question": 27, "answer": 3 },
            { "question": 28, "answer": 2 },
            { "question": 29, "answer": 3 },
            { "question": 30, "answer": 1 },
            { "question": 31, "answer": 1 },
            { "question": 32, "answer": 4 },
            { "question": 33, "answer": 2 },
            { "question": 34, "answer": 3 },
            { "question": 35, "answer": 4 },
            { "question": 36, "answer": 1 },
            { "question": 37, "answer": 4 },
            { "question": 38, "answer": 5 },
            { "question": 39, "answer": 2 },
            { "question": 40, "answer": 2 },
            { "question": 41, "answer": 2 },
            { "question": 42, "answer": 1 },
            { "question": 43, "answer": 4 },
            { "question": 44, "answer": 5 },
            { "question": 45, "answer": 2 },
            { "question": 46, "answer": 3 },
            { "question": 47, "answer": 5 },
            { "question": 48, "answer": 3 },
            { "question": 49, "answer": 4 },
            { "question": 50, "answer": 1 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2020",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 3 },
            { "question": 2, "answer": 4 },
            { "question": 3, "answer": 5 },
            { "question": 4, "answer": 3 },
            { "question": 5, "answer": 2 },
            { "question": 6, "answer": 4 },
            { "question": 7, "answer": 1 },
            { "question": 8, "answer": 2 },
            { "question": 9, "answer": 2 },
            { "question": 10, "answer": 4 },
            { "question": 11, "answer": 5 },
            { "question": 12, "answer": 1 },
            { "question": 13, "answer": 5 },
            { "question": 14, "answer": 5 },
            { "question": 15, "answer": 4 },
            { "question": 16, "answer": 3 },
            { "question": 17, "answer": 5 },
            { "question": 18, "answer": 1 },
            { "question": 19, "answer": 3 },
            { "question": 20, "answer": 4 },
            { "question": 21, "answer": 2 },
            { "question": 22, "answer": 1 },
            { "question": 23, "answer": 2 },
            { "question": 24, "answer": 5 },
            { "question": 25, "answer": 4 },
            { "question": 26, "answer": 4 },
            { "question": 27, "answer": 5 },
            { "question": 28, "answer": 1 },
            { "question": 29, "answer": 2 },
            { "question": 30, "answer": 1 },
            { "question": 31, "answer": 3 },
            { "question": 32, "answer": 1 },
            { "question": 33, "answer": 2 },
            { "question": 34, "answer": 3 },
            { "question": 35, "answer": 4 },
            { "question": 36, "answer": 3 },
            { "question": 37, "answer": 5 },
            { "question": 38, "answer": 1 },
            { "question": 39, "answer": 1 },
            { "question": 40, "answer": 1 },
            { "question": 41, "answer": 1 },
            { "question": 42, "answer": 2 },
            { "question": 43, "answer": 3 },
            { "question": 44, "answer": 4 },
            { "question": 45, "answer": 3 },
            { "question": 46, "answer": 2 },
            { "question": 47, "answer": 3 },
            { "question": 48, "answer": 4 },
            { "question": 49, "answer": 5 },
            { "question": 50, "answer": 1 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2021",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 2 },
            { "question": 2, "answer": 4 },
            { "question": 3, "answer": 1 },
            { "question": 4, "answer": 5 },
            { "question": 5, "answer": 3 },
            { "question": 6, "answer": 3 },
            { "question": 7, "answer": 2 },
            { "question": 8, "answer": 4 },
            { "question": 9, "answer": 1 },
            { "question": 10, "answer": 5 },
            { "question": 11, "answer": 3 },
            { "question": 12, "answer": 2 },
            { "question": 13, "answer": 4 },
            { "question": 14, "answer": 1 },
            { "question": 15, "answer": 5 },
            { "question": 16, "answer": 2 },
            { "question": 17, "answer": 3 },
            { "question": 18, "answer": 4 },
            { "question": 19, "answer": 1 },
            { "question": 20, "answer": 5 },
            { "question": 21, "answer": 2 },
            { "question": 22, "answer": 3 },
            { "question": 23, "answer": 4 },
            { "question": 24, "answer": 1 },
            { "question": 25, "answer": 2 },
            { "question": 26, "answer": 5 },
            { "question": 27, "answer": 3 },
            { "question": 28, "answer": 4 },
            { "question": 29, "answer": 1 },
            { "question": 30, "answer": 2 },
            { "question": 31, "answer": 5 },
            { "question": 32, "answer": 3 },
            { "question": 33, "answer": 4 },
            { "question": 34, "answer": 1 },
            { "question": 35, "answer": 2 },
            { "question": 36, "answer": 5 },
            { "question": 37, "answer": 3 },
            { "question": 38, "answer": 4 },
            { "question": 39, "answer": 1 },
            { "question": 40, "answer": 2 },
            { "question": 41, "answer": 3 },
            { "question": 42, "answer": 4 },
            { "question": 43, "answer": 5 },
            { "question": 44, "answer": 1 },
            { "question": 45, "answer": 2 },
            { "question": 46, "answer": 3 },
            { "question": 47, "answer": 4 },
            { "question": 48, "answer": 5 },
            { "question": 49, "answer": 1 },
            { "question": 50, "answer": 2 }
          ]
        },
        {
          "metadata": {
            "exam": "G.C.E. A/L Examination 2023",
            "subject": "Science for Technology",
            "subjectKey": "sft",
            "medium": "Sinhala"
          },
          "answers": [
            { "question": 1, "answer": 3 },
            { "question": 2, "answer": 1 },
            { "question": 3, "answer": 4 },
            { "question": 4, "answer": 2 },
            { "question": 5, "answer": 5 },
            { "question": 6, "answer": 2 },
            { "question": 7, "answer": 3 },
            { "question": 8, "answer": 4 },
            { "question": 9, "answer": 1 },
            { "question": 10, "answer": 5 },
            { "question": 11, "answer": 2 },
            { "question": 12, "answer": 3 },
            { "question": 13, "answer": 4 },
            { "question": 14, "answer": 2 },
            { "question": 15, "answer": 1 },
            { "question": 16, "answer": 5 },
            { "question": 17, "answer": 3 },
            { "question": 18, "answer": 4 },
            { "question": 19, "answer": 2 },
            { "question": 20, "answer": 1 },
            { "question": 21, "answer": 3 },
            { "question": 22, "answer": 5 },
            { "question": 23, "answer": 4 },
            { "question": 24, "answer": 2 },
            { "question": 25, "answer": 1 },
            { "question": 26, "answer": 3 },
            { "question": 27, "answer": 5 },
            { "question": 28, "answer": 2 },
            { "question": 29, "answer": 4 },
            { "question": 30, "answer": 1 },
            { "question": 31, "answer": 3 },
            { "question": 32, "answer": 5 },
            { "question": 33, "answer": 2 },
            { "question": 34, "answer": 4 },
            { "question": 35, "answer": 1 },
            { "question": 36, "answer": 3 },
            { "question": 37, "answer": 2 },
            { "question": 38, "answer": 5 },
            { "question": 39, "answer": 4 },
            { "question": 40, "answer": 1 },
            { "question": 41, "answer": 2 },
            { "question": 42, "answer": 3 },
            { "question": 43, "answer": 5 },
            { "question": 44, "answer": 4 },
            { "question": 45, "answer": 1 },
            { "question": 46, "answer": 2 },
            { "question": 47, "answer": 3 },
            { "question": 48, "answer": 5 },
            { "question": 49, "answer": 4 },
            { "question": 50, "answer": 1 }
          ]
        }
      ]
    };
  }
});

// server/ai/examResourceResolver.ts
var examResourceResolver_exports = {};
__export(examResourceResolver_exports, {
  isMarkingSchemeLike: () => isMarkingSchemeLike,
  isPaperLike: () => isPaperLike,
  normalizeSubject: () => normalizeSubject3,
  normalizeTitleText: () => normalizeTitleText,
  resolveExamResources: () => resolveExamResources,
  scoreSourceMatch: () => scoreSourceMatch,
  subjectAliases: () => subjectAliases
});
function normalizeSubject3(input) {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return "";
  const isSft = /\b(SFT|SCIENCE FOR TECHNOLOGY|තාක්ෂණවේදය සඳහා විද්‍යාව|තාක්ෂණවේදය සඳහා විද්යාව|තාක්ෂණවේදය|S\.F\.T)\b/i.test(s);
  const isEt = /\b(ET|ENGINEERING TECHNOLOGY|ඉංජිනේරු තාක්ෂණවේදය|ඉංජිනේරු තාක්ෂණය|E\.T)\b/i.test(s);
  const isIct = /\b(ICT|INFORMATION AND COMMUNICATION TECHNOLOGY|තොරතුරු හා සන්නිවේදන තාක්ෂණය|තොරතුරු සන්නිවේදන තාක්ෂණය|තොරතුරු හා සන්නිවේදන|I\.C\.T)\b/i.test(s);
  if (isSft) return "SFT";
  if (isEt) return "ET";
  if (isIct) return "ICT";
  return s;
}
function subjectAliases(subject) {
  const norm = normalizeSubject3(subject);
  if (norm === "SFT") return ["sft", "science for technology", "\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0", "\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u0DBA\u0DCF\u0DC0", "science for tech", "\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA", "sft"];
  if (norm === "ET") return ["et", "engineering technology", "\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA", "\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA", "engineering", "et paper", "engineering tech"];
  if (norm === "ICT") return ["ict", "information and communication technology", "\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA", "\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1", "information", "communication", "\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4"];
  return [];
}
function normalizeTitleText(src) {
  return [
    src.title,
    src.fileName,
    src.subject,
    src.year,
    src.resourceType,
    src.sourceType,
    src.sourceScope
  ].filter(Boolean).join(" ").toLowerCase();
}
function isPaperLike(src) {
  const rt = String(src.resourceType || "").toLowerCase();
  const st = String(src.sourceType || "").toLowerCase();
  const ss = String(src.sourceScope || "").toLowerCase();
  const title = normalizeTitleText(src);
  return rt.includes("past_paper") || rt.includes("model_paper") || st.includes("past_paper") || ss.includes("past_paper") || title.includes("past paper") || title.includes("paper") || title.includes("full");
}
function isMarkingSchemeLike(src) {
  const txt = normalizeTitleText(src);
  const rt = String(src.resourceType || "").toLowerCase();
  return rt.includes("marking") || txt.includes("marking") || txt.includes("scheme") || txt.includes("answers") || txt.includes(" sm ") || txt.includes("marking_scheme");
}
function scoreSourceMatch(src, params) {
  const { subject, year, resourceType, prompt, uid, isAdmin, activeSourceId } = params;
  let score = 0;
  const textToScan = normalizeTitleText(src);
  const promptLower = prompt.toLowerCase();
  const normTargetSub = normalizeSubject3(subject || prompt);
  const srcNormSub = normalizeSubject3(src.subject || textToScan);
  let targetYear = year;
  if (!targetYear) {
    const foundYear = prompt.match(/\b(201\d|202\d)\b/);
    if (foundYear) targetYear = foundYear[0];
  }
  const targetYearStr = targetYear ? String(targetYear) : "";
  const srcYearStr = src.year ? String(src.year) : "";
  const srcId = src.sourceId || src.id;
  if (activeSourceId && srcId === activeSourceId) score += 60;
  if (src.storagePath) score += 50;
  if (normTargetSub) {
    if (srcNormSub === normTargetSub) {
      score += 40;
    } else {
      const otherSubs = ["SFT", "ET", "ICT"].filter((s) => s !== normTargetSub);
      const hasWrongSub = otherSubs.includes(srcNormSub) || otherSubs.some((os) => {
        const osAliases = subjectAliases(os);
        return osAliases.some((alias) => textToScan.includes(alias));
      });
      if (hasWrongSub) {
        score -= 100;
      }
    }
  }
  if (targetYearStr) {
    if (srcYearStr === targetYearStr) {
      score += 40;
    } else if (textToScan.includes(targetYearStr)) {
      score += 30;
    } else if (srcYearStr && srcYearStr !== targetYearStr) {
      score -= 100;
    } else {
      const otherYears = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"].filter((y) => y !== targetYearStr);
      if (otherYears.some((oy) => textToScan.includes(oy))) {
        score -= 100;
      }
    }
  }
  if (normTargetSub) {
    const aliases = subjectAliases(normTargetSub);
    if (aliases.some((a) => textToScan.includes(a))) {
      score += 30;
    }
  }
  if (normTargetSub && targetYearStr && textToScan.includes(normTargetSub.toLowerCase()) && textToScan.includes(targetYearStr)) {
    score += 50;
  }
  if (resourceType) {
    const srcRt = String(src.resourceType || "").toLowerCase();
    if (srcRt.includes(resourceType.toLowerCase())) {
      score += 25;
    }
  }
  const isMS = isMarkingSchemeLike(src);
  const promptWantsMS = promptLower.includes("marking") || promptLower.includes("scheme") || promptLower.includes("\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4") || promptLower.includes("\u0D85\u0DB1\u0DCA\u0DC3\u0DBB\u0DCA");
  if (promptWantsMS && isMS) score += 50;
  if (!promptWantsMS && isMS) score -= 30;
  const isFullPaperPrompt = promptLower.includes("paper") || promptLower.includes("past paper") || promptLower.includes("mcq") || targetYearStr && !promptLower.includes("lesson");
  if (isFullPaperPrompt) {
    const isTute = textToScan.includes("tute") || textToScan.includes("lesson") || textToScan.includes("\u0DB4\u0DCF\u0DA9\u0DB8") || textToScan.includes("revision");
    if (isTute) score -= 100;
  }
  const isOwner = src.ownerUid === uid;
  if (isOwner) {
    score += 20;
  } else {
    const isPrivate = src.visibility === "private" || src.sourceScope === "owner_syllabus";
    if (isPrivate && !isAdmin) {
      score -= 500;
    }
  }
  return score;
}
async function resolveExamResources(params) {
  const {
    prompt,
    uid,
    email,
    subject,
    year,
    resourceType,
    questionNo,
    lesson
  } = params;
  const db = getAdminDb();
  const sources = [];
  const bestTextBlocks = [];
  let activeSourceId = void 0;
  if (uid) {
    try {
      const chatCtxDoc = await db.collection("users").doc(uid).collection("chat_context").doc("current").get();
      if (chatCtxDoc.exists) {
        const data = chatCtxDoc.data();
        if (data && data.activePdf && data.activePdf.sourceId) {
          activeSourceId = data.activePdf.sourceId;
        } else if (data && Array.isArray(data.temporaryPdfs) && data.temporaryPdfs.length > 0) {
          activeSourceId = data.temporaryPdfs[0].sourceId;
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve current chat_context activeSourceId in resolver:", err.message);
    }
  }
  const normSubject = normalizeSubject3(subject || prompt);
  const normYear = year ? String(year) : void 0;
  const normQuestion = questionNo ? String(questionNo).toUpperCase() : void 0;
  const isAdmin = params.isAdmin === true;
  try {
    if (pastPapersData && pastPapersData.papers) {
      const matchedPaper = pastPapersData.papers.find((p) => {
        const pSub = normalizeSubject3(p.metadata?.subjectKey || "");
        const pExam = p.metadata?.exam || "";
        const matchesSub = pSub === normSubject;
        const matchesYear = !year || pExam.includes(String(year));
        return matchesSub && matchesYear;
      });
      if (matchedPaper && normQuestion) {
        const ansObj = matchedPaper.answers.find((a) => String(a.question) === normQuestion.replace("Q", ""));
        if (ansObj) {
          sources.push({
            id: `local_ans_${normSubject}_${normYear || "all"}_${normQuestion}`,
            title: `${matchedPaper.metadata.exam} SFT MCQ Answer key - ${normQuestion}`,
            subject: normSubject,
            year: normYear,
            resourceType: "marking_scheme",
            questionNo: normQuestion,
            text: `Question ${normQuestion} Answer: Option ${ansObj.answer}`,
            confidence: 0.95,
            verified: true,
            candidate: false,
            badge: "Local Key"
          });
        }
      }
    }
  } catch (err) {
    console.warn("Local pastPapersData resolve failed:", err);
  }
  try {
    if (SYLLABUS && normSubject) {
      const sKey = normSubject.toLowerCase();
      const sDef = SYLLABUS[sKey];
      if (sDef) {
        let textStr = `Static Syllabus fallback for ${normSubject}:
`;
        if (sDef.mcqItems) {
          textStr += `MCQ Weights:
` + sDef.mcqItems.map((i) => `- ${i.q}: ${i.title} (${i.count} questions)`).join("\n") + "\n";
        }
        if (sDef.partAItems) {
          textStr += `Part A Structural Weights:
` + sDef.partAItems.map((i) => `- ${i.q}: ${i.title} (${i.subTitle || i.topics?.join(", ") || ""}) max marks ${i.max}`).join("\n") + "\n";
        }
        if (sDef.bcdGroups) {
          textStr += `Part B/C/D Weights:
` + sDef.bcdGroups.map((g) => `Group ${g.title} (${g.label}):
` + g.items.map((i) => `  - ${i.q}: max marks ${i.max}, topics: ${i.topics?.join(", ") || ""}`).join("\n")).join("\n") + "\n";
        }
        sources.push({
          id: `static_syllabus_${normSubject}`,
          title: `Fallback static structure for ${normSubject}`,
          subject: normSubject,
          confidence: 0.7,
          verified: true,
          candidate: false,
          badge: "Static Syllabus",
          text: textStr
        });
      }
    }
  } catch (err) {
    console.warn("Static syllabus resolve failed:", err);
  }
  const rawCandidates = [];
  try {
    const ppSnap = await db.collection("past_papers").limit(100).get();
    ppSnap.forEach((doc) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "past_papers" });
    });
  } catch (err) {
    console.warn("Broad past_papers query failed:", err);
  }
  try {
    const ragPublicSnap = await db.collection("rag_sources").where("visibility", "in", ["public", "official", "shared"]).limit(100).get();
    ragPublicSnap.forEach((doc) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "rag_sources" });
    });
    const ragOwnedSnap = await db.collection("rag_sources").where("ownerUid", "==", uid).limit(100).get();
    ragOwnedSnap.forEach((doc) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "rag_sources" });
    });
  } catch (err) {
    console.warn("Broad rag_sources query failed:", err);
  }
  try {
    const userSyllSnap = await db.collection("users").doc(uid).collection("syllabus_resources").limit(100).get();
    userSyllSnap.forEach((doc) => {
      rawCandidates.push({ id: doc.id, ...doc.data(), _sourceCol: "syllabus_resources" });
    });
  } catch (err) {
    console.warn("Broad user syllabus_resources query failed:", err);
  }
  const seenIds = /* @__PURE__ */ new Set();
  const uniqueCandidates = [];
  for (const c of rawCandidates) {
    const cid = c.sourceId || c.id;
    if (cid && !seenIds.has(cid)) {
      seenIds.add(cid);
      uniqueCandidates.push(c);
    }
  }
  const scoredCandidates = uniqueCandidates.map((c) => {
    const score = scoreSourceMatch(c, {
      subject: subject || normSubject,
      year: year || normYear,
      resourceType,
      prompt,
      uid,
      isAdmin,
      activeSourceId
    });
    return { doc: c, score };
  });
  const validMatched = scoredCandidates.filter((sc) => {
    if (sc.score < 35) return false;
    const doc = sc.doc;
    const isOwner = doc.ownerUid === uid;
    const isPublic = ["official", "shared", "public"].includes(doc.visibility);
    if (!isOwner && !isPublic && !isAdmin) return false;
    return true;
  }).sort((a, b) => b.score - a.score);
  const metadataSources = validMatched.map((m) => {
    const doc = m.doc;
    const cid = doc.sourceId || doc.id;
    let badge = "Library File";
    if (doc._sourceCol === "past_papers" || doc.resourceType === "past_paper") {
      badge = isMarkingSchemeLike(doc) ? "Marking Scheme" : "Past Paper";
    } else if (doc._sourceCol === "syllabus_resources" || doc.sourceScope === "owner_syllabus") {
      badge = "My Library";
    } else if (doc.sourceScope === "paper_structure") {
      badge = "Paper Structure";
    }
    return {
      id: cid,
      sourceId: cid,
      title: doc.title || doc.fileName || "RAG Source",
      fileName: doc.fileName || doc.title || "document.pdf",
      subject: normalizeSubject3(doc.subject),
      year: doc.year ? String(doc.year) : void 0,
      resourceType: doc.resourceType || doc.sourceType || "past_paper",
      sourceType: doc.sourceType || doc.resourceType || "past_paper",
      sourceScope: doc.sourceScope || "personal",
      storagePath: doc.storagePath,
      ownerUid: doc.ownerUid,
      visibility: doc.visibility || "private",
      chunkCount: Number(doc.chunkCount || 0),
      textIndexed: Number(doc.chunkCount || 0) > 0 && doc.needsOcr !== true,
      needsOcr: doc.needsOcr === true,
      needsLegacyConversion: doc.needsLegacyConversion === true,
      textEncoding: doc.textEncoding || "unknown",
      indexStatus: doc.indexStatus || "ready",
      confidence: m.score / 150,
      // normalize confidence roughly
      badge,
      url: doc.url || `/api/rag/sources/${cid}/download`
    };
  });
  sources.push(...metadataSources);
  try {
    const matchedSourceIds = metadataSources.map((s) => s.id);
    if (matchedSourceIds.length > 0) {
      const chunkRef = db.collection("rag_chunks");
      const bestChunks = [];
      const targetSourceIds = [metadataSources[0].id];
      for (const srcId of targetSourceIds) {
        const chunkSnap = await chunkRef.where("sourceId", "==", srcId).limit(20).get();
        chunkSnap.forEach((doc) => {
          const data = doc.data();
          const textContent = data.text || "";
          const numOnly = normQuestion ? normQuestion.replace(/\D/g, "") : "";
          let matchesQuestion = false;
          if (numOnly) {
            const patterns = [
              new RegExp(`\\b${numOnly}\\.\\s`),
              new RegExp(`\\b${numOnly}\\)`),
              new RegExp(`\\(${numOnly}\\)`),
              new RegExp(`mcq\\s*${numOnly}\\b`, "i"),
              new RegExp(`(?:\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA|\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA)\\s*${numOnly}\\b`),
              new RegExp(`${numOnly}\\s*\u0DC0\u0DB1`),
              new RegExp(`${numOnly}\\s*\u0DC0\u0DD9\u0DB1\u0DD2`),
              new RegExp(`\\bQ${numOnly}\\b`, "i"),
              new RegExp(`\\bQuestion\\s*${numOnly}\\b`, "i")
            ];
            matchesQuestion = patterns.some((p) => p.test(textContent) || p.test(textContent.toLowerCase()));
          }
          if (normQuestion && !matchesQuestion) {
            return;
          }
          bestChunks.push({
            id: doc.id,
            title: `Excerpt from: ${data.title || data.sourceId}`,
            subject: normalizeSubject3(data.subject),
            year: data.year,
            resourceType: data.resourceType,
            questionNo: data.questionNo || (matchesQuestion ? normQuestion : void 0),
            text: textContent,
            pageNumber: data.pageNumber,
            confidence: matchesQuestion ? 0.95 : 0.8,
            verified: true,
            candidate: false,
            badge: "Text Chunk"
          });
        });
      }
      sources.push(...bestChunks);
      bestChunks.forEach((c) => {
        if (c.text) bestTextBlocks.push(c.text);
      });
    }
  } catch (err) {
    console.warn("rag_chunks query resolve failed:", err);
  }
  const paperSource = sources.find((s) => isPaperLike(s) && !!s.storagePath);
  const markingSchemeSource = sources.find((s) => isMarkingSchemeLike(s) && (!!s.storagePath || s.badge === "Local Key"));
  const syllabusSource = sources.find((s) => s.badge === "My Library" || s.badge === "Static Syllabus" || s.resourceType === "syllabus");
  const paperStructureSource = sources.find((s) => s.badge === "Paper Structure" || s.resourceType === "paper_structure");
  let hasExactQuestionText = sources.some((s) => s.badge === "Local Key");
  if (!hasExactQuestionText && normQuestion) {
    const numOnly = normQuestion.replace(/\D/g, "");
    if (numOnly) {
      const patterns = [
        new RegExp(`\\b${numOnly}\\.\\s`),
        new RegExp(`\\b${numOnly}\\)`),
        new RegExp(`\\(${numOnly}\\)`),
        new RegExp(`mcq\\s*${numOnly}\\b`, "i"),
        new RegExp(`(?:\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA|\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA)\\s*${numOnly}\\b`),
        new RegExp(`${numOnly}\\s*\u0DC0\u0DB1`),
        new RegExp(`${numOnly}\\s*\u0DC0\u0DD9\u0DB1\u0DD2`),
        new RegExp(`\\bQ${numOnly}\\b`, "i"),
        new RegExp(`\\bQuestion\\s*${numOnly}\\b`, "i")
      ];
      hasExactQuestionText = bestTextBlocks.some((t) => patterns.some((p) => p.test(t) || p.test(t.toLowerCase())));
    }
  }
  const hasPdfSource = !!(paperSource?.storagePath || paperSource?.url);
  const hasMarkingScheme = !!(markingSchemeSource?.storagePath || markingSchemeSource?.url || markingSchemeSource?.text);
  const hasSyllabus = !!syllabusSource;
  const hasPaperStructure = !!paperStructureSource || !!sources.find((s) => s.badge === "Static Syllabus");
  const userRequestedWeb = prompt.toLowerCase().includes("web") || prompt.toLowerCase().includes("search") || prompt.toLowerCase().includes("google") || prompt.toLowerCase().includes("latest") || prompt.toLowerCase().includes("internet");
  const localFailed = sources.length === 0;
  const needsWebSearch = userRequestedWeb || localFailed && !hasPdfSource && !hasMarkingScheme && !!normSubject && !!normYear;
  return {
    ok: sources.length > 0,
    sources,
    bestTextBlocks,
    paperSource,
    markingSchemeSource,
    syllabusSource,
    paperStructureSource,
    hasExactQuestionText,
    hasPdfSource,
    hasMarkingScheme,
    hasSyllabus,
    hasPaperStructure,
    needsWebSearch: hasPdfSource ? false : needsWebSearch,
    notFoundReason: sources.length === 0 ? "No matched database or syllabus documents found." : void 0
  };
}
var init_examResourceResolver = __esm({
  "server/ai/examResourceResolver.ts"() {
    "use strict";
    init_admin();
    init_pastPapersData();
    init_syllabus();
  }
});

// server/ai-core/evidence/evidenceGate.ts
function validateQuestionEvidence(evidence, request) {
  if (!evidence) return { ok: false, reason: "NO_EVIDENCE" };
  if (request.year && evidence.year !== request.year) return { ok: false, reason: "YEAR_MISMATCH" };
  if (request.subject && evidence.subject !== request.subject) return { ok: false, reason: "SUBJECT_MISMATCH" };
  if (request.questionNo && String(evidence.questionNo) !== String(request.questionNo)) return { ok: false, reason: "QUESTION_NUMBER_MISMATCH" };
  if (request.questionType && evidence.questionType !== request.questionType) return { ok: false, reason: "QUESTION_TYPE_MISMATCH" };
  if (request.questionType === "MCQ" && (!evidence.options || evidence.options.length < 4)) {
    return { ok: false, reason: "MCQ_MISSING_OPTIONS" };
  }
  if (!evidence.questionText || evidence.questionText.length < 20) return { ok: false, reason: "INSUFFICIENT_QUESTION_TEXT" };
  if (evidence.confidence < 0.7) return { ok: false, reason: "LOW_CONFIDENCE" };
  if (evidence.validationStatus === "rejected") return { ok: false, reason: "EVIDENCE_REJECTED" };
  const combined = (evidence.questionText + " " + (evidence.officialAnswer || "") + " " + (evidence.estimatedAnswer || "")).toLowerCase();
  if (combined.includes("estimated") || combined.includes("likely") || combined.includes("probably") || combined.includes("\u0D86\u0DAF\u0DBB\u0DCA\u0DC1") || combined.includes("model question")) {
    return { ok: false, reason: "ESTIMATED_OR_MODEL_ANSWER_REJECTED" };
  }
  return { ok: true, evidence };
}
var init_evidenceGate = __esm({
  "server/ai-core/evidence/evidenceGate.ts"() {
    "use strict";
  }
});

// server/ai-core/evidence/evidenceRetriever.ts
var evidenceRetriever_exports = {};
__export(evidenceRetriever_exports, {
  retrieveEvidenceForPaperQuestion: () => retrieveEvidenceForPaperQuestion
});
async function retrieveEvidenceForPaperQuestion(params) {
  const { sourceId, questionType, questionNo, year, subject } = params;
  const db = getAdminDb();
  const verifiedId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
  const verifiedSnap = await db.collection("verified_answers").doc(verifiedId).get();
  if (verifiedSnap.exists) {
    const data = verifiedSnap.data();
    const evidence = {
      ...data,
      extractionMethod: "manual_verified",
      verified: true,
      validationStatus: "valid",
      confidence: 1
    };
    return { ok: true, evidence };
  }
  const cacheSnap = await db.collection("pdf_question_cache").doc(verifiedId).get();
  if (cacheSnap.exists) {
    const data = cacheSnap.data();
    const gate = validateQuestionEvidence(data, { year, subject, questionNo, questionType });
    const method = String(data.extractionMethod || "");
    const fullPaperVerified = data.fullPaperScan === true || ["gemini_direct_pdf_qa", "gemini_targeted_legacy_page", "full_paper_ocr_scan", "full_paper_index_scan"].includes(method);
    if (gate.ok && Number(data.evidenceVersion || 0) >= 4 && fullPaperVerified) {
      return { ok: true, evidence: data };
    }
  }
  return { ok: false, reason: "NO_VALID_EVIDENCE_FOUND" };
}
var init_evidenceRetriever = __esm({
  "server/ai-core/evidence/evidenceRetriever.ts"() {
    "use strict";
    init_admin();
    init_evidenceGate();
  }
});

// shared/text/paperAnswer.ts
var paperAnswer_exports = {};
__export(paperAnswer_exports, {
  formatPaperQuestionAnswer: () => formatPaperQuestionAnswer,
  formatPaperQuizQuestion: () => formatPaperQuizQuestion
});
function stripLeadingOptionMarker(value, optionNo) {
  let text = cleanAssistantResponse(value).trim();
  if (!text) return "";
  if (optionNo) {
    const escaped = optionNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*(?:\\(\\s*${escaped}\\s*\\)|${escaped}[.)])\\s*`), "");
  }
  return text.trim();
}
function collapseRepeatedAnswerMarker(value) {
  return value.replace(/^\s*\(\s*([1-5])\s*\)\s*\(\s*\1\s*\)\s*/, "($1) ").trim();
}
function formatPaperQuestionAnswer(params) {
  const questionText = normalizeSinhalaUnicode(params.questionText).trim();
  const options = Array.isArray(params.options) ? params.options.map((value) => normalizeSinhalaUnicode(value).trim()).filter(Boolean) : [];
  const solved = params.solvedAnswer || null;
  const optionNo = String(solved?.optionNo || "").replace(/\D/g, "");
  const officialAnswer = cleanAssistantResponse(params.officialAnswer).trim();
  const optionText = stripLeadingOptionMarker(solved?.optionText, optionNo || null);
  const explanation = cleanAssistantResponse(solved?.explanationSinhala || params.explanationSinhala).trim();
  const whyOthersWrong = Array.isArray(solved?.whyOthersWrong) ? solved.whyOthersWrong.map((value) => cleanAssistantResponse(value)).filter(Boolean) : [];
  const blocks = [];
  if (questionText) {
    blocks.push(questionText);
    if (options.length > 0) blocks.push(options.join("\n"));
  }
  const answerText = collapseRepeatedAnswerMarker(officialAnswer || [optionNo ? `(${optionNo})` : "", optionText].filter(Boolean).join(" ").trim());
  if (answerText) blocks.push(`**\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB:** ${answerText}`);
  if (explanation) blocks.push(explanation);
  if (params.includeWhyOthersWrong !== false && whyOthersWrong.length > 0) {
    blocks.push(`**\u0D85\u0DB1\u0DD9\u0D9A\u0DCA \u0DC0\u0DD2\u0D9A\u0DBD\u0DCA\u0DB4 \u0DB1\u0DDC\u0D9C\u0DD0\u0DC5\u0DB4\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA \u0D87\u0DBA\u0DD2?**
${whyOthersWrong.map((reason) => `- ${reason}`).join("\n")}`);
  }
  return cleanAssistantResponse(blocks.join("\n\n"));
}
function formatPaperQuizQuestion(params) {
  const questionText = normalizeSinhalaUnicode(params.questionText).trim();
  const options = Array.isArray(params.options) ? params.options.map((value) => normalizeSinhalaUnicode(value).trim()).filter(Boolean) : [];
  const optionLines = options.map((option, index) => {
    const clean = option.replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/, "");
    return `(${index + 1}) ${clean}`;
  });
  const progress = params.startQuestionNo === 1 && params.endQuestionNo === 50 ? `${params.questionNo}/50` : `${params.questionNo} (${params.startQuestionNo}\u2013${params.endQuestionNo})`;
  const feedback = cleanAssistantResponse(params.feedbackPrefix).trim();
  return cleanAssistantResponse([
    feedback,
    `### ${params.year} ${params.subject} MCQ ${progress}`,
    questionText,
    optionLines.join("\n"),
    "**\u0D94\u0DB6\u0DDA \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB \u0DBD\u0DD9\u0DC3 1\u20135 \u0D85\u0DAD\u0DBB \u0D85\u0D82\u0D9A\u0DBA \u0DB4\u0DB8\u0DAB\u0D9A\u0DCA \u0DBA\u0DC0\u0DB1\u0DCA\u0DB1.**"
  ].filter(Boolean).join("\n\n"));
}
var init_paperAnswer = __esm({
  "shared/text/paperAnswer.ts"() {
    "use strict";
    init_assistantText();
  }
});

// server/ai/webPdfSearch.ts
var webPdfSearch_exports = {};
__export(webPdfSearch_exports, {
  searchWebPdfCandidates: () => searchWebPdfCandidates
});
async function searchWebPdfCandidates(params) {
  const { subject, year, resourceType, questionNo, medium } = params;
  const subjectFullName = subject.toUpperCase() === "SFT" ? "Science for Technology" : subject.toUpperCase() === "ET" ? "Engineering Technology" : subject.toUpperCase() === "ICT" ? "Information and Communication Technology" : subject;
  const sinhalaSubjectName = subject.toUpperCase() === "SFT" ? "\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0" : subject.toUpperCase() === "ET" ? "\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA" : subject.toUpperCase() === "ICT" ? "\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA" : subject;
  const queries = [];
  const typeLabel = resourceType === "marking_scheme" ? "marking scheme" : "past paper";
  const sinhalaTypeLabel = resourceType === "marking_scheme" ? "\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA" : "\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA";
  queries.push(`${year} GCE A/L ${subjectFullName} ${typeLabel} PDF Sri Lanka`);
  queries.push(`${year} A/L ${subject} ${typeLabel} Sinhala PDF`);
  queries.push(`${year} G.C.E. A/L ${sinhalaSubjectName} ${sinhalaTypeLabel} PDF`);
  const candidates = [];
  const seenUrls = /* @__PURE__ */ new Set();
  for (const q of queries) {
    try {
      const searchRes = await groundedSearch(q, { language: "si" });
      for (const src of searchRes.sources) {
        if (seenUrls.has(src.url)) continue;
        const titleLower = src.title.toLowerCase();
        const urlLower = src.url.toLowerCase();
        const snippetLower = (src.snippet || "").toLowerCase();
        const matchesYear = titleLower.includes(String(year)) || urlLower.includes(String(year)) || snippetLower.includes(String(year));
        const matchesSubject = titleLower.includes(subject.toLowerCase()) || urlLower.includes(subject.toLowerCase()) || titleLower.includes(subjectFullName.toLowerCase()) || titleLower.includes(sinhalaSubjectName.toLowerCase()) || snippetLower.includes(sinhalaSubjectName.toLowerCase());
        let confidence = 0.45;
        if (matchesYear) confidence += 0.15;
        if (matchesSubject) confidence += 0.15;
        if (urlLower.endsWith(".pdf")) confidence += 0.15;
        if (urlLower.includes("google.com") || urlLower.includes("google.lk")) {
          continue;
        }
        seenUrls.add(src.url);
        candidates.push({
          id: `web_cand_${Date.now()}_${Math.random().toString(36).substring(4, 8)}`,
          title: src.title || `${year} ${subject} ${resourceType} PDF Candidate`,
          url: src.url,
          snippet: src.snippet,
          subject,
          year,
          resourceType,
          confidence: Math.min(confidence, 0.9),
          verified: false,
          candidate: true,
          badge: "Candidate Web PDF",
          reason: `Matches ${year} ${subject} based on search relevance.`
        });
      }
    } catch (e) {
      console.warn(`Web candidate search query failed: "${q}"`, e);
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}
var init_webPdfSearch = __esm({
  "server/ai/webPdfSearch.ts"() {
    "use strict";
    init_googleSearchGrounding();
  }
});

// server/knowledge/predictionEvidence.ts
var predictionEvidence_exports = {};
__export(predictionEvidence_exports, {
  retrievePastPaperAnalysisEvidence: () => retrievePastPaperAnalysisEvidence
});
function numericYear(value) {
  const parsed = Number(String(value || "").match(/\b(20\d{2})\b/)?.[1] || value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function compact(value, max = 260) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
function sourcePayload(source, usedInAnswer) {
  return {
    id: source.sourceId || source.id,
    sourceId: source.sourceId || source.id,
    title: source.title,
    year: source.year,
    subject: source.subject,
    resourceType: source.resourceType,
    storagePath: source.storagePath,
    downloadUrl: source.downloadUrl,
    url: source.url || source.downloadUrl || `/api/rag/sources/${source.sourceId || source.id}/download`,
    sourceType: source.resourceType,
    badge: source.resourceType === "marking_scheme" ? "Marking Scheme" : source.resourceType === "past_paper" ? "Past Paper" : source.resourceType === "syllabus" ? "Syllabus" : "Reference",
    usedInAnswer
  };
}
async function retrievePastPaperAnalysisEvidence(params) {
  const { uid, subject, isAdmin } = params;
  const targetYear = numericYear(params.targetYear) || 2026;
  const db = getAdminDb();
  const inventory = await getSourceInventory({ uid, subject, isAdmin });
  const relevantSources = [
    ...inventory.groups.pastPapers,
    ...inventory.groups.markingSchemes,
    ...inventory.groups.syllabus,
    ...inventory.groups.paperStructure
  ].filter((source) => {
    const year = numericYear(source.year || source.title);
    return !year || year < targetYear;
  });
  const sourceById = /* @__PURE__ */ new Map();
  for (const source of relevantSources) {
    sourceById.set(String(source.sourceId || source.id), source);
    for (const duplicateId of source.duplicateSourceIds || []) {
      sourceById.set(String(duplicateId), source);
    }
  }
  const questionSnap = await db.collection("exam_question_index").where("subject", "==", subject).get().catch(() => ({ docs: [] }));
  const indexedQuestions = questionSnap.docs.map((document) => ({ id: document.id, ...document.data() })).filter((question) => {
    const year = numericYear(question.year);
    const sourceKnown = !question.sourceId || sourceById.has(String(question.sourceId));
    return sourceKnown && (!year || year < targetYear);
  }).sort((a, b) => numericYear(a.year) - numericYear(b.year) || Number(a.questionNo || 0) - Number(b.questionNo || 0));
  const usedSourceIds = /* @__PURE__ */ new Set();
  let contextText = "";
  let evidenceMode = "metadata_only";
  if (indexedQuestions.length > 0) {
    evidenceMode = "question_index";
    const frequency = /* @__PURE__ */ new Map();
    const byType = /* @__PURE__ */ new Map();
    const lastAsked = /* @__PURE__ */ new Map();
    for (const question of indexedQuestions) {
      const lesson = compact(question.lesson || question.subtopic || question.concept || "Unclassified", 90);
      const type = String(question.questionType || question.paperType || "Unknown");
      const year = numericYear(question.year);
      frequency.set(lesson, (frequency.get(lesson) || 0) + 1);
      byType.set(type, (byType.get(type) || 0) + 1);
      if (year > (lastAsked.get(lesson) || 0)) lastAsked.set(lesson, year);
    }
    const frequencyLines = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([lesson, count]) => `${lesson} | frequency=${count} | lastAsked=${lastAsked.get(lesson) || "unknown"}`);
    const typeLines = [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => `${type}=${count}`);
    const records = [...indexedQuestions].sort((a, b) => numericYear(b.year) - numericYear(a.year) || Number(a.questionNo || 0) - Number(b.questionNo || 0)).slice(0, 120).map((question) => {
      if (question.sourceId) usedSourceIds.add(String(question.sourceId));
      return [
        question.year || "year?",
        question.questionType || question.paperType || "question",
        `Q${question.questionNo || "?"}${question.partNo ? `(${question.partNo})` : ""}`,
        question.lesson || "lesson?",
        question.subtopic || question.concept || "topic?",
        question.marks != null ? `${question.marks} marks` : "",
        compact(question.questionText, 180)
      ].filter(Boolean).join(" | ");
    });
    contextText = `
[PREDICTION DATASET: EXAM QUESTION INDEX]
[QUESTION TYPE COUNTS]
${typeLines.join("\n")}
[LESSON FREQUENCY + RECENCY]
${frequencyLines.join("\n")}
[RECENT QUESTION SAMPLE]
${records.join("\n")}
`;
  } else {
    const chunkLines = [];
    for (const source of relevantSources.slice(0, 24)) {
      const sourceId = String(source.sourceId || source.id);
      const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get().catch(() => ({ docs: [] }));
      const chunks = chunksSnap.docs.map((document) => document.data()).sort((a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0)).slice(0, 3);
      if (chunks.length === 0) continue;
      usedSourceIds.add(sourceId);
      for (const chunk of chunks) {
        chunkLines.push(`${source.year || "Year N/A"} | ${source.title} | page ${chunk.pageNumber || "?"} | ${compact(chunk.text, 520)}`);
      }
    }
    if (chunkLines.length > 0) {
      evidenceMode = "rag_chunks";
      contextText = `
[PREDICTION DATASET: INDEXED PDF CHUNKS]
${chunkLines.join("\n")}
`;
    }
  }
  const sourceYears = [...new Set(relevantSources.map((source) => numericYear(source.year || source.title)).filter(Boolean))].sort();
  const sources = relevantSources.filter((source) => usedSourceIds.size === 0 || usedSourceIds.has(String(source.sourceId || source.id)) || (source.duplicateSourceIds || []).some((id) => usedSourceIds.has(String(id)))).slice(0, 30).map((source) => sourcePayload(source, true));
  const stats = {
    subject,
    targetYear,
    uniqueRelevantPdfs: relevantSources.length,
    pastPapers: inventory.groups.pastPapers.filter((source) => !numericYear(source.year) || numericYear(source.year) < targetYear).length,
    markingSchemes: inventory.groups.markingSchemes.filter((source) => !numericYear(source.year) || numericYear(source.year) < targetYear).length,
    indexedQuestions: indexedQuestions.length,
    yearsCovered: sourceYears,
    evidenceMode
  };
  contextText = `
[PREDICTION COVERAGE]
${JSON.stringify(stats)}
${contextText}
`;
  return { contextText, sources, stats, hasEvidence: evidenceMode !== "metadata_only" };
}
var init_predictionEvidence = __esm({
  "server/knowledge/predictionEvidence.ts"() {
    "use strict";
    init_admin();
    init_sourceInventoryService();
  }
});

// server/ai/respondStream.ts
var respondStream_exports = {};
__export(respondStream_exports, {
  addStreamTrace: () => addStreamTrace,
  aiContinueStream: () => aiContinueStream,
  aiRespondStream: () => aiRespondStream,
  lastStreamTraces: () => lastStreamTraces,
  saveFinalChat: () => saveFinalChat
});
function addStreamTrace(trace) {
  lastStreamTraces.unshift(trace);
  if (lastStreamTraces.length > 20) {
    lastStreamTraces.pop();
  }
}
function emitSse(res, event, data) {
  try {
    res.write(`event: ${event}
`);
    const json = JSON.stringify(data ?? {});
    for (const line of json.split("\n")) {
      res.write(`data: ${line}
`);
    }
    res.write("\n");
    if (typeof res.flush === "function") res.flush();
  } catch (e) {
  }
}
async function safeCall(name, fn, fallback, res) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[STREAM_SAFE_CALL_FAILED] name=${name}`, err);
    try {
      emitSse(res, "status", {
        step: "warning",
        message: `${name} warning: continuing with available data`
      });
    } catch (e) {
    }
    return fallback;
  }
}
function getTemperature(mode) {
  switch (mode) {
    case "today_plan":
      return 0.25;
    case "study_plan":
      return 0.25;
    case "tutor_explanation":
      return 0.35;
    case "notes_generation":
      return 0.3;
    case "quiz_generation":
      return 0.35;
    case "past_paper_search":
      return 0.2;
    default:
      return 0.4;
  }
}
function getMaxTokens(mode) {
  if (mode === "uploaded_pdf_question_qa" || mode === "uploaded_pdf_qa" || mode === "rag_qa" || mode === "paper_question_qa") {
    return 8192;
  }
  return 2e3;
}
async function saveFinalChat(params) {
  params.assistantText = stripRawVisualBlocks(params.assistantText);
  try {
    const db = getAdminDb();
    const batch = db.batch();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const requestId = Date.now().toString() + Math.random().toString(36).substring(7);
    const { removeUndefinedDeep: removeUndefinedDeep2 } = await Promise.resolve().then(() => (init_chatSanitizer(), chatSanitizer_exports));
    const chatData = removeUndefinedDeep2({
      requestId,
      userPrompt: params.userText,
      assistantAnswer: params.assistantText,
      mode: params.mode,
      subject: params.subject || null,
      sources: (params.sources || []).map((s) => ({
        id: s.id || s.sourceId,
        title: s.title,
        url: s.url || null,
        storagePath: s.storagePath || null,
        badge: s.badge || null
      })).filter((s) => s.id || s.title),
      createdAt: timestamp,
      chatSaved: true
    });
    const historyRef = db.collection("users").doc(params.uid).collection("chat_history").doc(requestId);
    batch.set(historyRef, chatData);
    if (params.email) {
      const emailRef = db.collection("users").doc(params.email.toLowerCase()).collection("chat_history").doc(requestId);
      batch.set(emailRef, chatData);
    }
    await batch.commit();
    return { chatSaved: true, messageId: requestId };
  } catch (e) {
    console.warn("CHAT_SAVE_SKIPPED", e.message || e);
    return { chatSaved: false, errorCode: "SAVE_FAILED", errorMessage: e.message || String(e) };
  }
}
async function aiRespondStream(req, res) {
  const startedAt = Date.now();
  const requestId = req.body?.clientRequestId || "req_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  const trace = {
    requestId,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    completed: false,
    doneSent: false,
    clientClosed: false,
    tokenCount: 0,
    totalChars: 0,
    chatSaved: false
  };
  addStreamTrace(trace);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  const abortController = registerRequest(requestId);
  const signal = abortController.signal;
  const heartbeatInterval = setInterval(() => {
    try {
      emitSse(res, "heartbeat", { ok: true, requestId, ts: Date.now() });
      trace.lastEvent = "heartbeat";
    } catch (e) {
    }
  }, 1e4);
  req.on("close", () => {
    cancelRequest(requestId);
    console.log(`[STREAM] STREAM_CLIENT_CLOSED requestId=${requestId}`);
    trace.clientClosed = true;
    trace.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  });
  try {
    const { prompt, activeSubject, mode: requestedMode = "auto", history = [], image, attachments } = req.body;
    const user = req.user;
    const quizStartIntent = detectPaperMcqQuizStart(prompt, activeSubject);
    const activePaperQuiz = quizStartIntent ? null : await safeCall("getActivePaperMcqQuiz", () => getActivePaperMcqQuiz(user.uid), null, res);
    if (activePaperQuiz) {
      const action = parsePaperMcqQuizAction(prompt, activePaperQuiz);
      const evaluation = await safeCall(
        "evaluatePaperMcqQuizAnswer",
        () => evaluatePaperMcqQuizAnswer({ uid: user.uid, session: activePaperQuiz, action }),
        { kind: "invalid", message: "\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB \u0DBD\u0DD9\u0DC3 1, 2, 3, 4 \u0DC4\u0DDD 5 \u0DBA\u0DC0\u0DB1\u0DCA\u0DB1.", session: activePaperQuiz },
        res
      );
      if (evaluation.kind === "invalid" || evaluation.kind === "not_ready") {
        emitSse(res, "token", { text: evaluation.message });
        const chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: evaluation.message,
          mode: "paper_mcq_quiz",
          subject: activePaperQuiz.subject
        });
        trace.completed = true;
        trace.chatSaved = chatRes2.chatSaved;
        trace.messageId = chatRes2.messageId;
        emitSse(res, "done", { ok: true, completed: true, requestId, chatSaved: chatRes2.chatSaved, messageId: chatRes2.messageId || null });
        trace.doneSent = true;
        return;
      }
      if (evaluation.kind === "stopped") {
        const stoppedText = `Quiz \u0D91\u0D9A \u0DB1\u0DC0\u0DAD\u0DCF \u0D87\u0DAD.

**\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DB5\u0DBD\u0DBA:** \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 ${evaluation.session.correctCount} \xB7 \u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 ${evaluation.session.wrongCount} \xB7 \u0DB8\u0D9F\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DCA ${evaluation.session.skippedCount}`;
        emitSse(res, "token", { text: stoppedText });
        const chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: stoppedText,
          mode: "paper_mcq_quiz",
          subject: activePaperQuiz.subject
        });
        trace.completed = true;
        trace.chatSaved = chatRes2.chatSaved;
        trace.messageId = chatRes2.messageId;
        emitSse(res, "done", { ok: true, completed: true, requestId, chatSaved: chatRes2.chatSaved, messageId: chatRes2.messageId || null });
        trace.doneSent = true;
        return;
      }
      if (evaluation.kind === "finished") {
        const summary = `${evaluation.feedback}

---

### Quiz \u0D85\u0DC0\u0DC3\u0DB1\u0DCA

**\u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2:** ${evaluation.session.correctCount}  
**\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2:** ${evaluation.session.wrongCount}  
**\u0DB8\u0D9F\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DCA:** ${evaluation.session.skippedCount}  
**\u0DBD\u0D9A\u0DD4\u0DAB:** ${evaluation.session.correctCount}/${evaluation.session.endQuestionNo - evaluation.session.startQuestionNo + 1}`;
        emitSse(res, "token", { text: summary });
        const chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: summary,
          mode: "paper_mcq_quiz",
          subject: activePaperQuiz.subject
        });
        trace.completed = true;
        trace.chatSaved = chatRes2.chatSaved;
        trace.messageId = chatRes2.messageId;
        emitSse(res, "done", { ok: true, completed: true, requestId, chatSaved: chatRes2.chatSaved, messageId: chatRes2.messageId || null });
        trace.doneSent = true;
        return;
      }
      if (evaluation.kind === "continue" && evaluation.nextQuestionNo) {
        const source = {
          id: activePaperQuiz.sourceId,
          sourceId: activePaperQuiz.sourceId,
          storagePath: activePaperQuiz.storagePath || null,
          downloadUrl: activePaperQuiz.downloadUrl || null,
          url: activePaperQuiz.downloadUrl || null,
          title: activePaperQuiz.title || `${activePaperQuiz.year} ${activePaperQuiz.subject} Paper`,
          subject: activePaperQuiz.subject,
          year: activePaperQuiz.year,
          badge: "Official Source"
        };
        emitSse(res, "sources", { sources: [source] });
        emitSse(res, "direct_pdf_handoff_required", {
          sourceId: activePaperQuiz.sourceId,
          storagePath: activePaperQuiz.storagePath || null,
          downloadUrl: activePaperQuiz.downloadUrl || null,
          title: source.title,
          subject: activePaperQuiz.subject,
          year: activePaperQuiz.year,
          questionNo: String(evaluation.nextQuestionNo),
          questionType: "MCQ",
          prompt: `${activePaperQuiz.year} ${activePaperQuiz.subject} MCQ ${evaluation.nextQuestionNo}`,
          scanMode: "full_paper",
          interactionMode: "quiz_question",
          quizStartQuestionNo: activePaperQuiz.startQuestionNo,
          quizEndQuestionNo: activePaperQuiz.endQuestionNo,
          quizFeedback: evaluation.feedback,
          reason: "PAPER_MCQ_QUIZ_NEXT",
          message: `MCQ ${evaluation.nextQuestionNo} load \u0D9A\u0DBB\u0DB8\u0DD2\u0DB1\u0DCA \u0DB4\u0DC0\u0DAD\u0DD3.`
        });
        emitSse(res, "done", {
          ok: true,
          completed: false,
          pending: true,
          requestId,
          finishReason: "pending_direct_pdf_qa",
          canContinue: true,
          needsClientFile: false,
          sources: [source]
        });
        trace.doneSent = true;
        return;
      }
    }
    const { trackAIUsage: trackAIUsage2 } = await Promise.resolve().then(() => (init_usageTracker(), usageTracker_exports));
    let allSources = [];
    emitSse(res, "status", { step: "started", message: "Starting stream..." });
    emitSse(res, "status", { label: "Thinking" });
    const { detectOfficialPaperCandidate: detectOfficialPaperCandidate2 } = await Promise.resolve().then(() => (init_paperQuestionParser(), paperQuestionParser_exports));
    const detectedPaperIntent = detectOfficialPaperCandidate2(prompt, activeSubject);
    let paperIntent = quizStartIntent ? {
      ...detectedPaperIntent,
      isOfficialPaperCandidate: true,
      year: quizStartIntent.year,
      subject: quizStartIntent.subject,
      questionNo: String(quizStartIntent.startQuestionNo),
      questionType: "MCQ",
      needsSubjectClarification: false
    } : detectedPaperIntent;
    if (paperIntent.isOfficialPaperCandidate && paperIntent.needsSubjectClarification) {
      const msg = `\u0DB8\u0DDA ${paperIntent.year} paper \u0D91\u0D9A\u0DDA subject \u0D91\u0D9A \u0DB8\u0DDC\u0D9A\u0D9A\u0DCA\u0DAF? (SFT / ET / ICT)`;
      emitSse(res, "token", { text: msg });
      trace.lastEvent = "token";
      let chatRes2 = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: msg,
        mode: "paper_question_qa",
        subject: activeSubject
      });
      if (chatRes2 && chatRes2.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes2.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      return;
    }
    const route = await safeCall("routeKnowledgeRequest", () => routeKnowledgeRequest({
      prompt,
      uid: user.uid,
      email: user.email,
      activeSubject: paperIntent.subject || activeSubject,
      conversationHistory: history
    }), {
      mode: paperIntent.isOfficialPaperCandidate ? "paper_question_qa" : "normal_chat",
      answerHints: { mustUseRag: true, mustUseGoogleSearch: false, mustUseUrlContext: false, mustAskClarification: false },
      entities: {
        year: paperIntent.year,
        subject: paperIntent.subject,
        questionNo: paperIntent.questionNo,
        questionType: paperIntent.questionType
      }
    }, res);
    if (paperIntent.isOfficialPaperCandidate) {
      console.log(`[OFFICIAL_PAPER_GATE] year=${paperIntent.year} subject=${paperIntent.subject} questionNo=${paperIntent.questionNo} type=${paperIntent.questionType}`);
      console.log(`[AI_RESPOND_STREAM] Forcing paper_question_qa mode`);
      route.mode = "paper_question_qa";
      route.entities.year = paperIntent.year || route.entities.year;
      route.entities.subject = paperIntent.subject || route.entities.subject;
      route.entities.questionNo = paperIntent.questionNo || route.entities.questionNo;
      route.entities.questionType = paperIntent.questionType || route.entities.questionType;
      route.answerHints.mustUseRag = true;
    }
    if (paperIntent.isOfficialPaperCandidate && route.mode === "normal_chat") {
      console.log(`[OFFICIAL_PAPER_GATE] Converted normal_chat -> paper_question_qa`);
      route.mode = "paper_question_qa";
    }
    const activeConversationState = await getConversationState(user.uid);
    const lowerPrompt = prompt.toLowerCase();
    const isRecheckRequest = [
      "recheck",
      "check again",
      "verify again",
      "\u0DB1\u0DD0\u0DC0\u0DAD \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1",
      "\u0DB1\u0DD0\u0DC0\u0DAD \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF",
      "\u0D86\u0DBA\u0DD9\u0DAD\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1",
      "\u0D86\u0DBA\u0DD9 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1"
    ].some((phrase) => lowerPrompt.includes(phrase));
    if (!paperIntent.isOfficialPaperCandidate && isRecheckRequest && activeConversationState.selectedQuestionId) {
      const { getSourceInventory: getSourceInventory2 } = await Promise.resolve().then(() => (init_sourceInventoryService(), sourceInventoryService_exports));
      const isAdminUser2 = user.roles?.includes("admin") || user.admin === true;
      const inventory = await safeCall(
        "getSourceInventoryForRecheck",
        () => getSourceInventory2({ uid: user.uid, subject: activeConversationState.activeSubject, isAdmin: isAdminUser2 }),
        { all: [] },
        res
      );
      const selectedId = activeConversationState.selectedSourceId || activeConversationState.activeSourceIds[0];
      const selectedSource = (inventory.all || []).find((source) => {
        const ids = [source.id, source.sourceId, ...source.duplicateSourceIds || []].map(String);
        return selectedId && ids.includes(String(selectedId));
      });
      if (selectedSource) {
        paperIntent = {
          isOfficialPaperCandidate: true,
          year: selectedSource.year,
          subject: selectedSource.subject || activeConversationState.activeSubject || activeSubject || "SFT",
          questionNo: String(activeConversationState.selectedQuestionId).replace(/^Q/i, ""),
          questionType: "MCQ",
          needsSubjectClarification: false
        };
        route.mode = "paper_question_qa";
        route.entities.year = paperIntent.year;
        route.entities.subject = paperIntent.subject;
        route.entities.questionNo = paperIntent.questionNo;
        route.entities.questionType = paperIntent.questionType;
        route.entities.activeSourceId = selectedSource.id || selectedSource.sourceId;
        route.answerHints.mustUseRag = true;
      }
    }
    const policy = resolveAnswerPolicy(prompt, route, activeSubject, attachments);
    const evidence = await retrieveEvidence(user.uid, prompt, route, policy, activeConversationState);
    if (evidence.selectedSource) {
      route.entities.activeSourceId = evidence.selectedSource.id;
      route.entities.year = evidence.selectedSource.year || route.entities.year;
    }
    await updateConversationState(user.uid, {
      activeSubject: evidence.subject || activeConversationState.activeSubject,
      activeLessonIds: evidence.lessonIds.length > 0 ? evidence.lessonIds : activeConversationState.activeLessonIds,
      activeSourceIds: evidence.allowedSourceIds.length > 0 ? evidence.allowedSourceIds : activeConversationState.activeSourceIds,
      lastIntent: evidence.intent
    });
    if (policy.intent === "blocked_or_unsafe") {
      emitSse(res, "token", { text: policy.blockingMessage });
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: null, chatSaved: false, sources: [] });
      return;
    }
    if (!policy.allowSources) {
      route.answerHints.mustUseRag = false;
      route.answerHints.mustUseGoogleSearch = false;
      route.answerHints.mustUseUrlContext = false;
    }
    const correctionPhrases = ["recheck", "check again", "verify again", "oka fake", "werdi", "weradi", "oka newe", "\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2\u0DBA\u0DD2", "\u0D95\u0D9A \u0DB6\u0DDC\u0DBB\u0DD4", "oka boru", "not correct", "fake", "wrong", "boru", "boru kiynn epa", "boru dewal", "\u0DB6\u0DDC\u0DBB\u0DD4", "\u0DB8\u0DDA\u0D9A \u0DB6\u0DDC\u0DBB\u0DD4", "\u0DB1\u0DD1", "not this"];
    const isCorrection = correctionPhrases.some((p) => lowerPrompt.includes(p));
    const lastMsg = history && history.length > 0 ? history[history.length - 1] : null;
    const lastPaperInfo = lastMsg?.metadata?.paperInfo || lastMsg?.paperInfo;
    if (isCorrection && lastPaperInfo?.sourceId && lastPaperInfo?.questionNo) {
      console.log(`[AI_RESPOND_STREAM] Correction phrase detected for ${lastPaperInfo.sourceId} Q${lastPaperInfo.questionNo}`);
      emitSse(res, "status", { step: "correction", message: "Processing correction feedback..." });
      const { handleWrongAnswerFeedback: handleWrongAnswerFeedback2 } = await Promise.resolve().then(() => (init_wrongAnswerHandler(), wrongAnswerHandler_exports));
      await handleWrongAnswerFeedback2({
        uid: user.uid,
        sourceId: lastPaperInfo.sourceId,
        questionType: lastPaperInfo.questionType || "MCQ",
        questionNo: lastPaperInfo.questionNo,
        reason: prompt,
        originalPrompt: prompt,
        badAnswer: lastMsg?.content || lastMsg?.text || "",
        mode: "paper_question_qa",
        year: lastPaperInfo.year,
        subject: lastPaperInfo.subject
      });
      emitSse(res, "status", { step: "correction", message: "Feedback saved. Rechecking the exact PDF evidence\u2026" });
      route.mode = "paper_question_qa";
      route.entities.year = lastPaperInfo.year;
      route.entities.subject = lastPaperInfo.subject;
      route.entities.questionNo = lastPaperInfo.questionNo;
      route.entities.questionType = lastPaperInfo.questionType || "MCQ";
    }
    if (route.answerHints.mustAskClarification && route.entities.clarificationQuestion) {
      emitSse(res, "token", { text: route.entities.clarificationQuestion });
      trace.lastEvent = "token";
      let chatRes2 = { chatSaved: false };
      try {
        chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: route.entities.clarificationQuestion,
          mode: route.mode,
          subject: activeSubject
        });
      } catch (err) {
        console.warn("CHAT_SAVE_SKIPPED", err);
        chatRes2 = { chatSaved: false, errorCode: "SAVE_THROWN", errorMessage: err?.message || "Chat save failed" };
      }
      if (chatRes2 && chatRes2.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes2.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }
    const selectedPdfQuestion = parseSelectedPdfQuestionFollowup(prompt);
    if (activeConversationState.selectedSourceId && selectedPdfQuestion) {
      const { getSourceInventory: getSourceInventory2 } = await Promise.resolve().then(() => (init_sourceInventoryService(), sourceInventoryService_exports));
      const selectedSubject = evidence.subject || activeConversationState.activeSubject || activeSubject || "SFT";
      const isAdminUser2 = user.roles?.includes("admin") || user.admin === true;
      const inventory = await getSourceInventory2({ uid: user.uid, subject: selectedSubject, isAdmin: isAdminUser2 });
      const availableSources = [
        ...inventory.groups.pastPapers,
        ...inventory.groups.markingSchemes,
        ...inventory.groups.syllabus,
        ...inventory.groups.uploadedPdfs,
        ...inventory.groups.paperStructure
      ];
      const selectedSource = availableSources.find((source) => {
        const id = String(source.sourceId || source.id || "");
        return id === String(activeConversationState.selectedSourceId);
      });
      if (selectedSource) {
        const sourceId = selectedSource.sourceId || selectedSource.id;
        const sourcePayload2 = {
          ...selectedSource,
          id: sourceId,
          sourceId,
          url: selectedSource.url || `/api/rag/sources/${sourceId}/download`,
          usedInAnswer: true
        };
        await updateConversationState(user.uid, {
          activeSubject: selectedSubject,
          activeSourceIds: [sourceId],
          selectedSourceId: sourceId,
          selectedQuestionId: selectedPdfQuestion.questionNo,
          currentQuestionIndex: Number(selectedPdfQuestion.questionNo),
          evidenceMode: "strict",
          allowGeneratedContent: false,
          lastIntent: "selected_resource_discussion"
        });
        emitSse(res, "sources", { sources: [sourcePayload2] });
        emitSse(res, "direct_pdf_handoff_required", {
          sourceId,
          storagePath: selectedSource.storagePath,
          downloadUrl: selectedSource.downloadUrl || selectedSource.url,
          title: selectedSource.title,
          subject: selectedSubject,
          year: selectedSource.year,
          questionNo: selectedPdfQuestion.questionNo,
          questionType: selectedPdfQuestion.questionType,
          prompt,
          reason: "SELECTED_PDF_QUESTION_FOLLOWUP",
          message: "Selected PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA exact question evidence \u0D91\u0D9A \u0DC3\u0DDC\u0DBA\u0DB8\u0DD2\u0DB1\u0DCA \u0DB4\u0DC0\u0DAD\u0DD3."
        });
        emitSse(res, "done", {
          ok: true,
          completed: false,
          pending: true,
          requestId,
          finishReason: "pending_direct_pdf_qa",
          reason: "SELECTED_PDF_QUESTION_FOLLOWUP",
          canContinue: true,
          sources: [sourcePayload2],
          paperInfo: {
            sourceId,
            questionNo: selectedPdfQuestion.questionNo,
            year: selectedSource.year,
            subject: selectedSubject,
            questionType: selectedPdfQuestion.questionType,
            prompt,
            extractionMethod: "pending_direct_pdf_qa"
          }
        });
        trace.doneSent = true;
        trace.completed = false;
        return;
      }
    }
    if (route.mode === "lesson_pdf_search") {
      const lessonName = route.entities.lesson || evidence.lessonIds[0] || "requested lesson";
      const lessonSources = (evidence.candidates || []).map((source) => {
        const id = source.sourceId || source.id;
        return {
          ...source,
          id,
          sourceId: id,
          url: source.url || `/api/rag/sources/${id}/download`,
          badge: "Lesson PDF",
          usedInAnswer: true
        };
      });
      const answer = lessonSources.length > 0 ? `\u201C${lessonSources[0].title}\u201D \u0DAD\u0DDD\u0DBB\u0DCF\u0D9C\u0DAD\u0DCA\u0DAD\u0DCF. \u0DAF\u0DD0\u0DB1\u0DCA \u201CQ1\u201D, \u201C4th MCQ\u201D \u0DC4\u0DDD \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0DDA \u0D9A\u0DDC\u0DA7\u0DC3\u0D9A\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1.` : `\u201C${lessonName}\u201D \u0DC3\u0DB3\u0DC4\u0DCF save \u0D9A\u0DBB\u0DB4\u0DD4 PDF \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DB8\u0DD4 \u0DC0\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0.`;
      if (lessonSources.length > 0) {
        const selected = lessonSources[0];
        await updateConversationState(user.uid, {
          activeSubject: route.entities.subject || activeSubject || activeConversationState.activeSubject,
          activeLessonIds: evidence.lessonIds.length > 0 ? evidence.lessonIds : activeConversationState.activeLessonIds,
          activeSourceIds: lessonSources.map((source) => source.sourceId || source.id).filter(Boolean),
          selectedSourceId: selected.sourceId || selected.id,
          selectedQuestionId: null,
          currentQuestionIndex: null,
          evidenceMode: "strict",
          allowGeneratedContent: false,
          lastIntent: "lesson_pdf_search"
        });
        emitSse(res, "sources", { sources: lessonSources });
      }
      emitSse(res, "token", { text: answer });
      const chatRes2 = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: route.mode,
        subject: route.entities.subject || activeSubject,
        sources: lessonSources
      });
      if (chatRes2?.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes2.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", {
        ok: lessonSources.length > 0,
        completed: true,
        requestId,
        messageId: chatRes2?.messageId || null,
        chatSaved: trace.chatSaved,
        sources: lessonSources,
        finishReason: lessonSources.length > 0 ? "lesson_sources_found" : "lesson_sources_missing"
      });
      trace.doneSent = true;
      return;
    }
    emitSse(res, "status", { step: "profile", status: "reading" });
    const userContext = await safeCall("loadUserAIContext", () => loadUserAIContext(user.uid, user.email), { activeSubject }, res);
    userContext.activeSubject = activeSubject;
    if (route.mode === "zscore_prediction") {
      const zctx = userContext?.zScoreContext || {};
      emitSse(res, "status", { step: "zscore_db", status: "reading" });
      const formatMetric = (value, digits = 4) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "N/A";
      let fastAns = `### Exam Score Predictor Z estimate

\u0D94\u0DBA\u0DCF\u0D9C\u0DDA syllabus progress \u0D91\u0D9A\u0DD9\u0DB1\u0DCA Exam Score Predictor \u0D9C\u0DAB\u0DB1\u0DBA \u0D9A\u0DC5 planning estimate \u0D91\u0D9A: **${formatMetric(zctx.latestOverallZScore)}**.
`;
      fastAns += zctx.targetZScore !== void 0 ? `Target Z-score \u0D91\u0D9A: **${zctx.targetZScore}**.
` : `Target Z-score \u0D91\u0D9A \u0DAD\u0DC0\u0DB8 Profile \u0D91\u0D9A\u0DDA set \u0D9A\u0DBB\u0DBD\u0DCF \u0DB1\u0DD0\u0DC4\u0DD0.
`;
      if (zctx.gapToTarget !== void 0) fastAns += `Target gap \u0D91\u0D9A: **${formatMetric(zctx.gapToTarget)}**.
`;
      if (zctx.rankEstimate?.districtRank) fastAns += `Estimated district rank: **\u2248 ${Number(zctx.rankEstimate.districtRank).toLocaleString()}**.
`;
      if (zctx.rankEstimate?.islandRank) fastAns += `Estimated island rank: **\u2248 ${Number(zctx.rankEstimate.islandRank).toLocaleString()}**.

`;
      fastAns += `**Projected marks / subject estimates:**
`;
      for (const subject of ["sft", "et", "ict"]) {
        const label = subject.toUpperCase();
        const mark = zctx.rawPaperAverages?.[subject];
        const estimate = zctx.subjectZScores?.[subject];
        fastAns += `- ${label}: ${typeof mark === "number" ? `${mark.toFixed(1)}%` : "N/A"} \xB7 Z ${formatMetric(estimate)}
`;
      }
      fastAns += `
`;
      if (zctx.latestUpdatedAt) fastAns += `*Last updated: ${new Date(zctx.latestUpdatedAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}*

`;
      fastAns += `> \u0DB8\u0DDA\u0DC0\u0DCF Exam Score Predictor planning estimates. Official exam Z-score \u0DC4\u0DDD official district/island rank \u0DB1\u0DDC\u0DC0\u0DDA.`;
      emitSse(res, "token", { text: fastAns });
      trace.lastEvent = "token";
      let chatRes2 = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: fastAns,
        mode: "zscore_prediction",
        subject: activeSubject
      });
      if (chatRes2 && chatRes2.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes2.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }
    if (route.mode === "lesson_marks_intent") {
      emitSse(res, "status", { step: "syllabus_db", status: "searching" });
      const requestedSubject = route.entities.subject || activeSubject || "SFT";
      const lessonQuery = route.entities.lesson || prompt;
      const { resolveExamResources: resolveExamResources2 } = await Promise.resolve().then(() => (init_examResourceResolver(), examResourceResolver_exports));
      const resData = await safeCall("resolveExamResources", () => resolveExamResources2({
        prompt: lessonQuery,
        uid: user.uid,
        subject: requestedSubject
      }), {
        ok: false,
        sources: [],
        bestTextBlocks: [],
        needsWebSearch: true,
        hasExactQuestionText: false,
        hasPdfSource: false,
        hasMarkingScheme: false,
        hasSyllabus: false,
        hasPaperStructure: false
      }, res);
      const staticSyllabus = resData.sources.find((s) => s.badge === "Static Syllabus");
      let ansText = `### \u{1F4CA} ${requestedSubject} Lesson Weights (Paper Structure DB & fallback)

`;
      if (staticSyllabus) {
        ansText += `**Syllabus Weighting Fallback \u0D85\u0DB1\u0DD4\u0DC0:**

`;
        ansText += `${staticSyllabus.text}

`;
      } else {
        ansText += `\u0DC0\u0DD2\u0DC2\u0DBA \u0DB1\u0DD2\u0DBB\u0DCA\u0DAF\u0DDA\u0DC1\u0DBA\u0DA7 \u0D85\u0DB1\u0DD4\u0DC0 MCQ, structured, \u0DC3\u0DC4 essay \u0D9A\u0DDC\u0DA7\u0DC3\u0DCA\u0DC0\u0DBD \u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0DB6\u0DD9\u0DAF\u0DD3\u0DB8 \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DAD \u0DB1\u0DDC\u0DC4\u0DD0\u0D9A\u0DD2 \u0DC0\u0DD2\u0DBA.`;
      }
      ansText += `
*Z-score impact priority:* High priority.`;
      emitSse(res, "token", { text: stripRawVisualBlocks(ansText) });
      trace.lastEvent = "token";
      let chatRes2 = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: ansText,
        mode: "lesson_marks_intent",
        subject: requestedSubject
      });
      if (chatRes2 && chatRes2.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes2.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }
    if (route.mode === "pdf_inventory_request") {
      emitSse(res, "status", { step: "sources_db", status: "searching" });
      const requestedSubject = route.entities.subject || activeSubject || void 0;
      const uid = user.uid;
      const userEmail = (user.email || "").toLowerCase();
      const isAdmin = user.roles?.includes("admin") || user.admin === true;
      const { getSourceInventory: getSourceInventory2 } = await Promise.resolve().then(() => (init_sourceInventoryService(), sourceInventoryService_exports));
      const inventory = await getSourceInventory2({
        uid,
        subject: requestedSubject,
        isAdmin
      });
      const allSources2 = [];
      const groups = inventory.groups;
      allSources2.push(
        ...groups.pastPapers,
        ...groups.markingSchemes,
        ...groups.syllabus,
        ...groups.paperStructure,
        ...groups.uploadedPdfs,
        ...groups.images
      );
      const pastPapers = groups.pastPapers;
      const markingSchemes = groups.markingSchemes;
      const syllabusList = groups.syllabus;
      const paperStructureList = groups.paperStructure;
      const imagesList = groups.images;
      const uploadedList = groups.uploadedPdfs;
      const sseSources = allSources2.map((s) => ({
        id: s.id,
        sourceId: s.sourceId || s.id,
        title: s.title,
        url: s.url || s.downloadUrl || `/api/rag/sources/${s.id}/download`,
        downloadUrl: s.downloadUrl || s.url || null,
        storagePath: s.storagePath,
        badge: s.resourceType === "past_paper" ? "Past Paper" : s.resourceType === "marking_scheme" ? "Marking Scheme" : s.resourceType === "syllabus" ? "Syllabus" : s.resourceType === "paper_structure" ? "Paper Structure" : "Uploaded PDF",
        confidence: 1,
        sourceType: s.resourceType,
        sourceScope: s.sourceScope
      }));
      emitSse(res, "sources", { sources: sseSources });
      let answer = `### PDF Library

`;
      answer += `Duplicate copies merge \u0D9A\u0DBB\u0DBD\u0DCF **unique sources ${allSources2.length}\u0D9A\u0DCA** \u0DC4\u0DB8\u0DD4 \u0DC0\u0DD4\u0DAB\u0DCF.

`;
      answer += `- Past Papers: **${pastPapers.length}**
`;
      answer += `- Marking Schemes: **${markingSchemes.length}**
`;
      answer += `- Syllabus: **${syllabusList.length}**
`;
      answer += `- Paper Structure: **${paperStructureList.length}**
`;
      answer += `- Uploaded PDFs: **${uploadedList.length}**
`;
      if (imagesList.length > 0) answer += `- Images: **${imagesList.length}**
`;
      const recentPapers = pastPapers.slice(0, 8);
      if (recentPapers.length > 0) {
        answer += `
**Recent papers**
`;
        answer += recentPapers.map((paper) => `- ${paper.year || "Year N/A"} \xB7 ${paper.title}`).join("\n");
        answer += `
`;
      }
      if (allSources2.length === 0) {
        answer = `\u274C Firebase \u0D91\u0D9A\u0DDA PDFs \u0DAD\u0DC0\u0DB8 \u0DC4\u0DB8\u0DCA\u0DB6\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0. Upload \u0D9A\u0DC5\u0DCF \u0DB1\u0DB8\u0DCA index/reload \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.`;
      } else {
        answer += `
\u0DB4\u0DC4\u0DC5 source cards \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA \u0D95\u0DB1\u0DD1\u0DB8 PDF \u0D91\u0D9A open \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. Paper question \u0D91\u0D9A\u0D9A\u0DCA \u0D85\u0DC4\u0DB1 \u0DC0\u0DD2\u0DA7 system \u0D91\u0D9A \u0D92 PDF \u0D91\u0D9A direct scan \u0D9A\u0DBB\u0DBA\u0DD2.`;
      }
      emitSse(res, "token", { text: stripRawVisualBlocks(answer) });
      trace.lastEvent = "token";
      let chatRes2 = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: "pdf_inventory_request",
        subject: requestedSubject,
        sources: sseSources
      });
      if (chatRes2 && chatRes2.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes2.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: sseSources });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }
    const hasUploadedPdf = prompt.includes("[Uploaded PDF:");
    const isPaperQa = !hasUploadedPdf && (route.mode === "paper_question_qa" || route.mode === "marking_scheme_request" || route.mode === "pdf_link_request");
    if (isPaperQa) {
      const requestedSubject = route.entities.subject || activeSubject || "SFT";
      const requestedYear = route.entities.year;
      const requestedQuestionNo = route.entities.questionNo;
      if (requestedSubject && requestedYear) {
        emitSse(res, "status", { step: "exam_db", status: "searching" });
        let paperSource = null;
        let resolution = { sources: [], paperSource: null };
        const { resolveStrictSource: resolveStrictSource2 } = await Promise.resolve().then(() => (init_sourceResolver(), sourceResolver_exports));
        const { getSourceInventory: getSourceInventory2 } = await Promise.resolve().then(() => (init_sourceInventoryService(), sourceInventoryService_exports));
        const isAdminUser2 = user.roles?.includes("admin") || user.admin === true;
        const inventory = await getSourceInventory2({ uid: user.uid, subject: requestedSubject, isAdmin: isAdminUser2 });
        const allAvailableSources = [...inventory.groups.pastPapers, ...inventory.groups.markingSchemes, ...inventory.groups.syllabus, ...inventory.groups.uploadedPdfs];
        const strictRes = resolveStrictSource2(allAvailableSources, {
          year: requestedYear,
          subject: requestedSubject,
          activeSourceId: route.entities.activeSourceId || activeConversationState.selectedSourceId,
          prompt,
          expectedResourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper"
        });
        if (strictRes.sourceLocked && strictRes.selectedSource) {
          console.log(`[AI_CORE] Source Locked: ${strictRes.selectedSource.title}`);
          paperSource = strictRes.selectedSource;
          allSources = [{
            sourceId: paperSource.id || paperSource.sourceId,
            title: paperSource.title,
            url: paperSource.url || paperSource.downloadUrl || null,
            downloadUrl: paperSource.downloadUrl || paperSource.url || null,
            storagePath: paperSource.storagePath || null,
            badge: "Official Source",
            year: paperSource.year,
            subject: paperSource.subject,
            resourceType: paperSource.resourceType
          }];
        } else {
          if (paperIntent.isOfficialPaperCandidate || route.mode === "paper_question_qa") {
            const msg = `${requestedYear || ""} ${requestedSubject || ""} ${paperIntent.questionType || "MCQ"} ${requestedQuestionNo || ""} \u0DC3\u0DB3\u0DC4\u0DCF exact official paper source lock \u0DC0\u0DD9\u0DBD\u0DCF \u0DB1\u0DD0\u0DC4\u0DD0. \u0D92 \u0DB1\u0DD2\u0DC3\u0DCF answer guess \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DC4\u0DD0.`;
            emitSse(res, "evidence_missing", {
              reason: "STRICT_SOURCE_LOCK_FAILED",
              message: msg
            });
            emitSse(res, "token", { text: msg });
            emitSse(res, "done", {
              ok: false,
              completed: true,
              requestId,
              finishReason: "blocked_no_source_lock"
            });
            trace.doneSent = true;
            return;
          }
          const { resolveExamResources: resolveExamResources2 } = await Promise.resolve().then(() => (init_examResourceResolver(), examResourceResolver_exports));
          resolution = await safeCall("resolveExamResources", () => resolveExamResources2({
            prompt,
            uid: user.uid,
            subject: requestedSubject,
            year: requestedYear,
            resourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
            questionNo: requestedQuestionNo
          }), { sources: [] }, res);
          paperSource = resolution.paperSource;
          resolution.sources.forEach((s) => {
            allSources.push({ id: s.id, title: s.title, url: s.url, storagePath: s.storagePath, badge: s.badge || "Verified" });
          });
        }
        if (paperSource) {
          if (!allSources.find((s) => s.id === paperSource.id)) {
            allSources.push({
              sourceId: paperSource.id,
              title: paperSource.title,
              url: paperSource.url || paperSource.downloadUrl,
              downloadUrl: paperSource.downloadUrl || paperSource.url,
              storagePath: paperSource.storagePath,
              badge: "Locked Source"
            });
          }
          emitSse(res, "sources", { sources: allSources });
          await updateConversationState(user.uid, {
            activeSubject: requestedSubject,
            activeSourceIds: [paperSource.id || paperSource.sourceId],
            selectedSourceId: paperSource.id || paperSource.sourceId,
            selectedQuestionId: requestedQuestionNo ? String(requestedQuestionNo) : null,
            currentQuestionIndex: requestedQuestionNo ? Number(requestedQuestionNo) : null,
            requestedResourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
            evidenceMode: "strict",
            allowGeneratedContent: false,
            lastIntent: route.mode
          });
        }
        const hasPaperSource = !!paperSource;
        const questionId = paperSource?.id && requestedQuestionNo ? `${paperSource.id}_${paperIntent.questionType || "MCQ"}_${requestedQuestionNo}`.replace(/\//g, "_") : null;
        if (hasPaperSource && quizStartIntent && route.mode !== "pdf_link_request") {
          const sourceId = paperSource.id || paperSource.sourceId;
          const storagePath = paperSource.storagePath || null;
          const downloadUrl = paperSource.downloadUrl || paperSource.url || null;
          const title = paperSource.title || `${quizStartIntent.year} ${quizStartIntent.subject} Paper`;
          await beginPaperMcqQuiz({
            uid: user.uid,
            sourceId,
            storagePath,
            downloadUrl,
            title,
            year: quizStartIntent.year,
            subject: quizStartIntent.subject,
            startQuestionNo: quizStartIntent.startQuestionNo,
            endQuestionNo: quizStartIntent.endQuestionNo
          });
          emitSse(res, "direct_pdf_handoff_required", {
            sourceId,
            storagePath,
            downloadUrl,
            title,
            subject: quizStartIntent.subject,
            year: quizStartIntent.year,
            questionNo: String(quizStartIntent.startQuestionNo),
            questionType: "MCQ",
            prompt: `${quizStartIntent.year} ${quizStartIntent.subject} MCQ ${quizStartIntent.startQuestionNo}`,
            scanMode: "full_paper",
            interactionMode: "quiz_question",
            quizStartQuestionNo: quizStartIntent.startQuestionNo,
            quizEndQuestionNo: quizStartIntent.endQuestionNo,
            quizFeedback: `### Quiz \u0D86\u0DBB\u0DB8\u0DCA\u0DB7\u0DBA\u0DD2

\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 Error Log \u0D91\u0D9A\u0DA7 \u0DC3\u0DCA\u0DC0\u0DBA\u0D82\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA\u0DC0 \u0DC3\u0DD4\u0DBB\u0DD0\u0D9A\u0DDA.`,
            reason: "PAPER_MCQ_QUIZ_START",
            message: `MCQ ${quizStartIntent.startQuestionNo} load \u0D9A\u0DBB\u0DB8\u0DD2\u0DB1\u0DCA \u0DB4\u0DC0\u0DAD\u0DD3.`
          });
          emitSse(res, "done", {
            ok: true,
            completed: false,
            pending: true,
            requestId,
            finishReason: "pending_direct_pdf_qa",
            reason: "PAPER_MCQ_QUIZ_START",
            canContinue: true,
            needsClientFile: false,
            sources: allSources.length > 0 ? allSources : [paperSource]
          });
          trace.doneSent = true;
          return;
        }
        if (hasPaperSource && route.mode !== "pdf_link_request") {
          const { retrieveEvidenceForPaperQuestion: retrieveEvidenceForPaperQuestion2 } = await Promise.resolve().then(() => (init_evidenceRetriever(), evidenceRetriever_exports));
          if (questionId) {
            emitSse(res, "status", { step: "evidence_check", message: "Searching for verified evidence..." });
            const evidenceResult = await retrieveEvidenceForPaperQuestion2({
              sourceId: paperSource.id,
              questionType: paperIntent.questionType || "MCQ",
              questionNo: requestedQuestionNo,
              year: requestedYear,
              subject: requestedSubject
            });
            const cachedEvidence = evidenceResult.evidence;
            const hasCachedAnswer = Boolean(
              cachedEvidence?.answer || cachedEvidence?.officialAnswer || cachedEvidence?.solvedAnswer?.optionNo || cachedEvidence?.estimatedAnswer
            );
            if (evidenceResult.ok && cachedEvidence?.questionText && hasCachedAnswer) {
              const evidence2 = cachedEvidence;
              console.log(`[AI_RESPOND_STREAM] Full-paper evidence found for ${questionId}`);
              const methodLabel = evidence2.extractionMethod === "manual_verified" ? "Verified by Teacher" : "Found in full paper scan";
              emitSse(res, "status", { step: "evidence", message: `${methodLabel}...` });
              const { formatPaperQuestionAnswer: formatPaperQuestionAnswer2 } = await Promise.resolve().then(() => (init_paperAnswer(), paperAnswer_exports));
              const finalAnswer = formatPaperQuestionAnswer2({
                questionText: evidence2.questionText,
                options: evidence2.options,
                officialAnswer: evidence2.answer || evidence2.officialAnswer || evidence2.estimatedAnswer,
                solvedAnswer: evidence2.solvedAnswer,
                explanationSinhala: evidence2.explanationSinhala
              });
              emitSse(res, "token", { text: stripRawVisualBlocks(finalAnswer) });
              trace.lastEvent = "token";
              const chatRes3 = await saveFinalChat({
                uid: user.uid,
                email: user.email,
                userText: prompt,
                assistantText: finalAnswer,
                mode: route.mode,
                subject: requestedSubject,
                sources: allSources
              });
              emitSse(res, "done", {
                ok: true,
                completed: true,
                requestId,
                messageId: chatRes3?.messageId || null,
                chatSaved: chatRes3.chatSaved,
                sources: allSources,
                paperInfo: {
                  sourceId: paperSource.id,
                  questionNo: requestedQuestionNo,
                  year: requestedYear,
                  subject: requestedSubject,
                  questionType: paperIntent.questionType || "MCQ",
                  prompt,
                  extractionMethod: evidence2.extractionMethod
                }
              });
              trace.doneSent = true;
              return;
            }
          }
          console.log(`[AI_RESPOND_STREAM] Full-paper OCR scan required for ${paperSource.id}. Emitting event...`);
          emitSse(res, "direct_pdf_handoff_required", {
            sourceId: paperSource.id || paperSource.sourceId,
            storagePath: paperSource.storagePath,
            downloadUrl: paperSource.downloadUrl || paperSource.url,
            title: paperSource.title,
            subject: requestedSubject,
            year: requestedYear,
            questionNo: requestedQuestionNo,
            questionType: paperIntent.questionType || "MCQ",
            prompt,
            scanMode: "full_paper",
            reason: "FULL_PAPER_OCR_SCAN_REQUIRED",
            message: "\u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB paper \u0D91\u0D9A scan \u0D9A\u0DBB \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA \u0DC0\u0DD9\u0DB1\u0DCA \u0D9A\u0DBB\u0DB8\u0DD2\u0DB1\u0DCA \u0DB4\u0DC0\u0DAD\u0DD3."
          });
          emitSse(res, "done", {
            ok: true,
            completed: false,
            pending: true,
            requestId,
            finishReason: "pending_direct_pdf_qa",
            reason: "FULL_PAPER_OCR_SCAN_REQUIRED",
            canContinue: true,
            needsClientFile: false,
            sources: allSources.length > 0 ? allSources : [paperSource],
            paperInfo: {
              sourceId: paperSource.id || paperSource.sourceId,
              questionNo: requestedQuestionNo,
              year: requestedYear,
              subject: requestedSubject,
              questionType: paperIntent.questionType || "MCQ",
              prompt,
              extractionMethod: "pending_full_paper_ocr_scan"
            }
          });
          trace.doneSent = true;
          trace.completed = false;
          return;
        }
        if (route.mode === "pdf_link_request" && paperSource) {
          const composedAnswer = `\u0DB8\u0DD9\u0DB1\u0DCA\u0DB1 **${paperSource.title || "PDF \u0D91\u0D9A"}**. \u0DB4\u0DC4\u0DC5 file card \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DC0\u0DD2\u0DC0\u0DD8\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.`;
          emitSse(res, "token", { text: composedAnswer });
          trace.lastEvent = "token";
          const chatRes3 = await saveFinalChat({
            uid: user.uid,
            email: user.email,
            userText: prompt,
            assistantText: composedAnswer,
            mode: route.mode,
            subject: requestedSubject,
            sources: allSources
          });
          if (chatRes3?.chatSaved) {
            trace.chatSaved = true;
            trace.messageId = chatRes3.messageId;
          }
          trace.completed = true;
          emitSse(res, "done", {
            ok: true,
            completed: true,
            requestId,
            messageId: chatRes3?.messageId || null,
            chatSaved: trace.chatSaved,
            sources: allSources
          });
          trace.doneSent = true;
          trace.lastEvent = "done";
          return;
        }
        if (resolution.needsWebSearch) {
          emitSse(res, "status", { step: "web_search", message: "Searching web..." });
          const { searchWebPdfCandidates: searchWebPdfCandidates2 } = await Promise.resolve().then(() => (init_webPdfSearch(), webPdfSearch_exports));
          const candidates = await safeCall("searchWebPdfCandidates", () => searchWebPdfCandidates2({
            subject: requestedSubject,
            year: requestedYear,
            resourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
            questionNo: requestedQuestionNo
          }), [], res);
          if (candidates.length > 0) {
            emitSse(res, "web_candidates", { candidates });
            emitSse(res, "pending_import", {
              candidates,
              subject: requestedSubject,
              year: requestedYear,
              resourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
              questionNo: requestedQuestionNo,
              originalPrompt: prompt
            });
            const candidatePromptText = `\u{1F50D} **${requestedYear} ${requestedSubject}** \u0DC3\u0DB3\u0DC4\u0DCF confirmed local source \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DB8\u0DCA\u0DB6\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0.

\u0DB1\u0DB8\u0DD4\u0DAD\u0DCA Web search \u0D91\u0D9A \u0DC4\u0DBB\u0DC4\u0DCF \u0DB8\u0DD9\u0DB8 candidate \u0DB4\u0DCA\u200D\u0DBB\u0DB7\u0DC0\u0DBA\u0DB1\u0DCA \u0DC4\u0DB8\u0DD4 \u0DC0\u0DD4\u0DAB\u0DCF. \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 PDF \u0D91\u0D9A \u0DAD\u0DC4\u0DC0\u0DD4\u0DBB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1:

` + candidates.map((cand, idx) => `${idx + 1}. **${cand.title}**
   \u{1F517} [Open PDF](${cand.url})`).join("\n\n") + `

**\u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DBA:**
\u0D89\u0DC4\u0DAD \u0DC3\u0DB3\u0DC4\u0DB1\u0DCA candidate \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0DD9\u0DB1\u0DCA \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0D91\u0D9A \u0DAD\u0DC4\u0DC0\u0DD4\u0DBB\u0DD4 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0D85\u0DAF\u0DCF\u0DC5 **Confirm & Save** \u0DB6\u0DDC\u0DAD\u0DCA\u0DAD\u0DB8 \u0D9A\u0DCA\u0DBD\u0DD2\u0D9A\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. \u0D91\u0DC0\u0DD2\u0DA7 \u0D91\u0DBA auto-import \u0DC0\u0DD3 text index \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DD9\u0DB1\u0DCA \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4\u0DC0 \u0D94\u0DB6\u0DA7 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB \u0DBD\u0DB6\u0DCF \u0DAF\u0DD9\u0DB1\u0DD4 \u0D87\u0DAD.`;
            emitSse(res, "token", { text: candidatePromptText });
            trace.lastEvent = "token";
            let chatRes3 = await saveFinalChat({
              uid: user.uid,
              email: user.email,
              userText: prompt,
              assistantText: candidatePromptText,
              mode: route.mode,
              subject: requestedSubject,
              sources: candidates
            });
            if (chatRes3 && chatRes3.chatSaved) {
              trace.chatSaved = true;
              trace.messageId = chatRes3.messageId;
            }
            trace.completed = true;
            emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes3?.messageId || null, chatSaved: trace.chatSaved, sources: candidates });
            trace.doneSent = true;
            trace.lastEvent = "done";
            return;
          }
        }
        const failMsg = `\u26A0\uFE0F \u0DB8\u0DA7 **${requestedYear} ${requestedSubject}** \u0DC3\u0DB3\u0DC4\u0DCF confirmed PDF \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DDD candidate \u0D91\u0D9A\u0D9A\u0DCA \u0DC3\u0DDC\u0DBA\u0DCF \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0DC4\u0DD0\u0D9A\u0DD2 \u0DC0\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0. \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA \u0DA7\u0DBA\u0DD2\u0DB4\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, \u0DB1\u0DD0\u0DAD\u0DC4\u0DDC\u0DAD\u0DCA PDF \u0D91\u0D9A\u0D9A\u0DCA \u0D85\u0DB4\u0DCA\u0DBD\u0DDD\u0DA9\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.`;
        emitSse(res, "token", { text: failMsg });
        trace.lastEvent = "token";
        let chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: failMsg,
          mode: route.mode,
          subject: requestedSubject
        });
        if (chatRes2 && chatRes2.chatSaved) {
          trace.chatSaved = true;
          trace.messageId = chatRes2.messageId;
        }
        trace.completed = true;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: allSources });
        trace.doneSent = true;
        trace.lastEvent = "done";
        return;
      }
    }
    let contextBlocksText = "";
    let hasExactQuestionText = false;
    let needsOcr = false;
    if (route.mode === "past_paper_analysis") {
      const predictionSubject = route.entities.subject || activeSubject;
      if (!predictionSubject) {
        const clarification = "2026 prediction \u0D91\u0D9A \u0DC4\u0DAF\u0DB1\u0DCA\u0DB1 subject \u0D91\u0D9A \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1: SFT, ET, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA ICT?";
        emitSse(res, "token", { text: clarification });
        const chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: clarification,
          mode: route.mode,
          subject: activeSubject
        });
        trace.completed = true;
        trace.chatSaved = chatRes2.chatSaved;
        trace.messageId = chatRes2.messageId;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2.messageId || null, chatSaved: chatRes2.chatSaved, sources: [] });
        trace.doneSent = true;
        return;
      }
      emitSse(res, "status", { step: "exam_intelligence", status: "searching", message: "Past papers \u0DC3\u0DC4 marking schemes combine \u0D9A\u0DBB\u0DB8\u0DD2\u0DB1\u0DCA..." });
      const { retrievePastPaperAnalysisEvidence: retrievePastPaperAnalysisEvidence2 } = await Promise.resolve().then(() => (init_predictionEvidence(), predictionEvidence_exports));
      const isAdminUser2 = user.roles?.includes("admin") || user.admin === true;
      const predictionEvidence = await safeCall(
        "retrievePastPaperAnalysisEvidence",
        () => retrievePastPaperAnalysisEvidence2({
          uid: user.uid,
          subject: predictionSubject,
          targetYear: route.entities.year || "2026",
          isAdmin: isAdminUser2
        }),
        { contextText: "", sources: [], stats: null, hasEvidence: false },
        res
      );
      contextBlocksText += predictionEvidence.contextText || "";
      allSources.push(...predictionEvidence.sources || []);
      route.answerHints.mustUseRag = false;
      if (!predictionEvidence.hasEvidence) {
        const noIndexMessage = `**${predictionSubject}** \u0DC3\u0DB3\u0DC4\u0DCF PDFs \u0DC4\u0DB8\u0DD4 \u0DC0\u0DD4\u0DAB\u0DCF, \u0DB1\u0DB8\u0DD4\u0DAD\u0DCA prediction analysis \u0DC3\u0DB3\u0DC4\u0DCF searchable question index \u0DAD\u0DC0\u0DB8 \u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA \u0DB1\u0DD0\u0DC4\u0DD0. PDFs reindex/build exam index \u0D9A\u0DC5 \u0DB4\u0DC3\u0DD4 \u0DC3\u0DD2\u0DBA\u0DBD\u0DD4 papers \u0D91\u0D9A\u0DA7 \u0DB7\u0DCF\u0DC0\u0DD2\u0DAD \u0D9A\u0DBB evidence-based prediction \u0D91\u0D9A \u0DBD\u0DB6\u0DCF \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.`;
        emitSse(res, "prediction_index_required", {
          subject: predictionSubject,
          targetYear: route.entities.year || "2026",
          stats: predictionEvidence.stats,
          sources: predictionEvidence.sources
        });
        emitSse(res, "token", { text: noIndexMessage });
        const chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: noIndexMessage,
          mode: route.mode,
          subject: predictionSubject,
          sources: predictionEvidence.sources
        });
        trace.completed = true;
        trace.chatSaved = chatRes2.chatSaved;
        trace.messageId = chatRes2.messageId;
        emitSse(res, "done", { ok: false, completed: true, requestId, finishReason: "prediction_index_required", messageId: chatRes2.messageId || null, chatSaved: chatRes2.chatSaved, sources: predictionEvidence.sources });
        trace.doneSent = true;
        return;
      }
    }
    if (route.mode === "uploaded_pdf_question_qa") {
      emitSse(res, "status", { step: "rag", status: "searching" });
      const retrieveResult = await safeCall("retrieveUploadedPdfQuestion", () => retrieveUploadedPdfQuestion({
        uid: user.uid,
        uploadedFileName: route.entities.uploadedFileName,
        questionNo: route.entities.questionNo,
        query: prompt,
        limit: 8
      }), { chunks: [], source: null, hasExactQuestionText: false, needsOcr: false }, res);
      hasExactQuestionText = retrieveResult.hasExactQuestionText;
      needsOcr = retrieveResult.needsOcr;
      if (retrieveResult.source) {
        allSources.push({
          sourceId: retrieveResult.source.id,
          title: retrieveResult.source.title,
          fileName: retrieveResult.source.fileName,
          storagePath: retrieveResult.source.storagePath,
          badge: "Uploaded",
          confidence: 1
        });
        emitSse(res, "sources", { sources: allSources });
        trace.lastEvent = "sources";
      }
      if (needsOcr) {
        const ocrWarning = "PDF \u0D91\u0D9A save \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF, \u0DB1\u0DB8\u0DD4\u0DAD\u0DCA \u0D91\u0DC4\u0DD2 searchable lesson text \u0DAD\u0DC0\u0DB8 \u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA \u0DB1\u0DD0\u0DC4\u0DD0. \u0DA7\u0DD2\u0D9A \u0DC0\u0DDA\u0DBD\u0DCF\u0DC0\u0D9A\u0DD2\u0DB1\u0DCA \u0DB1\u0DD0\u0DC0\u0DAD \u0D8B\u0DAD\u0DCA\u0DC3\u0DCF\u0DC4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.";
        emitSse(res, "token", { text: ocrWarning });
        trace.lastEvent = "token";
        let chatRes2 = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: ocrWarning,
          mode: route.mode,
          subject: activeSubject,
          sources: allSources
        });
        if (chatRes2 && chatRes2.chatSaved) {
          trace.chatSaved = true;
          trace.messageId = chatRes2.messageId;
        }
        trace.completed = true;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes2?.messageId || null, chatSaved: trace.chatSaved, sources: allSources });
        trace.doneSent = true;
        trace.lastEvent = "done";
        return;
      }
      if (retrieveResult.chunks.length > 0) {
        retrieveResult.chunks.forEach((c, i) => {
          contextBlocksText += `
[Uploaded PDF Chunk ${i + 1}] Page ${c.pageNumber || "N/A"}:
${c.text}
`;
        });
      }
    }
    if (requestedMode === "deep_search" || route.mode !== "uploaded_pdf_question_qa" && route.mode !== "past_paper_analysis" && (route.answerHints.mustUseRag || route.mode === "normal_chat" || hasUploadedPdf)) {
      emitSse(res, "status", { step: "rag", status: "searching" });
      const retrieveResult = await safeCall("retrieveRelevantKnowledge", () => retrieveRelevantKnowledge({
        query: prompt,
        uid: user.uid,
        subject: route.entities.subject || activeSubject,
        limit: isLessonEvidenceMode(route.mode) ? 24 : 5,
        lesson: route.entities.lesson || evidence.lessonIds[0],
        strictLesson: isLessonEvidenceMode(route.mode),
        allowedSourceIds: evidence.allowedSourceIds
      }), { chunks: [] }, res);
      const chunksList = Array.isArray(retrieveResult) ? retrieveResult : retrieveResult?.chunks || [];
      if (isLessonEvidenceMode(route.mode) && Array.isArray(retrieveResult?.sources)) {
        for (const source of retrieveResult.sources) {
          if (source.usedInAnswer === false) continue;
          if (!allSources.some((existing) => (existing.sourceId || existing.id) === (source.sourceId || source.id))) {
            allSources.push({ ...source, badge: "Lesson PDF" });
          }
        }
      }
      if (chunksList.length > 0) {
        chunksList.forEach((c, i) => {
          const score = scoreSource(c, {
            subject: route.entities.subject || activeSubject,
            year: route.entities.year,
            resourceType: route.entities.resourceType || route.entities.paperType ? "past_paper" : void 0,
            paperType: route.entities.questionType,
            keywords: prompt.split(" ")
          });
          if (policy.intent === "official_paper_question" && score < 75) return;
          if (policy.intent === "syllabus_lesson_explanation" && score < 55) return;
          if (!isLessonEvidenceMode(route.mode)) {
            allSources.push({ title: c.title, sourceId: c.sourceId || c.id, pageNumber: c.metadata?.pageNumber || c.page, sourceType: c.sourceType || "rag", sourceScope: c.sourceScope || "personal", confidence: c.confidence, badge: "RAG" });
          }
          contextBlocksText += `
[RAG SOURCE ${i + 1}] ${c.title}:
${c.text.substring(0, 1e3)}
`;
        });
      }
    }
    if (isLessonEvidenceMode(route.mode) && contextBlocksText.trim().length === 0) {
      const lessonName = route.entities.lesson || evidence.lessonIds[0] || "requested lesson";
      const statusMessage = evidence.evidenceStatus === "ocr_required" ? `**${lessonName}** lesson PDF \u0D91\u0D9A save \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. Searchable lesson text \u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA \u0DC0\u0DD6 \u0DC0\u0DD2\u0D9C\u0DC3 \u0D92 PDF evidence \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DC3\u0DC4 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DB8\u0DCA.` : `**${lessonName}** lesson \u0D91\u0D9A\u0DA7 searchable PDF evidence \u0D91\u0D9A\u0D9A\u0DCA \u0DAD\u0DC0\u0DB8 \u0DC4\u0DB8\u0DD4 \u0DC0\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0. PDF \u0D91\u0D9A lesson \u0D91\u0D9A \u0DBA\u0DA7\u0DAD\u0DDA upload \u0D9A\u0DC5 \u0DB4\u0DC3\u0DD4 \u0D91\u0DC4\u0DD2 content \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DB8\u0DCA.`;
      emitSse(res, "evidence_missing", {
        reason: evidence.evidenceStatus,
        lesson: lessonName,
        message: statusMessage
      });
      emitSse(res, "token", { text: statusMessage });
      emitSse(res, "done", {
        ok: false,
        completed: true,
        requestId,
        finishReason: "blocked_no_lesson_evidence",
        sources: evidence.candidates
      });
      trace.doneSent = true;
      trace.completed = true;
      return;
    }
    if (requestedMode === "web_search" || requestedMode === "deep_search" || route.mode !== "uploaded_pdf_question_qa" && !isLessonEvidenceMode(route.mode) && route.answerHints.mustUseGoogleSearch) {
      emitSse(res, "status", { step: "web_search", status: "searching", query: prompt });
      const web = await safeCall("groundedSearch", () => groundedSearch(prompt, { language: "si" }), { sources: [], summary: "" }, res);
      if (web.sources.length > 0) {
        web.sources.forEach((s, i) => {
          allSources.push({ title: s.title, url: s.url, confidence: s.confidence, badge: requestedMode === "web_search" || requestedMode === "deep_search" ? "Web Search" : "Candidate" });
          contextBlocksText += `
[WEB SOURCE ${i + 1}] ${s.title} (${s.url}):
${s.snippet}
`;
        });
      }
    }
    if (route.mode !== "uploaded_pdf_question_qa" && route.answerHints.mustUseUrlContext && route.entities.urls && route.entities.urls.length > 0) {
      emitSse(res, "status", { step: "url_context", status: "reading", urlCount: route.entities.urls.length });
      const uRes = await safeCall("readUrlsWithGemini", () => readUrlsWithGemini({
        urls: route.entities.urls,
        question: prompt,
        subject: route.entities.subject || activeSubject
      }), { sources: [], answer: "" }, res);
      uRes.sources.forEach((s) => {
        allSources.push({ title: s.title || s.url, url: s.url, confidence: 1, badge: "Uploaded" });
      });
      contextBlocksText += `
[URL CONTEXT]:
${uRes.answer}
`;
    }
    if (allSources.length > 0) {
      emitSse(res, "sources", { sources: allSources });
      trace.lastEvent = "sources";
    }
    emitSse(res, "status", { step: "assistant", status: "Writing answer" });
    const modifiedUserContext = {
      ...userContext,
      hasExactQuestionText,
      needsOcr
    };
    const ai9 = getAIClient();
    let aiTask = "normal_chat";
    if (["paper_question_qa", "marking_scheme_request", "lesson_marks_intent", "zscore_prediction", "past_paper_analysis", "uploaded_pdf_question_qa", "tutor_explanation"].includes(route.mode) || image) {
      aiTask = image ? "image_understanding" : "final_answer";
    }
    if (paperIntent.isOfficialPaperCandidate && route.mode === "paper_question_qa" && !hasExactQuestionText) {
      let msg = "\u0DC3\u0DB8\u0DCF\u0DC0\u0DD9\u0DB1\u0DCA\u0DB1, \u0DB8\u0DA7 \u0DB8\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0DA7 \u0D85\u0DAF\u0DCF\u0DC5 \u0DB1\u0DD2\u0DBD \u0DB8\u0DD6\u0DBD\u0DCF\u0DC1\u0DCA\u200D\u0DBB\u0DBA\u0D9A\u0DCA (past paper/scheme/PDF) \u0DC3\u0DDC\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DBB\u0DD2 \u0DC0\u0DD4\u0DAB\u0DCF.";
      if (route.mode === "paper_question_qa") {
        msg = "\u0DB8\u0DD9\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DB1\u0DD2\u0DBD Past Paper \u0D91\u0D9A \u0DC4\u0DDD Marking Scheme \u0D91\u0D9A \u0DC3\u0DDC\u0DBA\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0DB1\u0DDC\u0DC4\u0DD0\u0D9A\u0DD2 \u0DC0\u0DD2\u0DBA.";
      }
      console.log("[AI_RESPOND_STREAM] Answer blocked: Missing evidence for official paper question.");
      emitSse(res, "evidence_missing", {
        reason: "NO_VALID_EVIDENCE_FOUND",
        message: msg
      });
      emitSse(res, "token", { text: msg });
      emitSse(res, "done", {
        ok: false,
        completed: true,
        requestId,
        finishReason: "blocked_no_evidence"
      });
      trace.doneSent = true;
      return;
    }
    const sysInstruction = getCloraSystemPrompt(modifiedUserContext, route.mode);
    let finalSysInstruction = sysInstruction;
    if (evidence.allowModelQuestionGeneration) {
      finalSysInstruction += "\n\n[STRICT INSTRUCTION]: The user has explicitly requested a MODEL/PRACTICE question. You MUST prefix your question exactly with: '\u26A0\uFE0F AI-generated model question \u2014 official past-paper question \u0DB1\u0DDC\u0DC0\u0DDA' and NEVER claim it is from a real past paper.";
    } else if (policy.requireEvidence) {
      finalSysInstruction += "\n\n[STRICT INSTRUCTION]: The user is asking for a real paper question or syllabus discussion. You MUST base your answer strictly on the provided evidence. DO NOT invent or hallucinate any questions, equations, or past-paper details. If the evidence lacks the specific question, reply that you cannot find it.";
    }
    const mistakeImageSources = [];
    const contentsParts = [
      {
        text: `Context Blocks:
${contextBlocksText}

Previous Chat History:
${history?.length ? JSON.stringify(history) : "None"}

Current User Request:
${prompt}
Answer in Sinhala-first style if appropriate.`
      }
    ];
    const asksAboutMistakes = /mistake|error log|wrong answer|වැරදි|වරද|quiz me on my recent/i.test(prompt);
    if (asksAboutMistakes && Array.isArray(modifiedUserContext.recentMistakes)) {
      const recentMistakes = modifiedUserContext.recentMistakes.slice(0, 8);
      contentsParts[0].text += `

Recent Mistake Notebook records (real saved data):
${JSON.stringify(recentMistakes.map((mistake) => ({
        subject: mistake.subject,
        lesson: mistake.lesson,
        errorText: mistake.errorText || mistake.questionText,
        createdAt: mistake.createdAt,
        hasImage: Boolean(mistake.imageStoragePath)
      })))}
Use these records for diagnosis, revision, or a grounded quiz. If a saved image is attached below, inspect that actual image. Do not ask the user to upload it again. Never replace unreadable or missing details with generic likely mistakes; say exactly what cannot be read.`;
      const bucket = getAdminBucket();
      const bucketName = bucket.name;
      for (const mistake of recentMistakes.slice(0, 3)) {
        if (!mistake.imageStoragePath || !mistake.imageMimeType) continue;
        contentsParts.push({
          fileData: {
            fileUri: `gs://${bucketName}/${mistake.imageStoragePath}`,
            mimeType: mistake.imageMimeType
          }
        });
        contentsParts.push({ text: `Mistake Notebook image for ${mistake.subject || "subject"} / ${mistake.lesson || "lesson"}. Analyze only when relevant.` });
        try {
          const [imageUrl] = await bucket.file(mistake.imageStoragePath).getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1e3
          });
          const source = {
            id: mistake.id,
            sourceId: mistake.id,
            title: mistake.imageFileName || `${mistake.subject || "Subject"} - ${mistake.lesson || "lesson"}`,
            url: imageUrl,
            sourceType: "mistake_image",
            badge: "Saved error image",
            mimeType: mistake.imageMimeType,
            lesson: mistake.lesson
          };
          mistakeImageSources.push(source);
          allSources.push(source);
        } catch (error) {
          console.warn("[MistakeNotebook] Could not sign saved image", { mistakeId: mistake.id, error: String(error) });
        }
        aiTask = "image_understanding";
      }
      if (mistakeImageSources.length > 0) emitSse(res, "sources", { sources: allSources });
    }
    if (image && image.data && image.mimeType) {
      contentsParts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
      contentsParts.push({
        text: `

[Vision Triggered] OCR/Diagram Analysis requested. Image mimeType is ${image.mimeType}. Scan the image details carefully and run custom vision-based prompt contexts (such as OCR, formula extraction, or diagram understanding) to give precise, contextual, step-by-step guidance.`
      });
    }
    if (attachments && attachments.length > 0) {
      const bucketName = getAdminBucket().name;
      for (const att of attachments) {
        if (att.storagePath && att.mimeType) {
          contentsParts.push({
            fileData: {
              fileUri: `gs://${bucketName}/${att.storagePath}`,
              mimeType: att.mimeType
            }
          });
          contentsParts.push({
            text: `

[Attachment: ${att.fileName || "unknown file"}] Please analyze the attached file.`
          });
        }
      }
      aiTask = "image_understanding";
    }
    let stream = null;
    let modelUsed = "";
    try {
      const result = await generateContentStreamWithFallback(
        aiTask,
        {
          model: "ignored",
          // will be overridden by router
          contents: [{ role: "user", parts: contentsParts }],
          config: {
            systemInstruction: finalSysInstruction,
            temperature: getTemperature(route.mode),
            maxOutputTokens: getMaxTokens(route.mode)
          }
        },
        ai9,
        signal
      );
      stream = result.stream;
      modelUsed = result.modelUsed;
      if (result.warning) {
        emitSse(res, "token", { text: `

\u26A0\uFE0F *${result.warning}*

` });
      }
    } catch (err) {
      throw new Error(`All model streaming options failed. ${err.message}`);
    }
    let isInterrupted = false;
    let fullText = "";
    let chunkBuffer = "";
    try {
      for await (const chunk of stream) {
        const text = chunk.text || "";
        if (text) {
          fullText += text;
          chunkBuffer += text;
          trace.totalChars += text.length;
          trace.tokenCount++;
          if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
            emitSse(res, "token", { text: chunkBuffer });
            trace.lastEvent = "token";
            chunkBuffer = "";
          }
        }
      }
      if (chunkBuffer.length > 0) {
        emitSse(res, "token", { text: chunkBuffer });
      }
      if (!isInterrupted && mistakeImageSources.length > 0) {
        const gallery = `

### Saved error image${mistakeImageSources.length === 1 ? "" : "s"}

${mistakeImageSources.map((source) => {
          const alt = String(source.title || "Saved mistake image").replace(/[\[\]]/g, "");
          return `![${alt}](${source.url})`;
        }).join("\n\n")}`;
        fullText += gallery;
        emitSse(res, "token", { text: gallery });
      }
    } catch (e) {
      console.warn("Stream interrupted:", e);
      isInterrupted = true;
      emitSse(res, "error", { ok: false, error: "Stream interrupted", recoverable: true, code: "STREAM_INTERRUPTED", completed: false, incomplete: true });
    }
    fullText = cleanAssistantResponse(fullText);
    try {
      const { trackAIUsage: trackAIUsage3 } = await Promise.resolve().then(() => (init_usageTracker(), usageTracker_exports));
      const inputTokens = Math.round((contextBlocksText.length + prompt.length + sysInstruction.length) / 3.8) + 100;
      const outputTokens = Math.round(fullText.length / 3.5);
      await trackAIUsage3(user.uid, modelUsed || "gemini-2.0-flash", inputTokens, outputTokens, "normalMessages");
    } catch (trackErr) {
      console.warn("[usageTracker] Error tracking usage:", trackErr);
    }
    emitSse(res, "status", { step: "assistant", status: "Saving chat" });
    let chatRes = { chatSaved: false };
    try {
      try {
        await updateConversationState(user.uid, {
          activeSourceIds: allSources.map((s) => s.id || s.sourceId).filter(Boolean),
          selectedSourceId: route.entities?.activeSourceId || null,
          selectedQuestionId: route.entities?.questionNo || null
        });
      } catch (e) {
      }
      chatRes = await safeCall("saveFinalChat", () => saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: fullText,
        mode: route.mode,
        subject: activeSubject,
        sources: allSources
      }), { chatSaved: false }, res);
      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
    } catch (err) {
      console.warn("CHAT_SAVE_SKIPPED", err);
    }
    if (process.env.ENABLE_MEMORY_EXTRACTION === "true") {
      safeCall("extractStableMemoryIfUseful", () => extractStableMemoryIfUseful({ uid: user.uid, email: user.email, prompt, answer: fullText, userContext: modifiedUserContext }), null, res).catch(() => null);
    }
    if (!isInterrupted && fullText.length > 0) {
      try {
        let getDeterministicSuggestions2 = function(mode) {
          if (mode === "paper_question_qa") {
            return [
              "\u0DB8\u0DDA\u0D9A PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0D86\u0DBA\u0DD9\u0DAD\u0DCA verify \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
              "\u0DB8\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0DDA marking points \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1",
              "\u0DB8\u0DDA \u0DC0\u0D9C\u0DDA \u0DAD\u0DC0 MCQ 5\u0D9A\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1"
            ];
          }
          if (mode === "tutor_explanation" || mode === "normal_chat") {
            return [
              "\u0DB8\u0DDA\u0D9A \u0DC3\u0DBB\u0DBD\u0DC0 \u0DB1\u0DD0\u0DC0\u0DAD \u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
              "\u0DB8\u0DDA lesson \u0D91\u0D9A\u0DD9\u0DB1\u0DCA MCQ 5\u0D9A\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1",
              "\u0DB8\u0D9C\u0DDA \u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 points \u0DA7\u0DD2\u0D9A \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1"
            ];
          }
          return [
            "\u0DAD\u0DC0 \u0D9A\u0DD9\u0DA7\u0DD2\u0DBA\u0DD9\u0DB1\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1",
            "exam answer \u0D91\u0D9A\u0D9A\u0DCA \u0DBD\u0DD9\u0DC3 \u0DBD\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1",
            "\u0DB8\u0DAD\u0D9A \u0DAD\u0DB6\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 tips \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1"
          ];
        };
        var getDeterministicSuggestions = getDeterministicSuggestions2;
        let finalSuggestions = [];
        if (process.env.ENABLE_AI_SUGGESTIONS === "true") {
          const suggPrompt = `Based on the user's message: "${prompt}" and the assistant's answer: "${fullText.substring(0, 1e3)}...", generate 3 short, contextual follow-up suggestions in Sinhala.
Important: Output ONLY a valid JSON array of 3 strings.
Example suggestions for Clora X:
- "\u0DB8\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0D86\u0DBA\u0DD9\u0DAD\u0DCA \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" (Recheck from PDF)
- "\u0DB8\u0DDA \u0D85\u0DC0\u0DD4\u0DBB\u0DD4\u0DAF\u0DCA\u0DAF\u0DDA marking scheme \u0D91\u0D9A \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1" (Get marking scheme)
- "\u0DB8\u0DDA lesson \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DAD\u0DC0 mcq \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1" (More MCQs from this lesson)
- "\u0DB8\u0DDA\u0D9A \u0DC0\u0DD0\u0DBB\u0DAF\u0DD2\u0DBA\u0DD2, \u0DB1\u0DD0\u0DC0\u0DAD \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" (This is wrong, recheck)
Do not include any other text or markdown formatting.`;
          try {
            const { result: sugResult } = await callGeminiWithFallback("fast_background", {
              model: "ignored",
              contents: suggPrompt,
              config: {
                temperature: 0.7,
                maxOutputTokens: 200,
                responseMimeType: "application/json"
              }
            }, getAIClient());
            const sugText = sugResult.text || "";
            let cleaned = sugText.replace(/```json/gi, "").replace(/```/g, "").trim();
            let parsed = null;
            try {
              parsed = JSON.parse(cleaned);
            } catch (e) {
              const start = cleaned.indexOf("[");
              const end = cleaned.lastIndexOf("]");
              if (start >= 0 && end > start) {
                try {
                  parsed = JSON.parse(cleaned.slice(start, end + 1));
                } catch (e2) {
                }
              }
            }
            if (Array.isArray(parsed) && parsed.length > 0) {
              finalSuggestions = parsed.filter((x) => typeof x === "string").slice(0, 3);
            }
          } catch (e) {
            console.warn("Failed to generate AI suggestions, falling back to deterministic", e);
          }
        }
        if (finalSuggestions.length === 0) {
          finalSuggestions = getDeterministicSuggestions2(route.mode);
        }
        emitSse(res, "suggestions", { suggestions: finalSuggestions });
      } catch (err) {
        console.warn("Failed to generate suggestions", err);
      }
    }
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1e3);
    let summaryItems = [];
    if (route.mode === "normal_chat") {
      summaryItems.push(`Thought for ${elapsedSeconds}s`);
    } else if (paperIntent.isOfficialPaperCandidate) {
      summaryItems.push(`\u2713 Official paper request detected`);
      summaryItems.push(`\u2713 Subject/year/question parsed (${paperIntent.subject || ""} ${paperIntent.year || ""} Q${paperIntent.questionNo || ""})`);
      summaryItems.push(`\u2713 Past Papers DB checked`);
      if (hasExactQuestionText) {
        summaryItems.push(`\u2713 Source lock checked`);
        summaryItems.push(`\u2713 Evidence checked`);
      } else {
        summaryItems.push(`\u2713 Source checked`);
        summaryItems.push(`\u26A0 Exact question evidence missing`);
      }
    } else {
      summaryItems.push(`Thought for ${elapsedSeconds}s`);
      if (allSources && allSources.length > 0) summaryItems.push(`\u2713 Context sources checked`);
    }
    emitSse(res, "safe_summary", { items: summaryItems });
    trace.completed = !isInterrupted;
    emitSse(res, "done", { ok: !isInterrupted, completed: !isInterrupted, incomplete: isInterrupted, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: allSources || [], answer: fullText, finishReason: isInterrupted ? "interrupted" : "complete" });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } catch (error) {
    console.error("Stream Error", error);
    trace.errorCode = error.code || "UNKNOWN_ERROR";
    trace.errorMessage = error.message || String(error);
    const classified = error.code === "AI_BILLING_EXHAUSTED" ? error : classifyAiError(error);
    if (classified.code === "AI_BILLING_EXHAUSTED") {
      emitSse(res, "error", {
        code: "AI_BILLING_EXHAUSTED",
        message: "AI credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. Billing update \u0D9A\u0DC5\u0DCF\u0DB8 \u0DB1\u0DD0\u0DC0\u0DAD AI answer \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DB8\u0DCA.",
        canRetry: false,
        localOnlyAvailable: true
      });
      emitSse(res, "suggestions", {
        suggestions: [
          "Firebase PDFs list \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
          "Indexed PDF chunks \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1",
          "Billing fix \u0D9A\u0DC5\u0DCF\u0DA7 \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA answer continue \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1"
        ]
      });
      emitSse(res, "done", {
        completed: false,
        reason: "AI_BILLING_EXHAUSTED",
        canContinue: false
      });
    } else {
      emitSse(res, "error", { ok: false, error: classified.userMessage || classified.errorMessage || String(error), code: classified.code, recoverable: true });
      if (!res.headersSent) {
        emitSse(res, "token", { text: "\n\n\u26A0\uFE0F \u0DC3\u0DB8\u0DCF\u0DC0\u0DB1\u0DCA\u0DB1, \u0DB4\u0DAF\u0DCA\u0DB0\u0DAD\u0DD2\u0DBA\u0DDA \u0DAF\u0DDD\u0DC2\u0DBA\u0D9A\u0DCA \u0D87\u0DAD\u0DD2 \u0DC0\u0DD2\u0DBA." });
      }
      emitSse(res, "done", { ok: false, completed: false, requestId, chatSaved: false, finishReason: "error_recovered" });
    }
    trace.doneSent = true;
    trace.lastEvent = "done";
  } finally {
    clearInterval(heartbeatInterval);
    unregisterRequest(requestId);
    unregisterRequest(requestId);
    if (!trace.doneSent) {
      try {
        emitSse(res, "done", {
          ok: trace.completed,
          completed: trace.completed,
          requestId,
          chatSaved: trace.chatSaved,
          reason: trace.completed ? "STREAM_FINISHED" : "STREAM_FINISHED_WITH_RECOVERABLE_ERROR"
        });
        trace.doneSent = true;
        trace.lastEvent = "done";
      } catch (e) {
        console.error("Failed to send done in finally", e);
      }
    }
    trace.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    res.end();
  }
}
async function aiContinueStream(req, res) {
  const startedAt = Date.now();
  const requestId = req.body?.clientRequestId || "req_cont_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  const trace = {
    requestId,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    completed: false,
    doneSent: false,
    clientClosed: false,
    tokenCount: 0,
    totalChars: 0,
    chatSaved: false
  };
  addStreamTrace(trace);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  const abortController = registerRequest(requestId);
  const signal = abortController.signal;
  const heartbeatInterval = setInterval(() => {
    try {
      emitSse(res, "heartbeat", { ok: true, requestId, ts: Date.now() });
      trace.lastEvent = "heartbeat";
    } catch (e) {
    }
  }, 1e4);
  req.on("close", () => {
    cancelRequest(requestId);
    console.log(`[STREAM] STREAM_CLIENT_CLOSED requestId=${requestId}`);
    trace.clientClosed = true;
    trace.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  });
  try {
    const { originalPrompt, previousAssistantText, sources = [], chatId, reason } = req.body;
    const user = req.user;
    const { trackAIUsage: trackAIUsage2 } = await Promise.resolve().then(() => (init_usageTracker(), usageTracker_exports));
    emitSse(res, "status", { step: "started", message: "Continuing answer..." });
    const trimmedPrevText = (previousAssistantText || "").slice(-1500);
    const promptText = `
User original prompt: "${originalPrompt}"
The previous answer stopped halfway due to: "${reason || "unknown"}"
Here is the last part of the previous answer:
"...${trimmedPrevText}"

Instruction:
Continue the previous Sinhala answer from exactly where it stopped. Do not repeat completed sections. Finish the remaining explanation.
Keep the same tone and language (Sinhala-first style).
`;
    const ai9 = getAIClient();
    let stream = null;
    let modelUsed = "";
    try {
      const result = await generateContentStreamWithFallback("final_answer", {
        model: "ignored",
        // will be overridden by router
        contents: promptText,
        config: {
          maxOutputTokens: 2e3
        }
      }, ai9, signal);
      stream = result.stream;
      modelUsed = result.modelUsed;
      if (result.warning) {
        emitSse(res, "token", { text: `

\u26A0\uFE0F *${result.warning}*

` });
      }
    } catch (err) {
      throw new Error(`Continue stream failed: ${err.message}`);
    }
    let fullText = "";
    let chunkBuffer = "";
    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        fullText += text;
        chunkBuffer += text;
        trace.totalChars += text.length;
        trace.tokenCount++;
        if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
          emitSse(res, "token", { text: chunkBuffer });
          trace.lastEvent = "token";
          chunkBuffer = "";
        }
      }
    }
    if (chunkBuffer.length > 0) {
      emitSse(res, "token", { text: chunkBuffer });
    }
    trace.completed = true;
    try {
      const { trackAIUsage: trackAIUsage3 } = await Promise.resolve().then(() => (init_usageTracker(), usageTracker_exports));
      const inputTokens = Math.round(promptText.length / 3.8) + 100;
      const outputTokens = Math.round(fullText.length / 3.5);
      await trackAIUsage3(user.uid, modelUsed || "gemini-3.1-pro-preview", inputTokens, outputTokens, "proCalls");
    } catch (trackErr) {
      console.warn("[usageTracker] Error tracking continuation usage:", trackErr);
    }
    if (chatId) {
      await safeCall("saveContinuationChat", async () => {
        const db = getAdminDb();
        const chatRef = db.collection("users").doc(user.uid).collection("chat_history").doc(chatId);
        const docSnap = await chatRef.get();
        if (docSnap.exists) {
          const prevData = docSnap.data();
          const updatedAnswer = (prevData?.assistantAnswer || "") + "\n" + fullText;
          await chatRef.update({
            assistantAnswer: updatedAnswer,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          trace.chatSaved = true;
        }
      }, null, res);
    }
    emitSse(res, "done", {
      ok: true,
      completed: true,
      requestId,
      chatSaved: trace.chatSaved
    });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } catch (err) {
    console.error("Continue Stream Error", err);
    trace.errorCode = err.code || "CONTINUE_FAILED";
    trace.errorMessage = err.message || String(err);
    emitSse(res, "error", { ok: false, error: err.message, recoverable: true, code: "CONTINUE_FAILED" });
    emitSse(res, "done", { ok: false, completed: false, requestId, chatSaved: false });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } finally {
    clearInterval(heartbeatInterval);
    unregisterRequest(requestId);
    unregisterRequest(requestId);
    if (!trace.doneSent) {
      try {
        emitSse(res, "done", {
          ok: trace.completed,
          completed: trace.completed,
          requestId,
          chatSaved: trace.chatSaved
        });
        trace.doneSent = true;
        trace.lastEvent = "done";
      } catch (e) {
      }
    }
    trace.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    res.end();
  }
}
var lastStreamTraces;
var init_respondStream = __esm({
  "server/ai/respondStream.ts"() {
    "use strict";
    init_client();
    init_aiErrorClassifier();
    init_prompts();
    init_stripVisualBlocks();
    init_userContext();
    init_admin();
    init_memoryExtractor();
    init_knowledgeRouter();
    init_retrieve();
    init_urlContext();
    init_googleSearchGrounding();
    init_conversationState();
    init_evidenceRetrieval();
    init_modelRouter();
    init_answerPolicy();
    init_sourceScoring();
    init_lessonResolver();
    init_selectedPdfFollowup();
    init_assistantText();
    init_paperMcqQuiz();
    init_cancellation();
    lastStreamTraces = [];
  }
});

// server/utils/retry.ts
var retry_exports = {};
__export(retry_exports, {
  retryGoogleAuthOperation: () => retryGoogleAuthOperation
});
async function retryGoogleAuthOperation(name, fn) {
  const delays = [500, 1500, 3e3];
  let lastErr;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable = msg.includes("Premature close") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("oauth2") || msg.includes("fetch") || msg.includes("fetch failed");
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
      await new Promise((r) => setTimeout(r, delays[i]));
    }
  }
  throw lastErr;
}
var init_retry = __esm({
  "server/utils/retry.ts"() {
    "use strict";
  }
});

// server/realtime/config.ts
var config_exports = {};
__export(config_exports, {
  getRealtimeConfig: () => getRealtimeConfig
});
function getRealtimeConfig() {
  const enabled = String(process.env.ENABLE_REALTIME_VOICE || "").toLowerCase() === "true";
  const provider = process.env.REALTIME_PROVIDER || "gemini_live";
  const missing = [];
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
    const vertexMode = String(process.env.GEMINI_USE_VERTEX || "").toLowerCase() === "true";
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
var init_config = __esm({
  "server/realtime/config.ts"() {
    "use strict";
  }
});

// server/image/generate.ts
var generate_exports = {};
__export(generate_exports, {
  generateEducationalImage: () => generateEducationalImage
});
async function generateEducationalImage(req) {
  try {
    const { prompt, subject, lesson, style, mode, aspectRatio = "1:1", quality } = req.body;
    const uid = req.user.uid;
    if (!prompt) throw new Error("Prompt is required");
    if (process.env.ENABLE_IMAGE_GENERATION === "false") {
      return { ok: false, code: "IMAGE_GENERATION_DISABLED", error: "Image generation is disabled." };
    }
    const finalPrompt = `Create a clean Sinhala G.C.E. A/L Technology exam-focused diagram. Clear labels. Minimal clutter. Accurate educational layout. No watermark. Sinhala labels where useful. Subject: ${subject || "Technology"}. Lesson: ${lesson || "General"}. User request: ${prompt}`;
    let configuredModel = AI_MODELS.image;
    if (mode === "studio" || mode === "pro" || quality === "high" || quality === "4K") {
      configuredModel = AI_MODELS.imagePro;
    }
    const fallbackModel = "imagen-3.0-generate-001";
    const modelsToTry = [configuredModel, fallbackModel, "gemini-3.1-flash-image", "gemini-3-pro-image", "imagen-3.0-generate-001"];
    const uniqueModels = Array.from(new Set(modelsToTry));
    let imageBase64;
    let modelUsed = "";
    let lastError3 = null;
    const ai9 = getAIClient();
    for (const modelName of uniqueModels) {
      try {
        modelUsed = modelName;
        if (modelName.toLowerCase().startsWith("imagen") || modelName.toLowerCase().includes("image")) {
          const response = await ai9.models.generateImages({
            model: modelName,
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
              aspectRatio
            }
          });
          if (response && response.generatedImages && response.generatedImages.length > 0) {
            imageBase64 = response.generatedImages[0].image?.imageBytes;
          }
        }
        if (imageBase64) {
          break;
        }
      } catch (err) {
        lastError3 = err;
        console.warn(`Image generation with model ${modelName} failed, trying fallback:`, err.message || err);
      }
    }
    if (!imageBase64) {
      console.error("All image generation models failed. Last error:", lastError3);
      return {
        ok: false,
        code: "IMAGE_MODEL_UNAVAILABLE",
        error: "Image model unavailable for this project/location.",
        hint: "Use imagen-3.0-generate-001 or enable image model access."
      };
    }
    const imageId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    let imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    let storagePath = null;
    try {
      const bucket = (0, import_storage2.getStorage)().bucket("al-ai-chat.firebasestorage.app");
      const path5 = `generated_images/${uid}/${imageId}.jpg`;
      const file = bucket.file(path5);
      await file.save(Buffer.from(imageBase64, "base64"), {
        metadata: {
          contentType: "image/jpeg"
        }
      });
      try {
        const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 1e3 * 60 * 60 * 24 });
        imageUrl = url;
      } catch (e) {
      }
      storagePath = path5;
    } catch (storageErr) {
      console.warn("Firebase Storage upload failed, falling back to data URL:", storageErr);
    }
    try {
      const db = getAdminDb();
      const imageRef = db.collection("generated_images").doc(uid).collection("items").doc(imageId);
      await imageRef.set({
        uid,
        subject: subject || null,
        lesson: lesson || null,
        prompt,
        promptUsed: finalPrompt,
        model: modelUsed,
        imageUrl,
        storagePath,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (dbErr) {
      console.warn("Failed to save image metadata to Firestore", dbErr);
    }
    return {
      ok: true,
      imageUrl,
      storagePath,
      model: modelUsed,
      promptUsed: prompt,
      imageId
    };
  } catch (error) {
    console.error("generateEducationalImage top-level error:", error);
    return {
      ok: false,
      code: "IMAGE_GENERATION_FAILED",
      error: error.message || "Failed to generate educational diagram."
    };
  }
}
var import_storage2;
var init_generate = __esm({
  "server/image/generate.ts"() {
    "use strict";
    init_client();
    init_admin();
    import_storage2 = require("firebase-admin/storage");
  }
});

// server/pastPapers/search.ts
var search_exports = {};
__export(search_exports, {
  searchPastPapers: () => searchPastPapers
});
async function searchPastPapers(req, res) {
  try {
    const { query: searchQuery, yearMatch, subjectMatch } = req.body;
    if (!searchQuery) {
      return res.status(400).json({ ok: false, error: "Query is required" });
    }
    const db = getAdminDb();
    const sourceCards = [];
    const localPapers = pastPapersData.papers || [];
    localPapers.forEach((p) => {
      const pSubject = p.metadata.subjectKey || "";
      const pSubjectFull = p.metadata.subject || "";
      const pExam = p.metadata.exam || "";
      const matchSubject = !subjectMatch || pSubject.toLowerCase() === subjectMatch.toLowerCase() || pSubjectFull.toLowerCase().includes(subjectMatch.toLowerCase());
      const matchYear = !yearMatch || pExam.includes(yearMatch.toString());
      if (matchSubject && matchYear) {
        sourceCards.push({
          source: "Local Database",
          title: `${pExam} - ${pSubjectFull} MCQ Answer Key`,
          url: `/api/past-papers/local/${pSubject.toLowerCase()}/${yearMatch || "2024"}`,
          type: "Answer Sheet",
          snippet: `Official MCQ answer sheet keys for ${pExam} ${pSubjectFull} (${p.metadata.medium || "Sinhala"} medium). Contains ${p.answers.length} verified MCQ answers.`
        });
      }
    });
    try {
      let fRef = db.collection("rag_sources");
      if (subjectMatch) {
        fRef = fRef.where("subject", "==", subjectMatch.toLowerCase());
      }
      if (yearMatch) {
        fRef = fRef.where("year", "==", yearMatch.toString());
      }
      const fSnap = await fRef.get();
      fSnap.docs.forEach((doc) => {
        const data = doc.data();
        const matchesSearch = !searchQuery || data.title.toLowerCase().includes(searchQuery.toLowerCase()) || data.year && data.year.toString().includes(searchQuery);
        if (matchesSearch) {
          sourceCards.push({
            source: "Firestore Storage",
            title: data.title,
            url: data.url,
            type: data.type || "PDF",
            snippet: `${data.year || ""} ${data.subject || ""} G.C.E. A/L past paper or marking scheme document uploaded to Clora storage.`
          });
        }
      });
    } catch (e) {
      console.warn("Firestore past_papers query failed:", e);
    }
    const yearStr = yearMatch || "";
    const subjectStr = subjectMatch || "";
    const googleQuery = `GCE A/L ${yearStr} ${subjectStr} past paper marking scheme Sinhala Medium PDF ${searchQuery}`;
    try {
      const ai9 = getAIClient();
      const response = await ai9.models.generateContent({
        model: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",
        contents: `Find official, verified download links or PDFs for G.C.E. A/L past papers or marking schemes. Query: ${googleQuery}. Target year: ${yearStr}, Subject: ${subjectStr}. Return only actual sources.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata && groundingMetadata.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk) => {
          if (chunk.web?.uri && chunk.web?.title) {
            const title = chunk.web.title;
            const url = chunk.web.uri;
            const snippet = chunk.web.snippet || "";
            let keep = true;
            if (yearMatch) {
              const yr = yearMatch.toString();
              if (!title.includes(yr) && !url.includes(yr) && !snippet.includes(yr)) {
                keep = false;
              }
            }
            if (subjectMatch) {
              const sub = subjectMatch.toLowerCase();
              const fullSubName = sub === "sft" ? "science" : sub === "et" ? "engineering" : sub === "ict" ? "ict" : sub;
              if (!title.toLowerCase().includes(sub) && !title.toLowerCase().includes(fullSubName) && !url.toLowerCase().includes(sub) && !url.toLowerCase().includes(fullSubName) && !snippet.toLowerCase().includes(sub) && !snippet.toLowerCase().includes(fullSubName)) {
                keep = false;
              }
            }
            if (url.includes("google.com/search") || url.includes("google.lk/search")) {
              keep = false;
            }
            if (keep) {
              sourceCards.push({
                source: "Google Search",
                title,
                url,
                type: "Web Resource",
                snippet
              });
            }
          }
        });
      }
    } catch (err) {
      console.error("Google search grounding failed:", err);
    }
    const uniqueSourceCards = [];
    const seenUrls = /* @__PURE__ */ new Set();
    sourceCards.forEach((card) => {
      if (card.url && !seenUrls.has(card.url)) {
        seenUrls.add(card.url);
        uniqueSourceCards.push(card);
      }
    });
    res.json({
      ok: true,
      query: searchQuery,
      yearMatch: yearMatch || null,
      subjectMatch: subjectMatch || null,
      sourceCards: uniqueSourceCards
    });
  } catch (error) {
    console.error("Past Paper Search failed:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
var init_search = __esm({
  "server/pastPapers/search.ts"() {
    "use strict";
    init_admin();
    init_client();
    init_pastPapersData();
  }
});

// server/ai-core/pdf/solveExtractedQuestion.ts
var solveExtractedQuestion_exports = {};
__export(solveExtractedQuestion_exports, {
  solveExtractedMcqQuestion: () => solveExtractedMcqQuestion
});
async function solveExtractedMcqQuestion(params) {
  const {
    questionText,
    options,
    subject,
    year,
    questionNo,
    referencePdfBuffer,
    referencePdfGcsUri,
    referenceLabel,
    questionPdfBuffer,
    questionPdfGcsUri,
    visualOnly = false
  } = params;
  const hasReferencePdf = Boolean(referencePdfBuffer || referencePdfGcsUri);
  const hasQuestionPdf = Boolean(questionPdfBuffer || questionPdfGcsUri);
  const systemInstruction = `
You are solving an already verified Sri Lankan A/L ${subject} MCQ.
The question and options below were extracted from the official ${year} PDF.
Choose the best answer.

RULES:
- ${visualOnly ? "Locate the exact requested question in the attached QUESTION PDF. Ignore any corrupted embedded text layer and read the rendered glyphs and diagram." : "Do not change the supplied question meaning."}
- Do not create a new question.
- Choose exactly one option (1, 2, 3, 4, or 5).
- Explain the decisive rule or fact clearly in Sinhala.
- Keep optionText as the selected option text only; do not prefix it with \u201C(1)\u201D, \u201C1.\u201D, or another option number.
- Do not invent detailed classifications or facts about distractors. Populate whyOthersWrong only for alternatives that can be rejected directly from the supplied question or the attached syllabus; otherwise return an empty array.
- If a place name, species name, technical term, or OCR transcription is uncertain, do not assign it a speculative category. State only the verified distinction needed to select the answer.
- ${hasQuestionPdf ? "The attached QUESTION PDF is authoritative visual evidence. Inspect its diagram, labels, arrows and relative positions before solving." : "No question-page image/PDF is attached; only use the extracted evidence supplied below."}
- ${hasReferencePdf ? `Use the attached ${referenceLabel || "official syllabus PDF"} as the primary theory reference. Never claim that it contains the question itself.` : "No syllabus PDF is attached. Do not claim that one was used."}
- Never repeat legacy-font/mojibake text in the answer. Write Sinhala only as Unicode Sinhala.
- Return a clean Unicode transcription of the exact question and all five options as questionUnicode/optionsUnicode.
- If a diagram is required and is attached, read it. Return optionNo:null only when the required visual evidence is genuinely absent.
- Return JSON only.
`;
  const userPrompt = `
Question Number: ${questionNo}
Question Text: ${visualOnly ? "[Read the exact question directly from the attached PDF visual.]" : questionText}

Options:
${visualOnly ? "[Read every printed option directly from the attached PDF visual.]" : options.map((opt, i) => `(${i + 1}) ${opt}`).join("\n")}

Return JSON:
{
  "optionNo": "1|2|3|4|5",
  "optionText": "text of the selected option",
  "formulaOrRule": "any formula or rule used",
  "explanationSinhala": "clear explanation in Sinhala",
  "whyOthersWrong": [],
  "confidence": 0.0-1.0,
  "answerStatus": "ai_solved_from_extracted_question",
  "syllabusEvidence": "relevant syllabus topic/principle or null",
  "usedSyllabus": ${hasReferencePdf ? "true" : "false"},
  "questionUnicode": "clean Unicode transcription of the exact question",
  "optionsUnicode": ["option 1", "option 2", "option 3", "option 4", "option 5"]
}
`;
  const parseJsonResult = (text) => {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  };
  const attemptSolve = async (repairAttempt) => {
    const parts = [];
    if (questionPdfBuffer) {
      parts.push({ text: "QUESTION PDF (use its rendered page and diagram as evidence):" });
      parts.push({ inlineData: { mimeType: "application/pdf", data: questionPdfBuffer.toString("base64") } });
    } else if (questionPdfGcsUri) {
      parts.push({ text: "QUESTION PDF (use its rendered page and diagram as evidence):" });
      parts.push({ fileData: { mimeType: "application/pdf", fileUri: questionPdfGcsUri } });
    }
    if (referencePdfBuffer) {
      parts.push({ text: `THEORY REFERENCE (${referenceLabel || "official syllabus PDF"}):` });
      parts.push({ inlineData: { mimeType: "application/pdf", data: referencePdfBuffer.toString("base64") } });
    } else if (referencePdfGcsUri) {
      parts.push({ text: `THEORY REFERENCE (${referenceLabel || "official syllabus PDF"}):` });
      parts.push({ fileData: { mimeType: "application/pdf", fileUri: referencePdfGcsUri } });
    }
    parts.push({
      text: repairAttempt ? `${userPrompt}
This is a validation retry. Inspect the requested MCQ and its diagram again. You MUST select exactly one option 1-5 and return valid JSON; do not return null merely because the embedded Sinhala text layer is corrupted.` : userPrompt
    });
    let responseText = "";
    try {
      const { result: response } = await callGeminiWithFallback("direct_pdf_solve", {
        model: AI_MODELS.pdf,
        contents: [
          {
            role: "user",
            parts
          }
        ],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json"
        }
      });
      responseText = response.text || "";
    } catch (error) {
      console.warn(`[AI_CORE] MCQ solver ${repairAttempt ? "validation" : "primary"} attempt failed`, error);
      return null;
    }
    if (!responseText) return null;
    const result = parseJsonResult(responseText);
    if (!result) return null;
    const optionNo = String(result?.optionNo || "").trim();
    if (!/^[1-5]$/.test(optionNo)) return null;
    const questionUnicode = String(result?.questionUnicode || "").trim();
    const optionsUnicode = Array.isArray(result?.optionsUnicode) ? result.optionsUnicode.map((value) => String(value || "").trim()).filter(Boolean) : [];
    if (visualOnly && (questionUnicode.length < 12 || optionsUnicode.length < 4)) return null;
    return {
      ...result,
      optionNo,
      optionText: normalizeSinhalaUnicode(result?.optionText || optionsUnicode[Number(optionNo) - 1] || options[Number(optionNo) - 1] || "").trim(),
      formulaOrRule: result?.formulaOrRule ? normalizeSinhalaUnicode(result.formulaOrRule).trim() : null,
      explanationSinhala: result?.explanationSinhala ? cleanAssistantResponse(result.explanationSinhala) : null,
      whyOthersWrong: Array.isArray(result?.whyOthersWrong) ? result.whyOthersWrong.map((value) => cleanAssistantResponse(value)).filter(Boolean) : null,
      answerStatus: "ai_solved_from_extracted_question",
      confidence: Math.max(0, Math.min(1, Number(result?.confidence || 0))),
      questionUnicode: questionUnicode ? normalizeSinhalaUnicode(questionUnicode) : null,
      optionsUnicode: optionsUnicode.length >= 4 ? optionsUnicode.map(normalizeSinhalaUnicode) : null,
      syllabusEvidence: result?.syllabusEvidence ? cleanAssistantResponse(result.syllabusEvidence) : null
    };
  };
  const first = await attemptSolve(false);
  if (first) return first;
  return await attemptSolve(true);
}
var init_solveExtractedQuestion = __esm({
  "server/ai-core/pdf/solveExtractedQuestion.ts"() {
    "use strict";
    init_modelRouter();
    init_client();
    init_assistantText();
  }
});

// server/ai-core/pdf/questionExtractor.ts
function normalizeQuestionNo(value) {
  const match = String(value ?? "").match(/\d{1,3}/);
  return match?.[0] ? String(Number(match[0])) : "";
}
function cleanOcrText(value) {
  return normalizeSinhalaUnicode(value).replace(/\r\n?/g, "\n").replace(/[\u200B\u2060]/g, "").replace(/(^|[\s\n])\u0DCA+(?=[\u0D80-\u0DFF])/g, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function mergeWithOverlap(current, next) {
  if (!current) return next;
  if (!next) return current;
  if (current.includes(next)) return current;
  if (next.includes(current)) return next;
  const max = Math.min(260, current.length, next.length);
  for (let overlap = max; overlap >= 24; overlap -= 1) {
    if (current.slice(-overlap) === next.slice(0, overlap)) {
      return `${current}${next.slice(overlap)}`;
    }
  }
  return `${current}
${next}`;
}
function rebuildFullPaperText(chunks) {
  const ordered = [...chunks].filter((chunk) => String(chunk?.text || "").trim().length > 0).sort((a, b) => {
    const pageA = Number(a.pageNumber || 0);
    const pageB = Number(b.pageNumber || 0);
    if (pageA !== pageB) return pageA - pageB;
    return Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0);
  });
  const pages = /* @__PURE__ */ new Map();
  for (const chunk of ordered) {
    const numericPage = Number(chunk.pageNumber || 0);
    const pageNumber = Number.isFinite(numericPage) && numericPage > 0 ? numericPage : null;
    const key = pageNumber === null ? "unknown" : String(pageNumber);
    const text = cleanOcrText(chunk.text);
    if (!text) continue;
    const existing = pages.get(key);
    pages.set(key, {
      pageNumber,
      text: existing ? mergeWithOverlap(existing.text, text) : text
    });
  }
  return [...pages.values()].sort((a, b) => Number(a.pageNumber || 0) - Number(b.pageNumber || 0));
}
function markerPatterns(questionNo) {
  const escaped = questionNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    new RegExp(`(?:^|\\n)\\s*(?:Q(?:uestion)?|MCQ)\\s*0*${escaped}\\s*(?:[.):-]|$)`, "i"),
    new RegExp(`(?:^|\\n)\\s*0*${escaped}\\s*[.]\\s+`, "i"),
    new RegExp(`(?:^|\\n)\\s*0*${escaped}\\s*[)]\\s+(?=[^\\n]{8,})`, "i"),
    new RegExp(`(?:^|\\n)\\s*(?:\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA|\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA)\\s*0*${escaped}\\s*(?:[.):-]|$)`, "i")
  ];
}
function findMarker(text, questionNo, from = 0) {
  let best = null;
  const slice = text.slice(from);
  for (const pattern of markerPatterns(questionNo)) {
    const match = pattern.exec(slice);
    if (!match) continue;
    const index = from + match.index + (match[0].startsWith("\n") ? 1 : 0);
    const length = match[0].length - (match[0].startsWith("\n") ? 1 : 0);
    if (!best || index < best.index) best = { index, length };
  }
  return best;
}
function findNextQuestionBoundary(text, start, currentNo) {
  const next = findMarker(text, String(currentNo + 1), start);
  if (next) return next.index;
  const tail = text.slice(start);
  const generic = /(?:^|\n)\s*(\d{1,3})\.\s+/g;
  let match;
  while (match = generic.exec(tail)) {
    const candidate = Number(match[1]);
    if (candidate > currentNo && candidate <= currentNo + 4) {
      return start + match.index + (match[0].startsWith("\n") ? 1 : 0);
    }
  }
  return Math.min(text.length, start + 6500);
}
function splitMcqOptions(rawBlock) {
  const normalized = cleanOcrText(rawBlock);
  const optionPattern = /(?:^|\n|\s)(\([1-5]\)|[1-5]\))\s*/g;
  const matches = [...normalized.matchAll(optionPattern)];
  if (matches.length < 4) {
    return { questionText: normalized, options: [] };
  }
  let sequenceStart = -1;
  let sequence = [];
  for (let i = 0; i < matches.length; i += 1) {
    const number = Number(matches[i][1].replace(/\D/g, ""));
    if (number !== 1) continue;
    const candidate = [matches[i]];
    let expected = 2;
    for (let j = i + 1; j < matches.length && expected <= 5; j += 1) {
      const nextNumber = Number(matches[j][1].replace(/\D/g, ""));
      if (nextNumber === expected) {
        candidate.push(matches[j]);
        expected += 1;
      } else if (nextNumber === 1) {
        break;
      }
    }
    if (candidate.length >= 4) {
      sequenceStart = i;
      sequence = candidate;
      break;
    }
  }
  if (sequenceStart < 0 || sequence.length < 4) {
    return { questionText: normalized, options: [] };
  }
  const first = sequence[0];
  const firstIndex = first.index ?? 0;
  const questionText = cleanOcrText(normalized.slice(0, firstIndex));
  const options = sequence.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < sequence.length ? sequence[index + 1].index ?? normalized.length : normalized.length;
    const label = match[1].replace(/\D/g, "");
    return `(${label}) ${cleanOcrText(normalized.slice(start, end))}`.trim();
  }).filter((option) => option.length > 4);
  return { questionText, options };
}
function extractQuestionFromFullPaper(chunks, requestedQuestionNo, questionType = "MCQ") {
  const questionNo = normalizeQuestionNo(requestedQuestionNo);
  if (!questionNo) {
    return {
      found: false,
      questionNo: "",
      pageNumber: null,
      questionText: null,
      options: [],
      rawBlock: null,
      scanTextLength: 0,
      reason: "QUESTION_NUMBER_MISSING"
    };
  }
  const pages = rebuildFullPaperText(chunks);
  const sections = [];
  let fullText = "";
  for (const page2 of pages) {
    const prefix = fullText ? "\n\n" : "";
    const start = fullText.length + prefix.length;
    fullText += `${prefix}${page2.text}`;
    sections.push({ pageNumber: page2.pageNumber, start, end: fullText.length, text: page2.text });
  }
  const marker = findMarker(fullText, questionNo);
  if (!marker) {
    return {
      found: false,
      questionNo,
      pageNumber: null,
      questionText: null,
      options: [],
      rawBlock: null,
      scanTextLength: fullText.length,
      reason: "QUESTION_MARKER_NOT_FOUND_IN_FULL_PAPER_SCAN"
    };
  }
  const currentNo = Number(questionNo);
  const end = findNextQuestionBoundary(fullText, marker.index + marker.length, currentNo);
  const rawBlock = cleanOcrText(fullText.slice(marker.index, end));
  const page = sections.find((section) => marker.index >= section.start && marker.index <= section.end)?.pageNumber ?? null;
  const isMcq = String(questionType || "").toLowerCase().includes("mcq");
  const parsed = isMcq ? splitMcqOptions(rawBlock) : { questionText: rawBlock, options: [] };
  const hasRequiredEvidence = parsed.questionText.length >= 12 && (!isMcq || parsed.options.length >= 4);
  return {
    found: hasRequiredEvidence,
    questionNo,
    pageNumber: page,
    questionText: hasRequiredEvidence ? parsed.questionText : null,
    options: hasRequiredEvidence ? parsed.options : [],
    rawBlock,
    scanTextLength: fullText.length,
    reason: hasRequiredEvidence ? "FULL_PAPER_OCR_SCAN_MATCH" : "QUESTION_BLOCK_INCOMPLETE_AFTER_FULL_SCAN"
  };
}
var init_questionExtractor = __esm({
  "server/ai-core/pdf/questionExtractor.ts"() {
    "use strict";
    init_assistantText();
  }
});

// server/ai-core/pdf/directPdfQa.ts
var directPdfQa_exports = {};
__export(directPdfQa_exports, {
  askGeminiDirectPdfStructured: () => askGeminiDirectPdfStructured,
  askIndexedPdfQuestionStructured: () => askIndexedPdfQuestionStructured
});
function looksLikeLegacySinhalaGarbage(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const sinhala = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
  const legacySignals = (text.match(/[ñú;=<>]|\b(?:fuu|iy|iys|l=|fkdie|mß|wd;;|T[123])\b/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return sinhala === 0 && legacySignals >= 2 && latin / Math.max(1, text.length) > 0.18;
}
function extractLeadingQuestionNumber(value) {
  const text = normalizeSinhalaUnicode(value).trim();
  const match = text.match(/^(?:#{1,6}\s*)?(?:question|q)?\s*0*(\d{1,3})\s*(?:[.)\]:-]|$)/i);
  return match?.[1] ? String(Number(match[1])) : null;
}
function isQuestionNumberMismatch(questionText, requestedQuestionNo) {
  const extracted = extractLeadingQuestionNumber(questionText);
  const requestedMatch = String(requestedQuestionNo || "").match(/\d{1,3}/);
  const requested = requestedMatch?.[0] ? String(Number(requestedMatch[0])) : null;
  return Boolean(extracted && requested && extracted !== requested);
}
function sanitizeDirectQaResult(input) {
  if (!input || typeof input !== "object") return input;
  const result = { ...input };
  if (result.sourceEvidence && typeof result.sourceEvidence === "object") {
    result.sourceEvidence = {
      ...result.sourceEvidence,
      questionText: result.sourceEvidence.questionText ? normalizeSinhalaUnicode(result.sourceEvidence.questionText).trim() : result.sourceEvidence.questionText,
      options: Array.isArray(result.sourceEvidence.options) ? result.sourceEvidence.options.map((value) => normalizeSinhalaUnicode(value).trim()).filter(Boolean) : result.sourceEvidence.options
    };
  }
  if (result.answer && typeof result.answer === "object") {
    const solved = result.answer.solvedAnswer && typeof result.answer.solvedAnswer === "object" ? {
      ...result.answer.solvedAnswer,
      optionText: result.answer.solvedAnswer.optionText ? normalizeSinhalaUnicode(result.answer.solvedAnswer.optionText).trim() : result.answer.solvedAnswer.optionText,
      explanationSinhala: result.answer.solvedAnswer.explanationSinhala ? cleanAssistantResponse(result.answer.solvedAnswer.explanationSinhala) : result.answer.solvedAnswer.explanationSinhala,
      whyOthersWrong: Array.isArray(result.answer.solvedAnswer.whyOthersWrong) ? result.answer.solvedAnswer.whyOthersWrong.map((value) => cleanAssistantResponse(value)).filter(Boolean) : result.answer.solvedAnswer.whyOthersWrong,
      questionUnicode: result.answer.solvedAnswer.questionUnicode ? normalizeSinhalaUnicode(result.answer.solvedAnswer.questionUnicode).trim() : result.answer.solvedAnswer.questionUnicode,
      optionsUnicode: Array.isArray(result.answer.solvedAnswer.optionsUnicode) ? result.answer.solvedAnswer.optionsUnicode.map((value) => normalizeSinhalaUnicode(value).trim()).filter(Boolean) : result.answer.solvedAnswer.optionsUnicode
    } : result.answer.solvedAnswer;
    result.answer = {
      ...result.answer,
      officialAnswer: result.answer.officialAnswer ? cleanAssistantResponse(result.answer.officialAnswer) : result.answer.officialAnswer,
      estimatedAnswer: result.answer.estimatedAnswer ? cleanAssistantResponse(result.answer.estimatedAnswer) : result.answer.estimatedAnswer,
      explanationSinhala: result.answer.explanationSinhala ? cleanAssistantResponse(result.answer.explanationSinhala) : result.answer.explanationSinhala,
      lesson: result.answer.lesson ? normalizeSinhalaUnicode(result.answer.lesson).trim() : result.answer.lesson,
      solvedAnswer: solved
    };
  }
  return result;
}
function directQaCacheId(sourceId, questionType, questionNo) {
  return `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
}
async function readVerifiedQuestionCache(params) {
  try {
    const snapshot = await getAdminDb().collection("pdf_question_cache").doc(directQaCacheId(params.sourceId, params.questionType, params.questionNo)).get();
    if (!snapshot.exists) return null;
    const cached = snapshot.data() || {};
    const questionText = String(cached.questionText || "").trim();
    const options = Array.isArray(cached.options) ? cached.options.map((value) => String(value).trim()).filter(Boolean) : [];
    const isMcq = String(params.questionType).toLowerCase().includes("mcq");
    const subjectMatches = !cached.subject || String(cached.subject).toUpperCase() === String(params.subject).toUpperCase();
    const yearMatches = !cached.year || String(cached.year) === String(params.year) || params.year === "unknown";
    const cachedHasLegacyGarbage = looksLikeLegacySinhalaGarbage(questionText) || options.some(looksLikeLegacySinhalaGarbage);
    const hasVerifiedAnswer = Boolean(
      params.allowOfficialAnswer && String(cached.officialAnswer || "").trim() || /^[1-5]$/.test(String(cached?.solvedAnswer?.optionNo || "").trim()) && String(cached?.solvedAnswer?.explanationSinhala || cached.explanationSinhala || "").trim()
    );
    const verified = Number(cached.evidenceVersion || 0) >= EVIDENCE_VERSION && cached.validationStatus !== "rejected" && subjectMatches && yearMatches && questionText.length >= 12 && !cachedHasLegacyGarbage && (!isMcq || options.length >= 4) && (!isMcq || hasVerifiedAnswer) && (!params.requiresSyllabusGrounding || cached.syllabusGrounded === true);
    if (!verified) return null;
    return sanitizeDirectQaResult({
      ok: true,
      found: true,
      fromCache: true,
      sourceEvidence: {
        sourceId: params.sourceId,
        pageNumber: Number.isFinite(Number(cached.pageNumber)) ? Number(cached.pageNumber) : null,
        questionNo: params.questionNo,
        questionText,
        options: options.length > 0 ? options : null
      },
      answer: {
        officialAnswer: params.allowOfficialAnswer ? cached.officialAnswer || null : null,
        estimatedAnswer: cached.estimatedAnswer || null,
        explanationSinhala: cached.explanationSinhala || null,
        lesson: cached.lesson || null,
        solvedAnswer: cached.solvedAnswer || null
      },
      confidence: Number(cached.confidence || 0),
      reason: "VERIFIED_EVIDENCE_CACHE"
    });
  } catch (error) {
    console.warn("[DirectPDFQA] Verified cache lookup skipped:", String(error?.message || error));
    return null;
  }
}
async function askGeminiDirectPdfStructured(params) {
  const {
    sourceId,
    pdfBuffer = null,
    pdfGcsUri = null,
    year,
    subject,
    questionType,
    questionNo,
    allowOfficialAnswer = false,
    syllabusPdfBuffer = null,
    syllabusPdfGcsUri = null,
    originalPageNumbers = []
  } = params;
  const modelName = AI_MODELS.pdf;
  const cached = await readVerifiedQuestionCache({
    sourceId,
    subject,
    year,
    questionType,
    questionNo,
    allowOfficialAnswer,
    requiresSyllabusGrounding: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri)
  });
  if (cached) return cached;
  const systemInstruction = `You are an evidence-first Sri Lankan A/L exam PDF extractor.
You are reading the exact locked PDF source.

Requested:
Year: ${year}
Subject: ${subject}
Question Type: ${questionType}
Question Number: ${questionNo}
${originalPageNumbers.length > 0 ? `The attached subset pages map to original PDF pages: ${originalPageNumbers.join(", ")}.` : ""}

STRICT RULES:
1. First find the exact requested question in the PDF.
2. Extract exact question text as written in the PDF.
3. If MCQ, extract all options exactly.
4. Only if exact questionText is extracted, solve/explain.
5. If exact question is not visible, return found:false.
6. Do NOT guess the question or the answer.
7. ${allowOfficialAnswer ? "Only copy officialAnswer when it is explicitly printed in this marking-scheme source." : "This source is not a verified marking scheme. Always return officialAnswer:null; any solution must be generated later as clearly labelled reasoning."}
8. Do NOT create a similar or model question.
9. Do NOT answer from syllabus or general memory.
10. Do NOT fill answer.estimatedAnswer unless questionText exists.
11. Read the rendered glyphs, diagrams, labels, arrows and geometry on the page\u2014not only the embedded text layer.
12. If the PDF uses FM Abhaya or another legacy Sinhala font, TRANSCRIBE the visible Sinhala into proper Unicode Sinhala. Never return Latin/ASCII font codes such as "fuu", "m\xDF", "l=", "\xF1" or "\xFA".
13. For a diagram-based MCQ, include the diagram's relevant relationships in questionText using a short bracketed Unicode description so the solver has all required evidence.

Return JSON only:
{
  "found": boolean,
  "sourceEvidence": {
    "sourceId": "${sourceId}",
    "pageNumber": number|null,
    "questionNo": "${questionNo}",
    "questionText": string|null,
    "options": string[]|null
  },
  "answer": {
    "officialAnswer": string|null,
    "estimatedAnswer": null,
    "explanationSinhala": string|null,
    "lesson": string|null
  },
  "confidence": number,
  "reason": string
}`;
  if (!pdfBuffer && !pdfGcsUri) {
    throw new Error("Direct PDF QA requires either PDF bytes or a verified Vertex GCS URI.");
  }
  const pdfPart = pdfBuffer ? { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } } : { fileData: { mimeType: "application/pdf", fileUri: pdfGcsUri } };
  const userPrompt = `
Requested:
Year: ${year}
Subject: ${subject}
Question Type: ${questionType}
Question Number: ${questionNo}
Source ID: ${sourceId}
${originalPageNumbers.length > 0 ? `Subset page mapping (subset page 1 first): ${originalPageNumbers.join(", ")}` : ""}

Return JSON with exact evidence. If not found, set found:false.
`;
  const uid = params.uid || "anonymous";
  try {
    const { result: response } = await callGeminiWithFallback("direct_pdf_extract", {
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [pdfPart, { text: userPrompt }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json"
      }
    });
    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }
    let result = JSON.parse(response.text.trim());
    if (originalPageNumbers.length > 0 && result?.sourceEvidence) {
      const subsetPage = Number(result.sourceEvidence.pageNumber || 0);
      result.sourceEvidence.pageNumber = subsetPage >= 1 ? originalPageNumbers[subsetPage - 1] || originalPageNumbers[0] : originalPageNumbers[0];
    }
    if (!allowOfficialAnswer && result?.answer) {
      result.answer.officialAnswer = null;
    }
    if (result.answer?.explanationSinhala) {
      result.answer.explanationSinhala = stripRawVisualBlocks(result.answer.explanationSinhala);
    }
    let qText = result?.sourceEvidence?.questionText;
    let opts = result?.sourceEvidence?.options;
    let extractedOptions = Array.isArray(opts) ? opts : [];
    let hasUnreadableLegacyText = looksLikeLegacySinhalaGarbage(qText) || extractedOptions.some(looksLikeLegacySinhalaGarbage);
    if (questionType === "MCQ" && hasUnreadableLegacyText && (pdfBuffer || pdfGcsUri)) {
      const visualSolved = await solveExtractedMcqQuestion({
        questionText: "",
        options: [],
        subject,
        year,
        questionNo,
        referencePdfBuffer: syllabusPdfBuffer,
        referencePdfGcsUri: syllabusPdfGcsUri,
        referenceLabel: "Sri Lankan A/L SFT syllabus PDF",
        questionPdfBuffer: pdfBuffer,
        questionPdfGcsUri: pdfGcsUri,
        visualOnly: true
      }).catch((error) => {
        console.error("[DirectPDFQA] Visual legacy-font solver failed:", error);
        return null;
      });
      if (visualSolved?.questionUnicode && visualSolved.optionsUnicode?.length && result?.sourceEvidence) {
        result.sourceEvidence.questionText = visualSolved.questionUnicode;
        result.sourceEvidence.options = visualSolved.optionsUnicode;
        result.found = true;
        result.reason = "VISUAL_LEGACY_FONT_TRANSCRIPTION";
        result.answer = {
          ...result.answer || {},
          officialAnswer: null,
          solvedAnswer: visualSolved,
          explanationSinhala: visualSolved.explanationSinhala || null
        };
        result.confidence = Math.max(Number(result.confidence || 0), visualSolved.confidence);
        qText = result.sourceEvidence.questionText;
        opts = result.sourceEvidence.options;
        extractedOptions = opts;
        hasUnreadableLegacyText = false;
      }
    }
    if (result.found && isQuestionNumberMismatch(qText, questionNo)) {
      console.warn(`[DirectPDFQA] Rejected mismatched question text. Requested Q${questionNo}; extracted marker=${extractLeadingQuestionNumber(qText)}`);
      result = {
        ...result,
        found: false,
        reason: "QUESTION_NUMBER_MISMATCH",
        answer: { officialAnswer: null, estimatedAnswer: null, explanationSinhala: null, lesson: null },
        confidence: 0
      };
    }
    if (!result.found || !qText || qText.length < 20 || hasUnreadableLegacyText) {
      console.log(`[DirectPDFQA] Extraction failed validation: found=${result.found}, textLength=${qText?.length || 0}`);
      result = {
        ...result,
        found: false,
        reason: hasUnreadableLegacyText ? "LEGACY_SINHALA_VISUAL_TRANSCRIPTION_REQUIRED" : result.reason || "EXACT_QUESTION_TEXT_MISSING",
        answer: {
          officialAnswer: null,
          estimatedAnswer: null,
          explanationSinhala: null,
          lesson: null
        },
        confidence: 0
      };
    }
    if (questionType === "MCQ" && (!Array.isArray(opts) || opts.length < 4)) {
      console.log(`[DirectPDFQA] MCQ validation failed: optionsCount=${opts?.length || 0}`);
      result = {
        ...result,
        found: false,
        reason: "MCQ_OPTIONS_MISSING"
      };
    }
    if (result.found === true && result.sourceEvidence?.questionText && Array.isArray(result.sourceEvidence.options) && result.sourceEvidence.options.length >= 4 && !result.answer?.solvedAnswer && !result.answer?.officialAnswer) {
      console.log(`[DirectPDFQA] Triggering solver pass for ${questionType} ${questionNo}`);
      try {
        const solved = await solveExtractedMcqQuestion({
          questionText: result.sourceEvidence.questionText,
          options: result.sourceEvidence.options,
          subject,
          year,
          questionNo,
          referencePdfBuffer: syllabusPdfBuffer,
          referencePdfGcsUri: syllabusPdfGcsUri,
          referenceLabel: "Sri Lankan A/L SFT syllabus PDF",
          questionPdfBuffer: pdfBuffer,
          questionPdfGcsUri: pdfGcsUri
        });
        if (solved) {
          await trackAIUsage(uid, AI_MODELS.pdf, 500, 500, "solverCalls");
          result.answer = {
            ...result.answer,
            solvedAnswer: solved
          };
          if (!result.answer.explanationSinhala && solved.explanationSinhala) {
            result.answer.explanationSinhala = solved.explanationSinhala;
          }
        }
      } catch (solveErr) {
        console.error("[DirectPDFQA] Solver pass failed:", solveErr);
      }
    }
    if (questionType === "MCQ" && result.found === true && !result.answer?.officialAnswer && !/^[1-5]$/.test(String(result.answer?.solvedAnswer?.optionNo || "").trim())) {
      return {
        ok: false,
        found: false,
        errorCode: "MCQ_SOLVER_EMPTY",
        stage: "ANSWER_VALIDATION",
        reason: "The exact MCQ was located, but the solver did not return one validated option.",
        canRetry: true
      };
    }
    result = sanitizeDirectQaResult(result);
    if (result.found && result.sourceEvidence?.questionText) {
      const db = getAdminDb();
      const cacheId = directQaCacheId(sourceId, questionType, questionNo);
      const cacheData = {
        sourceId,
        subject,
        year,
        questionType,
        questionNo,
        ...result.sourceEvidence,
        ...result.answer,
        confidence: result.confidence,
        extractionMethod: originalPageNumbers.length > 0 ? "gemini_targeted_legacy_page" : "gemini_direct_pdf_qa",
        validationStatus: result.confidence > 0.8 ? "valid" : "needs_review",
        evidenceVersion: EVIDENCE_VERSION,
        syllabusGrounded: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        const { removeUndefinedDeep: removeUndefinedDeep2 } = await Promise.resolve().then(() => (init_chatSanitizer(), chatSanitizer_exports));
        await db.collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep2(cacheData), { merge: true });
        console.log(`[AI_CORE] Saved structured cache for ${cacheId}`);
      } catch (cacheErr) {
        console.error("[AI_CORE] Failed to save PDF question cache:", cacheErr);
      }
    }
    return sanitizeDirectQaResult({ ok: true, ...result });
  } catch (err) {
    console.error("[AI_CORE] Direct PDF QA JSON extraction failed:", err);
    const classified = err?.code === "AI_BILLING_EXHAUSTED" ? { code: "AI_BILLING_EXHAUSTED" } : classifyAiError(err);
    if (classified.code === "AI_BILLING_EXHAUSTED") {
      return {
        ok: false,
        found: false,
        errorCode: "AI_BILLING_EXHAUSTED",
        stage: "MODEL_CALL",
        reason: "AI billing exhausted. PDF was not fully analyzed by Gemini.",
        message: "AI credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DB1\u0DD2\u0DC3\u0DCF PDF scan/answer generation complete \u0DC0\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0.",
        canRetry: false
      };
    }
    const isRequireErr = String(err?.message || err).includes("require is not defined");
    return {
      ok: false,
      found: false,
      errorCode: isRequireErr ? "AI_CLIENT_RUNTIME_ERROR" : "GEMINI_DIRECT_PDF_QA_FAILED",
      stage: "MODEL_CALL",
      reason: isRequireErr ? "AI client runtime error" : "Gemini Direct PDF QA failed before verified extraction.",
      error: String(err?.message || err).slice(0, 500)
    };
  } finally {
    await trackAIUsage(uid, modelName, 1e3, 500, "directPdfQaCalls");
  }
}
async function askIndexedPdfQuestionStructured(params) {
  const {
    uid,
    sourceId,
    chunks,
    year,
    subject,
    questionType,
    questionNo,
    allowOfficialAnswer = false,
    syllabusPdfBuffer = null,
    syllabusPdfGcsUri = null
  } = params;
  const cached = await readVerifiedQuestionCache({
    sourceId,
    subject,
    year,
    questionType,
    questionNo,
    allowOfficialAnswer,
    requiresSyllabusGrounding: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri)
  });
  if (cached) return cached;
  const isMcq = String(questionType).toLowerCase().includes("mcq");
  const deterministicEvidence = extractQuestionFromFullPaper(chunks, questionNo, questionType);
  if (deterministicEvidence.found && isMcq && !allowOfficialAnswer) {
    const questionText = deterministicEvidence.questionText;
    const options = deterministicEvidence.options;
    const solved = await solveExtractedMcqQuestion({
      questionText,
      options,
      subject,
      year,
      questionNo,
      referencePdfBuffer: syllabusPdfBuffer,
      referencePdfGcsUri: syllabusPdfGcsUri,
      referenceLabel: "Sri Lankan A/L SFT syllabus PDF"
    }).catch((error) => {
      console.error("[DirectPDFQA] Full-paper OCR solver failed:", error);
      return null;
    });
    if (!solved || !/^[1-5]$/.test(String(solved.optionNo || "").trim())) {
      return {
        ok: false,
        found: false,
        errorCode: "MCQ_SOLVER_EMPTY",
        stage: "ANSWER_VALIDATION",
        reason: "The exact MCQ was isolated from the full-paper OCR scan, but no validated option was produced.",
        canRetry: true
      };
    }
    const deterministicResult = sanitizeDirectQaResult({
      ok: true,
      found: true,
      sourceEvidence: {
        sourceId,
        pageNumber: deterministicEvidence.pageNumber,
        questionNo,
        questionText,
        options
      },
      answer: {
        officialAnswer: null,
        estimatedAnswer: null,
        explanationSinhala: solved.explanationSinhala || null,
        lesson: null,
        solvedAnswer: solved
      },
      confidence: Math.max(0.9, Number(solved.confidence || 0)),
      reason: deterministicEvidence.reason,
      fullPaperScan: true,
      scannedCharacters: deterministicEvidence.scanTextLength
    });
    const cacheId = directQaCacheId(sourceId, questionType, questionNo);
    await getAdminDb().collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep({
      sourceId,
      subject,
      year,
      questionType,
      questionNo,
      ...deterministicResult.sourceEvidence,
      ...deterministicResult.answer,
      confidence: deterministicResult.confidence,
      extractionMethod: "full_paper_ocr_scan",
      validationStatus: "valid",
      evidenceVersion: EVIDENCE_VERSION,
      syllabusGrounded: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
      fullPaperScan: true,
      scannedCharacters: deterministicEvidence.scanTextLength,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }), { merge: true });
    await trackAIUsage(uid, AI_MODELS.pdf, Math.ceil(deterministicEvidence.scanTextLength / 4), 500, "directPdfQaCalls");
    return deterministicResult;
  }
  if (isMcq && !allowOfficialAnswer && !deterministicEvidence.found) {
    return {
      ok: false,
      found: false,
      errorCode: "FULL_PAPER_VISUAL_SCAN_REQUIRED",
      stage: "FULL_PAPER_INDEX_SCAN",
      reason: deterministicEvidence.reason,
      message: "The full OCR/text index did not contain a safe, complete question boundary. Scan the original PDF pages visually.",
      canRetry: true
    };
  }
  const ordered = [...chunks].sort((a, b) => {
    const pageDiff = Number(a.pageNumber || 0) - Number(b.pageNumber || 0);
    return pageDiff || Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0);
  }).map((chunk) => `[Page ${chunk.pageNumber || "?"}]
${String(chunk.text || "").trim()}`).filter(Boolean).join("\n\n").slice(0, 18e4);
  if (ordered.replace(/\s/g, "").length < 80) {
    return {
      ok: false,
      found: false,
      errorCode: "PDF_REINDEX_REQUIRED",
      stage: "INDEX_LOOKUP",
      reason: "The indexed PDF text is empty or incomplete."
    };
  }
  const systemInstruction = `You extract one exact Sri Lankan A/L exam question from INDEXED PDF TEXT.
Requested: ${year} ${subject} ${questionType} ${questionNo}.
Rules:
- Use only the supplied indexed text. Never invent a question, option, answer, page, or source detail.
- Match question markers such as 01., 1., Q1, Question 1, or Sinhala question numbering.
- Extract the complete question and, for MCQ, all printed options.
- If the exact question is absent or unreadable return found:false.
- ${allowOfficialAnswer ? "Copy an official answer only when it is explicitly printed in this verified marking-scheme text." : "Always set officialAnswer:null. This is not a verified marking scheme."}
- Return JSON only.`;
  try {
    const { result: response } = await callGeminiWithFallback("direct_pdf_extract", {
      model: AI_MODELS.pdf,
      contents: [{
        role: "user",
        parts: [{
          text: `${systemInstruction}

INDEXED PDF TEXT:
${ordered}

Return {"found":boolean,"sourceEvidence":{"sourceId":"${sourceId}","pageNumber":number|null,"questionNo":"${questionNo}","questionText":string|null,"options":string[]|null},"answer":{"officialAnswer":string|null,"explanationSinhala":string|null,"lesson":string|null},"confidence":number,"reason":string}.`
        }]
      }],
      config: { temperature: 0, responseMimeType: "application/json" }
    });
    const result = JSON.parse(String(response.text || "{}").trim());
    const questionText = String(result?.sourceEvidence?.questionText || "").trim();
    const options = Array.isArray(result?.sourceEvidence?.options) ? result.sourceEvidence.options.map((value) => String(value).trim()).filter(Boolean) : [];
    const numberMismatch = isQuestionNumberMismatch(questionText, questionNo);
    if (!result?.found || numberMismatch || questionText.length < 12 || isMcq && options.length < 4) {
      return {
        ok: false,
        found: false,
        errorCode: numberMismatch ? "QUESTION_NUMBER_MISMATCH" : "EXACT_QUESTION_EVIDENCE_MISSING",
        stage: "INDEX_LOOKUP",
        reason: numberMismatch ? `The extracted question marker does not match requested question ${questionNo}.` : "The exact question is not readable in the indexed PDF text."
      };
    }
    if (!allowOfficialAnswer && result.answer) result.answer.officialAnswer = null;
    if (!result.answer) result.answer = { officialAnswer: null };
    if (isMcq && !result.answer.officialAnswer) {
      const solved = await solveExtractedMcqQuestion({
        questionText,
        options,
        subject,
        year,
        questionNo,
        referencePdfBuffer: syllabusPdfBuffer,
        referencePdfGcsUri: syllabusPdfGcsUri,
        referenceLabel: "Sri Lankan A/L SFT syllabus PDF"
      }).catch(() => null);
      if (solved) result.answer.solvedAnswer = solved;
    }
    if (isMcq && !result.answer.officialAnswer && !/^[1-5]$/.test(String(result.answer?.solvedAnswer?.optionNo || "").trim())) {
      return {
        ok: false,
        found: false,
        errorCode: "MCQ_SOLVER_EMPTY",
        stage: "ANSWER_VALIDATION",
        reason: "The indexed question was found, but no validated MCQ option was produced.",
        canRetry: true
      };
    }
    const cacheId = directQaCacheId(sourceId, questionType, questionNo);
    await getAdminDb().collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep({
      sourceId,
      subject,
      year,
      questionType,
      questionNo,
      ...result.sourceEvidence,
      ...result.answer,
      confidence: Number(result.confidence || 0),
      extractionMethod: "full_paper_index_scan",
      validationStatus: Number(result.confidence || 0) >= 0.8 ? "valid" : "needs_review",
      evidenceVersion: EVIDENCE_VERSION,
      syllabusGrounded: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
      fullPaperScan: true,
      scannedCharacters: ordered.length,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }), { merge: true });
    await trackAIUsage(uid, AI_MODELS.pdf, Math.ceil(ordered.length / 4), 500, "directPdfQaCalls");
    return sanitizeDirectQaResult({ ok: true, ...result });
  } catch (error) {
    const classified = classifyAiError(error);
    return {
      ok: false,
      found: false,
      errorCode: classified.code || "INDEXED_PDF_QA_FAILED",
      stage: "MODEL_CALL",
      reason: String(error?.message || error).slice(0, 400)
    };
  }
}
var EVIDENCE_VERSION;
var init_directPdfQa = __esm({
  "server/ai-core/pdf/directPdfQa.ts"() {
    "use strict";
    init_client();
    init_modelRouter();
    init_stripVisualBlocks();
    init_chatSanitizer();
    init_admin();
    init_solveExtractedQuestion();
    init_usageTracker();
    init_aiErrorClassifier();
    init_assistantText();
    init_questionExtractor();
    EVIDENCE_VERSION = 4;
  }
});

// server/tts/googleTts.ts
var googleTts_exports = {};
__export(googleTts_exports, {
  generateGoogleTts: () => generateGoogleTts
});
async function generateGoogleTts(input) {
  let resolvedVoiceName = input.voice;
  if (!resolvedVoiceName || resolvedVoiceName === "auto") {
    try {
      const [result] = await client.listVoices({ languageCode: input.languageCode });
      const voices = result.voices || [];
      if (voices.length > 0) {
        const preferred = voices.find((v) => v.name?.includes("Neural2") || v.name?.includes("Wavenet") || v.name?.includes("Studio"));
        if (preferred && preferred.name) {
          resolvedVoiceName = preferred.name;
        } else if (voices[0].name) {
          resolvedVoiceName = voices[0].name;
        }
      }
    } catch (e) {
      console.warn("Failed to list voices, falling back to default", e);
    }
  }
  if (!resolvedVoiceName || resolvedVoiceName === "auto") {
    resolvedVoiceName = input.languageCode.startsWith("si") ? "si-LK-Standard-A" : "en-US-Standard-D";
  }
  const request = {
    input: { text: input.text },
    voice: { languageCode: input.languageCode, name: resolvedVoiceName },
    audioConfig: { audioEncoding: "MP3" }
  };
  try {
    const [response] = await client.synthesizeSpeech(request);
    if (!response.audioContent) {
      throw new Error("Google TTS returned no audioContent");
    }
    return {
      buffer: Buffer.from(response.audioContent),
      contentType: "audio/mpeg",
      provider: "google_cloud",
      voiceName: resolvedVoiceName
    };
  } catch (error) {
    const err = new Error("Google TTS failed");
    err.code = "TTS_PROVIDER_ERROR";
    err.providerError = error.message;
    throw err;
  }
}
var import_text_to_speech, client;
var init_googleTts = __esm({
  "server/tts/googleTts.ts"() {
    "use strict";
    import_text_to_speech = __toESM(require("@google-cloud/text-to-speech"), 1);
    client = new import_text_to_speech.default.TextToSpeechClient();
  }
});

// server/ai/pdfAnswerService.ts
var pdfAnswerService_exports = {};
__export(pdfAnswerService_exports, {
  answerFromPdfEvidence: () => answerFromPdfEvidence
});
async function answerFromPdfEvidence({
  uid,
  chatId,
  transcriptOrPrompt,
  activeSubject,
  activeSourceId,
  recentAttachmentIds,
  questionNo,
  questionType,
  year,
  mode = "live_voice"
}) {
  try {
    const db = getAdminDb();
    const ai9 = getAIClient();
    let chunks = [];
    let sourceIdsToSearch = [activeSourceId, ...recentAttachmentIds || []].filter(Boolean);
    if (sourceIdsToSearch.length > 0) {
      for (const srcId of sourceIdsToSearch) {
        const snap = await db.collection("rag_chunks").where("sourceId", "==", srcId).get();
        chunks.push(...snap.docs.map((d) => d.data()));
      }
    } else {
      let query = db.collection("rag_chunks").where("ownerUid", "==", uid);
      if (activeSubject) {
        query = query.where("subject", "==", activeSubject);
      }
      const snap = await query.limit(50).get();
      chunks.push(...snap.docs.map((d) => d.data()));
    }
    if (chunks.length === 0) {
      return {
        ok: false,
        code: "PDF_SOURCE_REQUIRED",
        message: "\u0DB8\u0DDC\u0DB1 PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA\u0DAF answer \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1\u0DDA? PDF \u0D91\u0D9A select \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.",
        answer: "\u0DB8\u0DDC\u0DB1 PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA\u0DAF answer \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1\u0DDA? \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB PDF \u0D91\u0D9A\u0D9A\u0DCA select \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.",
        sources: [],
        evidenceLevel: "blocked"
      };
    }
    const contextLines = chunks.slice(0, 15).map((c) => `[Source: ${c.title || c.fileName} | Page: ${c.pageNumber || "?"}] ${c.text}`);
    const contextStr = contextLines.join("\n\n");
    const systemInstruction = `You are a Sinhala-first A/L Technology tutor. 
You must answer the user's question USING ONLY the provided PDF context. 
If the evidence is not in the context, say 'PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA verify \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DBB\u0DD2 \u0DB1\u0DD2\u0DC3\u0DCF answer guess \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DD9 \u0DB1\u0DD0\u0DC4\u0DD0. \u0DC0\u0DD9\u0DB1 PDF \u0D91\u0D9A\u0D9A\u0DCA select \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.'
Do not guess. Do not bring in outside knowledge if the context doesn't support it.
Output valid JSON.`;
    const prompt = `Context:
${contextStr}

Question: ${transcriptOrPrompt}

Return JSON: { "answer": "Sinhala answer text", "evidenceLevel": "high|medium|blocked", "sourceTitles": ["..."] }`;
    const response = await ai9.models.generateContent({
      model: AI_MODELS.pdf || "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai12.Type.OBJECT,
          properties: {
            answer: { type: import_genai12.Type.STRING },
            evidenceLevel: { type: import_genai12.Type.STRING },
            sourceTitles: { type: import_genai12.Type.ARRAY, items: { type: import_genai12.Type.STRING } }
          },
          required: ["answer", "evidenceLevel", "sourceTitles"]
        }
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    let finalSources = [];
    if (parsed.sourceTitles && parsed.sourceTitles.length > 0) {
      for (const title of parsed.sourceTitles) {
        const match = chunks.find((c) => (c.title || c.fileName) === title);
        if (match) {
          finalSources.push({
            sourceId: match.sourceId,
            title: match.title || match.fileName,
            pageNumber: match.pageNumber,
            usedInAnswer: true,
            storagePath: match.storagePath
            // assuming it exists
          });
        }
      }
    }
    finalSources = Array.from(new Map(finalSources.map((s) => [s.sourceId, s])).values());
    if (parsed.evidenceLevel === "blocked") {
      return {
        ok: false,
        code: "PDF_SOURCE_REQUIRED",
        message: parsed.answer,
        answer: parsed.answer,
        sources: finalSources,
        evidenceLevel: "blocked"
      };
    }
    return {
      ok: true,
      answer: parsed.answer,
      sources: finalSources,
      evidenceLevel: parsed.evidenceLevel || "high"
    };
  } catch (err) {
    console.error("PDF Answer error:", err);
    return {
      ok: false,
      code: "ERROR",
      message: err.message,
      answer: "\u0DC3\u0DB8\u0DCF\u0DC0\u0DD9\u0DB1\u0DCA\u0DB1, PDF \u0D91\u0D9A \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DDA\u0DAF\u0DD3 \u0DAF\u0DDD\u0DC2\u0DBA\u0D9A\u0DCA \u0D87\u0DAD\u0DD2 \u0DC0\u0DD2\u0DBA.",
      sources: [],
      evidenceLevel: "blocked"
    };
  }
}
var import_genai12;
var init_pdfAnswerService = __esm({
  "server/ai/pdfAnswerService.ts"() {
    "use strict";
    init_admin();
    import_genai12 = require("@google/genai");
    init_client();
  }
});

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_config2 = require("dotenv/config");

// server/utils/env.ts
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var errors = [];
function validateBoolean(key, defaultValue) {
  const value = process.env[key];
  if (value === void 0) {
    return defaultValue;
  }
  const clean = value.trim().toLowerCase();
  if (clean === "true" || clean === "yes" || clean === "1" || clean === "t" || clean === "y") return true;
  if (clean === "false" || clean === "no" || clean === "0" || clean === "f" || clean === "n") return false;
  errors.push(`Invalid boolean value for ${key}: "${value}". Expected "true" or "false".`);
  return defaultValue;
}
function validateEnum(key, allowedValues, defaultValue) {
  const value = process.env[key];
  if (value === void 0) {
    return defaultValue;
  }
  const clean = value.trim();
  if (allowedValues.includes(clean)) {
    return clean;
  }
  errors.push(`Invalid value for ${key}: "${value}". Expected one of: ${allowedValues.join(", ")}`);
  return defaultValue;
}
function validateNumber(key, defaultValue, min, max) {
  const value = process.env[key];
  if (value === void 0) {
    return defaultValue;
  }
  const num = Number(value.trim());
  if (isNaN(num)) {
    errors.push(`Invalid number value for ${key}: "${value}".`);
    return defaultValue;
  }
  if (min !== void 0 && num < min) {
    errors.push(`Value for ${key} (${num}) is below minimum limit (${min}).`);
  }
  if (max !== void 0 && num > max) {
    errors.push(`Value for ${key} (${num}) exceeds maximum limit (${max}).`);
  }
  return num;
}
function validateOptional(key, defaultValue = "") {
  const value = process.env[key];
  return value !== void 0 ? value.trim() : defaultValue;
}
var NODE_ENV = validateEnum("NODE_ENV", ["development", "production", "test"], "development");
var PORT = validateNumber("PORT", 3e3, 1, 65535);
var rawOrigins = validateOptional("ALLOWED_ORIGINS", "");
var ALLOWED_ORIGINS = [];
if (rawOrigins) {
  ALLOWED_ORIGINS = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
} else {
  ALLOWED_ORIGINS = NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://localhost:3000"];
}
var GOOGLE_CLOUD_PROJECT = validateOptional("GOOGLE_CLOUD_PROJECT", "al-ai-chat");
var FIREBASE_PROJECT_ID = validateOptional("FIREBASE_PROJECT_ID", "al-ai-chat");
var FIREBASE_STORAGE_BUCKET = validateOptional("FIREBASE_STORAGE_BUCKET", "al-ai-chat.firebasestorage.app");
var FIRESTORE_DATABASE_ID = validateOptional("FIRESTORE_DATABASE_ID", "");
var GEMINI_API_KEY = validateOptional("GEMINI_API_KEY", "");
var GEMINI_DEFAULT_MODEL = validateOptional("GEMINI_DEFAULT_MODEL", "gemini-3.5-flash");
var DEV_BYPASS_AUTH = validateBoolean("DEV_BYPASS_AUTH", false);
var ENABLE_MOCK_ROUTES = validateBoolean("ENABLE_MOCK_ROUTES", false);
var ENABLE_MODEL_TEST_ROUTE = validateBoolean("ENABLE_MODEL_TEST_ROUTE", false);
var ENABLE_IMAGE_GENERATION = validateBoolean("ENABLE_IMAGE_GENERATION", false);
var OCR_ENABLED = validateBoolean("OCR_ENABLED", false);
var MAX_BODY_LIMIT_MB = validateNumber("MAX_BODY_LIMIT_MB", 2, 0.1, 100);
var RATE_LIMIT_IP_WINDOW_MS = validateNumber("RATE_LIMIT_IP_WINDOW_MS", 6e4, 1e3);
var RATE_LIMIT_IP_MAX = validateNumber("RATE_LIMIT_IP_MAX", 100, 1);
var RATE_LIMIT_UID_WINDOW_MS = validateNumber("RATE_LIMIT_UID_WINDOW_MS", 6e4, 1e3);
var RATE_LIMIT_UID_MAX = validateNumber("RATE_LIMIT_UID_MAX", 100, 1);
var ENABLE_VIDEO = validateBoolean("ENABLE_VIDEO", true);
var ENABLE_VIDEO_TRANSCODING = validateBoolean("ENABLE_VIDEO_TRANSCODING", false);
var VIDEO_ALLOW_DIRECT_PLAYBACK = validateBoolean("VIDEO_ALLOW_DIRECT_PLAYBACK", true);
var VIDEO_REQUIRE_APP_CHECK = validateBoolean("VIDEO_REQUIRE_APP_CHECK", false);
var VIDEO_INPUT_BUCKET = validateOptional("VIDEO_INPUT_BUCKET", FIREBASE_STORAGE_BUCKET);
var VIDEO_OUTPUT_BUCKET = validateOptional("VIDEO_OUTPUT_BUCKET", "");
var VIDEO_ARCHIVE_BUCKET = validateOptional("VIDEO_ARCHIVE_BUCKET", "");
var VIDEO_TRANSCODER_LOCATION = validateOptional("VIDEO_TRANSCODER_LOCATION", "us-central1");
var VIDEO_CDN_BASE_URL = validateOptional("VIDEO_CDN_BASE_URL", "").replace(/\/$/, "");
var VIDEO_CDN_KEY_NAME = validateOptional("VIDEO_CDN_KEY_NAME", "");
var VIDEO_CDN_SIGNING_KEY = validateOptional("VIDEO_CDN_SIGNING_KEY", "");
var VIDEO_COOKIE_DOMAIN = validateOptional("VIDEO_COOKIE_DOMAIN", "");
var VIDEO_UPLOAD_MAX_MB = validateNumber("VIDEO_UPLOAD_MAX_MB", 10240, 1, 51200);
var VIDEO_COOKIE_TTL_SECONDS = validateNumber("VIDEO_COOKIE_TTL_SECONDS", 300, 60, 600);
var VIDEO_SESSION_TTL_SECONDS = validateNumber("VIDEO_SESSION_TTL_SECONDS", 600, 120, 3600);
var ENABLE_4K = validateBoolean("ENABLE_4K", false);
if (NODE_ENV === "production") {
  if (ALLOWED_ORIGINS.includes("*")) {
    errors.push("CORS Wildcard origin is not permitted in production.");
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
  console.error("\u274C Environment configuration validation failed:");
  errors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
}
var env = {
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
  RATE_LIMIT_IP_WINDOW_MS,
  RATE_LIMIT_IP_MAX,
  RATE_LIMIT_UID_WINDOW_MS,
  RATE_LIMIT_UID_MAX,
  ENABLE_VIDEO,
  ENABLE_VIDEO_TRANSCODING,
  VIDEO_ALLOW_DIRECT_PLAYBACK,
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
function logEnvConfig() {
  console.log("\u{1F512} Safe Environment Config Loaded:");
  Object.keys(env).forEach((key) => {
    const value = env[key];
    const isSecret = key.includes("KEY") || key.includes("SECRET") || key.includes("TOKEN") || key.includes("PASSWORD");
    if (isSecret) {
      console.log(`  - ${key}: [REDACTED] (${value ? "Configured" : "Not Configured"})`);
    } else {
      console.log(`  - ${key}: ${JSON.stringify(value)}`);
    }
  });
}

// server.ts
init_client();
init_admin();
var import_express16 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);

// server/ai/routes.ts
var import_express = require("express");
init_admin();
init_respondStream();

// server/ai/respond.ts
init_client();

// server/ai/errors.ts
function classifyAIError(error) {
  let errMsg = error?.message || "Internal server error";
  let code = "UNKNOWN_ERROR";
  let hint = "Please try again later.";
  if (errMsg.includes("Prepayment Credits Depleted")) {
    code = "CREDITS_DEPLETED";
    errMsg = "Wrong AI Studio API key path is still being used. Use Vertex AI auth.";
    hint = "The server is still using AI Studio Developer API key, which is wrong for our billing setup. Please ensure Google Cloud ADC is configured.";
  } else if (errMsg.includes("Could not load the default credentials")) {
    code = "CREDENTIALS_MISSING";
    errMsg = "Missing Google Cloud service account credentials.";
    hint = "Missing service account / ADC configuration.";
  } else if (error?.status === 403 || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("aiplatform.endpoints.predict")) {
    code = "PERMISSION_DENIED";
    errMsg = "Service account lacks roles/aiplatform.user or API is not enabled.";
    hint = "Service account lacks roles/aiplatform.user or Vertex AI API is not enabled.";
  } else if (error?.status === 429 || errMsg.includes("quota") || errMsg.includes("rate limit")) {
    code = "QUOTA_EXCEEDED";
    errMsg = "Quota or rate limit exceeded.";
    hint = "Too many requests. Please try again in a minute.";
  } else if (error?.status === 404 || errMsg.includes("not found") || errMsg.includes("NOT_FOUND")) {
    code = "MODEL_NOT_FOUND";
    errMsg = "Model not available in selected project/location.";
    hint = "Check model access or change region location.";
  } else if (errMsg.includes("safety") || errMsg.includes("blocked")) {
    code = "SAFETY_BLOCK";
    errMsg = "Response blocked by safety settings.";
    hint = "Please adjust your prompt and try again.";
  } else if (errMsg.includes("timeout") || errMsg.includes("network")) {
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

// server/ai/modes.ts
function classifyMode(prompt, mode) {
  if (mode && mode !== "auto") return mode;
  const lower = prompt.toLowerCase();
  if (lower.includes("\u0D85\u0DAF \u0DB8\u0DDC\u0DB1\u0DC0\u0DAF") || lower.includes("today plan") || lower.includes("remaining hours") || lower.includes("\u0DAF\u0DD0\u0DB1\u0DCA \u0DB8\u0DDC\u0DB1\u0DC0\u0DAF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DD9")) return "today_plan";
  if (lower.includes("plan") || lower.includes("schedule") || lower.includes("calendar") || lower.includes("finish syllabus") || lower.includes("days left")) return "study_plan";
  if (lower.includes("\u0D87\u0DBA\u0DD2") || lower.includes("\u0D9A\u0DDC\u0DC4\u0DDC\u0DB8\u0DAF") || lower.includes("explain") || lower.includes("formula") || lower.includes("concept")) return "tutor_explanation";
  if (lower.includes("notes") || lower.includes("short notes") || lower.includes("revision note")) return "notes_generation";
  if (lower.includes("quiz") || lower.includes("mcq") || lower.includes("test") || lower.includes("questions")) return "quiz_generation";
  if (lower.includes("past paper") || lower.includes("marking scheme") || lower.includes("pdf") || lower.includes("download") || lower.includes("link")) return "past_paper_search";
  if (lower.includes("frequency") || lower.includes("prediction") || lower.includes("repeated") || lower.includes("trend") || lower.includes("probability")) return "past_paper_analysis";
  if (lower.includes("z-score") || lower.includes("rank") || lower.includes("campus") || lower.includes("marks target")) return "zscore_prediction";
  if (lower.includes("diagram") || lower.includes("image") || lower.includes("visual") || lower.includes("draw") || lower.includes("circuit")) return "image_generation";
  return "general_chat";
}
function requiresGoogleSearch(mode, prompt) {
  if (mode === "past_paper_search") return true;
  const lower = prompt.toLowerCase();
  const triggers = ["latest", "link", "pdf", "download", "past paper", "marking scheme", "syllabus", "web", "verify", "current info", "\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB", "\u0DBD\u0DD2\u0DB1\u0DCA\u0D9A\u0DCA", "\u0DB1\u0DC0\u0DAD\u0DB8", "\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB4\u0DAD\u0DCA\u200D\u0DBB\u0DBA"];
  return triggers.some((t) => lower.includes(t));
}

// server/ai/respond.ts
init_prompts();
init_userContext();

// server/rag/retrieve.ts
init_admin();

// server/rag/chunker.ts
function extractKeywords(text) {
  const words = text.toLowerCase().split(/[\\s\\.,\\-\\?!\\(\\)"']+/);
  const stops = /* @__PURE__ */ new Set(["the", "is", "in", "at", "of", "on", "and", "a", "to", "it", "for", "as", "with", "this", "that", "by", "an", "be", "from", "or", "are", "was", "will", "can", "not", "have", "has", "but", "all", "if", "we", "you", "they", "what", "which", "who", "when", "where", "how"]);
  const kw = /* @__PURE__ */ new Set();
  words.forEach((w) => {
    if (w.length > 3 && !stops.has(w)) kw.add(w);
  });
  return Array.from(kw);
}

// server/rag/retrieve.ts
init_syllabus();
async function retrieveRelevantKnowledge2(params) {
  const { prompt, activeSubject, mode, limit = 6, uid } = params;
  const db = getAdminDb();
  const chunksResult = [];
  const lowerPrompt = prompt.toLowerCase();
  let detectedSubject = activeSubject;
  if (lowerPrompt.includes("sft") || lowerPrompt.includes("science for technology") || lowerPrompt.includes("\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0")) detectedSubject = "sft";
  else if (lowerPrompt.includes("et") || lowerPrompt.includes("engineering technology") || lowerPrompt.includes("\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA")) detectedSubject = "et";
  else if (lowerPrompt.includes("ict") || lowerPrompt.includes("information technology") || lowerPrompt.includes("\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA")) detectedSubject = "ict";
  let yearMatch = prompt.match(/\b(201[0-9]|202[0-9]|203[0-9])\b/);
  const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
  let queryKeywords = extractKeywords(prompt).slice(0, 10);
  try {
    let query = db.collection("rag_chunks");
    if (detectedSubject && detectedSubject !== "general") {
      query = query.where("subject", "==", detectedSubject);
    }
    if (detectedYear) {
      const exactYearQuery = query.where("year", "==", detectedYear).limit(limit * 3);
      const yearSnap = await exactYearQuery.get();
      yearSnap.forEach((doc) => chunksResult.push(doc.data()));
    }
    if (chunksResult.length < limit && queryKeywords.length > 0) {
      const keywordQuery = query.where("keywords", "array-contains-any", queryKeywords).limit(limit * 3);
      const kwSnap = await keywordQuery.get();
      kwSnap.forEach((doc) => {
        const chunk = doc.data();
        if (!chunksResult.find((c) => c.id === chunk.id)) {
          chunksResult.push(chunk);
        }
      });
    }
  } catch (error) {
    console.warn("RAG Firestore query failed", error);
  }
  if (chunksResult.length === 0 && detectedSubject && detectedSubject !== "general") {
    console.warn("RAG_FIRESTORE_EMPTY_USING_SYLLABUS_FALLBACK");
    const syllabus = SYLLABUS[detectedSubject.toLowerCase()];
    if (syllabus) {
      const searchItems = [
        ...syllabus.mcqItems || [],
        ...syllabus.partAItems || [],
        ...syllabus.partBCDItems || []
      ];
      searchItems.forEach((item) => {
        const lessonTitle = item.title.toLowerCase();
        let confidence = 0;
        if (lowerPrompt.includes(lessonTitle)) confidence += 0.8;
        else {
          const words = lessonTitle.split(" ");
          let matchCount = 0;
          words.forEach((w) => {
            if (w.length > 2 && lowerPrompt.includes(w)) matchCount++;
          });
          if (matchCount > 0) confidence += matchCount / words.length * 0.5;
        }
        if (confidence > 0) {
          chunksResult.push({
            id: "fallback_" + Math.random(),
            sourceId: "fallback_syllabus",
            subject: detectedSubject,
            lesson: item.title,
            sourceType: "syllabus",
            text: `Lesson: ${item.title}. Question weight: ${item.count} questions. Type: ${item.q.includes("Q") ? "MCQ" : "Structured/Essay"}.`,
            normalizedText: "",
            keywords: [],
            tokenEstimate: 20,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      });
    }
  }
  const scoredChunks = chunksResult.map((c) => {
    let score = 0.5;
    const chunkLower = c.normalizedText || c.text.toLowerCase();
    if (detectedSubject && c.subject === detectedSubject) score += 0.2;
    if (detectedYear && c.year === detectedYear) score += 0.4;
    let kwMatch = 0;
    queryKeywords.forEach((kw) => {
      if (c.keywords?.includes(kw)) kwMatch++;
      else if (chunkLower.includes(kw)) kwMatch += 0.5;
    });
    if (queryKeywords.length > 0) {
      score += kwMatch / queryKeywords.length * 0.4;
    }
    return { ...c, __score: score };
  });
  scoredChunks.sort((a, b) => b.__score - a.__score);
  const uniqueSources = /* @__PURE__ */ new Map();
  const finalChunks = [];
  for (const c of scoredChunks.slice(0, limit)) {
    let sourceMeta = { title: "Knowledge Base", sourceType: c.sourceType };
    if (!c.id.startsWith("fallback_")) {
      if (!uniqueSources.has(c.sourceId)) {
        let sourceDoc = { exists: false };
        try {
          sourceDoc = await db.collection("rag_sources").doc(c.sourceId).get();
        } catch (e) {
          console.warn("Failed to get sourceDoc", e);
        }
        if (sourceDoc.exists) {
          uniqueSources.set(c.sourceId, sourceDoc.data());
        }
      }
      sourceMeta = uniqueSources.get(c.sourceId) || sourceMeta;
    } else {
      sourceMeta = { title: "A/L Syllabus Details", sourceType: "syllabus" };
    }
    finalChunks.push({
      id: c.id,
      subject: c.subject,
      lesson: c.lesson,
      sourceType: c.sourceType,
      title: sourceMeta.title,
      text: c.text,
      year: c.year,
      confidence: Math.min(1, c.__score),
      citationLabel: `[${sourceMeta.title}${c.year ? ` ${c.year}` : ""}]`
    });
  }
  return finalChunks;
}

// server/ai/respond.ts
init_admin();
async function processAIRequest(req) {
  try {
    const { prompt, activeSubject, explicitMode, history, model: requestedModel } = req.body;
    const uid = req.user.uid;
    if (!prompt) throw new Error("Prompt is required");
    const contextData = await loadUserAIContext(uid, req.user?.email);
    const mode = classifyMode(prompt, explicitMode);
    const knowledgeChunks = await retrieveRelevantKnowledge2({ prompt, activeSubject, mode });
    const useSearch = requiresGoogleSearch(mode, prompt);
    const systemInstruction = getCloraSystemPrompt(contextData, mode);
    let finalPrompt = prompt;
    if (knowledgeChunks && knowledgeChunks.length > 0) {
      finalPrompt += `

Reference Sources:
${JSON.stringify(knowledgeChunks)}`;
    }
    let preferredModel = AI_MODELS.default;
    let temp = 0.35;
    if (mode === "today_plan" || mode === "study_plan") {
      preferredModel = AI_MODELS.default;
      temp = 0.25;
    } else if (mode === "past_paper_analysis" || mode === "zscore_prediction") {
      preferredModel = AI_MODELS.pro;
      temp = 0.2;
    }
    if (requestedModel) {
      preferredModel = requestedModel;
    }
    const modelChain = getModelFallbackChain(preferredModel);
    const ai9 = getAIClient();
    let response = null;
    let modelUsed = "";
    let lastError3 = null;
    let promptWithHistory = finalPrompt;
    if (history && history.length > 0) {
      promptWithHistory = `Previous Chat History:
${JSON.stringify(history.map((h) => ({ role: h.role, text: h.content || h.text })))}

Current User Request:
${finalPrompt}`;
    }
    for (const m of modelChain) {
      try {
        modelUsed = m;
        const chat = ai9.chats.create({
          model: m,
          config: {
            systemInstruction,
            temperature: temp,
            tools: useSearch ? [{ googleSearch: {} }] : void 0
          }
        });
        response = await chat.sendMessage({ message: promptWithHistory });
        break;
      } catch (err) {
        lastError3 = err;
        console.warn(`Model ${m} failed/unavailable, trying fallback if possible. Error:`, err.message || err);
        continue;
      }
    }
    if (!response) {
      throw lastError3 || new Error("All model options in the fallback chain failed.");
    }
    saveChatToHistory(uid, prompt, response.text || "", mode, activeSubject);
    return {
      ok: true,
      text: response.text || "No response generated.",
      response: response.text || "No response generated.",
      mode,
      model: modelUsed,
      sources: knowledgeChunks,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (error) {
    console.error("AI Request Failed:", error);
    return classifyAIError(error);
  }
}
async function saveChatToHistory(uid, prompt, response, mode, subject) {
  try {
    const db = getAdminDb();
    const batch = db.batch();
    const userRef = db.collection("users").doc(uid);
    const historyRef = userRef.collection("chat_history");
    const userMsgRef = historyRef.doc();
    batch.set(userMsgRef, {
      role: "user",
      text: prompt,
      mode,
      subject: subject || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const aiMsgRef = historyRef.doc();
    batch.set(aiMsgRef, {
      role: "assistant",
      text: response,
      mode,
      subject: subject || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await batch.commit();
  } catch (e) {
    console.error("Failed to save chat history", e);
  }
}

// server/ai/routes.ts
init_client();
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
init_modelRouter();
init_cancellation();
var aiRoutes = (0, import_express.Router)();
aiRoutes.get("/client-diagnostics", (req, res) => {
  const deployTarget = process.env.APP_DEPLOY_TARGET || "cloud_run";
  const useVertex = String(process.env.GEMINI_USE_VERTEX || "").toLowerCase() === "true";
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const hasServiceAccountJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasGeminiApiKey = !!process.env.GEMINI_API_KEY;
  res.json({
    mode: useVertex ? "vertex" : "api_key",
    deployTarget,
    project,
    location,
    geminiUseVertex: useVertex,
    hasServiceAccountJson,
    hasGeminiApiKey,
    apiKeyIgnored: useVertex,
    models: {
      normalChat: process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash",
      pdfQa: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash",
      final: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview"
    }
  });
});
aiRoutes.get("/debug-knowledge", async (req, res) => {
  try {
    const { routeKnowledgeRequest: routeKnowledgeRequest2 } = await Promise.resolve().then(() => (init_knowledgeRouter(), knowledgeRouter_exports));
    const route = await routeKnowledgeRequest2({
      prompt: req.query.q || "2025 sft paper"
    });
    res.json({
      ok: true,
      query: req.query.q,
      parsedIntent: route.mode,
      entities: route.entities,
      hints: route.answerHints
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.get("/self-test", async (req, res) => {
  try {
    prepareGoogleCredentials();
    const ai9 = getAIClient();
    const model = process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash";
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const response = await ai9.models.generateContent({
      model,
      contents: "Reply only OK"
    });
    setLastOk(true, null);
    res.json({
      ok: true,
      authPath: "vertex-ai-adc",
      project,
      location,
      model,
      text: response.text ? response.text.trim() : "OK"
    });
  } catch (error) {
    const errorMsg = String(error.message || error);
    setLastOk(false, errorMsg);
    if (errorMsg.toLowerCase().includes("prepayment credits are depleted") || errorMsg.toLowerCase().includes("prepayment")) {
      return res.json({
        ok: false,
        authPath: "api-key-prepay-path-detected",
        code: "WRONG_AI_AUTH_PATH",
        message: "This request is still using Gemini Developer API / AI Studio Prepay path, not Vertex AI."
      });
    }
    res.status(500).json({ ok: false, error: errorMsg });
  }
});
var cachedHealthResponse = null;
var cachedHealthTime = 0;
var CACHE_TTL_MS2 = 45e3;
aiRoutes.get(["/health", "/model-health", "/model-healt", "/api/health"], async (req, res) => {
  const now = Date.now();
  if (cachedHealthResponse && now - cachedHealthTime < CACHE_TTL_MS2) {
    return res.json(cachedHealthResponse);
  }
  const errors2 = [];
  let dbInfo = {};
  const tests = {
    adminInitialized: false,
    canWriteHealthDoc: false,
    canReadHealthDoc: false,
    canQueryRagSources: false,
    canQueryPastPapers: false,
    canSaveChat: false,
    canUploadStorage: false,
    canGenerateSignedUrl: false
  };
  const { getAdminDbInfo: getAdminDbInfo3, getAdminDb: getAdminDb2, getAdminBucket: getAdminBucket2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
  const { retryGoogleAuthOperation: retryGoogleAuthOperation2 } = await Promise.resolve().then(() => (init_retry(), retry_exports));
  try {
    dbInfo = getAdminDbInfo3();
    tests.adminInitialized = true;
  } catch (err) {
    errors2.push({
      test: "adminInitialized",
      code: err.code || "ADMIN_INIT_FAILED",
      message: err.message,
      hint: "Check environment variables and credentials JSON."
    });
  }
  let db = null;
  if (tests.adminInitialized) {
    const usesApplicationDefault = dbInfo.credentialMode === "application_default";
    const runsOnGoogleInfrastructure = Boolean(
      process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GAE_SERVICE
    );
    if (usesApplicationDefault && !runsOnGoogleInfrastructure) {
      errors2.push({
        test: "getAdminDb",
        code: "GOOGLE_CREDENTIALS_NOT_CONFIGURED",
        message: "Google service-account credentials are not configured.",
        hint: "Set GOOGLE_APPLICATION_CREDENTIALS_JSON to the complete service-account JSON."
      });
    } else {
      try {
        db = getAdminDb2();
      } catch (err) {
        errors2.push({
          test: "getAdminDb",
          code: "FIRESTORE_GET_DB_FAILED",
          message: err.message,
          hint: err.message.includes("CONFIG_ERROR_FIRESTORE_DATABASE_ID_MISSING") ? "FIRESTORE_DATABASE_ID environment variable is missing." : "Firestore database retrieval failed."
        });
      }
    }
  }
  if (db) {
    try {
      await db.collection("_health").doc("admin").set({ serverTime: (/* @__PURE__ */ new Date()).toISOString() });
      tests.canWriteHealthDoc = true;
    } catch (err) {
      const msg = String(err.message || err);
      const isPermission = msg.includes("PERMISSION_DENIED") || err.code === 7;
      errors2.push({
        test: "canWriteHealthDoc",
        code: isPermission ? "IAM_PERMISSION_DENIED" : "WRITE_HEALTH_DOC_FAILED",
        message: err.message,
        hint: isPermission ? `Grant Cloud Datastore User or Cloud Datastore Owner to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.` : "Unknown error writing to _health collection."
      });
    }
  }
  if (db && tests.canWriteHealthDoc) {
    try {
      const snap = await db.collection("_health").doc("admin").get();
      tests.canReadHealthDoc = snap.exists;
    } catch (err) {
      errors2.push({
        test: "canReadHealthDoc",
        code: "READ_HEALTH_DOC_FAILED",
        message: err.message
      });
    }
  }
  if (db) {
    try {
      await db.collection("rag_sources").limit(1).get();
      tests.canQueryRagSources = true;
    } catch (err) {
      const msg = String(err.message || err);
      const isPermission = msg.includes("PERMISSION_DENIED") || err.code === 7;
      errors2.push({
        test: "canQueryRagSources",
        code: isPermission ? "IAM_PERMISSION_DENIED" : "QUERY_RAG_SOURCES_FAILED",
        message: err.message,
        hint: isPermission ? `Grant Cloud Datastore User or Cloud Datastore Owner to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.` : "Unknown error querying rag_sources."
      });
    }
  }
  if (db) {
    try {
      await db.collection("past_papers").limit(1).get();
      tests.canQueryPastPapers = true;
    } catch (err) {
      const msg = String(err.message || err);
      const isPermission = msg.includes("PERMISSION_DENIED") || err.code === 7;
      errors2.push({
        test: "canQueryPastPapers",
        code: isPermission ? "IAM_PERMISSION_DENIED" : "QUERY_PAST_PAPERS_FAILED",
        message: err.message,
        hint: isPermission ? `Grant Cloud Datastore User or Cloud Datastore Owner to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.` : "Unknown error querying past_papers."
      });
    }
  }
  if (db) {
    try {
      await db.collection("_health_chat").doc("test_chat").set({
        message: "Health check save",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      tests.canSaveChat = true;
    } catch (err) {
      errors2.push({
        test: "canSaveChat",
        code: "SAVE_CHAT_FAILED",
        message: err.message
      });
    }
  }
  const FORCE_CLIENT_STORAGE = true;
  if (FORCE_CLIENT_STORAGE) {
    tests.canUploadStorage = false;
    tests.canGenerateSignedUrl = false;
  } else {
    let bucket = null;
    if (tests.adminInitialized) {
      try {
        bucket = getAdminBucket2();
      } catch (err) {
        errors2.push({
          test: "getAdminBucket",
          code: "STORAGE_BUCKET_GET_FAILED",
          message: err.message,
          hint: "Check if storageBucket config or FIREBASE_STORAGE_BUCKET is correct."
        });
      }
    }
    if (bucket) {
      const fileRef = bucket.file("_health/admin-health.txt");
      try {
        await retryGoogleAuthOperation2("canUploadStorage", async () => {
          await fileRef.save("Health check content", {
            resumable: false,
            contentType: "text/plain",
            metadata: {
              cacheControl: "private, max-age=0"
            }
          });
        });
        tests.canUploadStorage = true;
      } catch (err) {
        const msg = String(err.message || err);
        const isPermission = msg.includes("permission") || err.code === 403;
        errors2.push({
          test: "canUploadStorage",
          code: isPermission ? "STORAGE_PERMISSION_DENIED" : "UPLOAD_STORAGE_FAILED",
          message: err.message,
          hint: isPermission ? `Grant Storage Object Admin to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.` : "Google auth token premature close or generic upload failure. Check credentials and retry."
        });
      }
      if (tests.canUploadStorage) {
        try {
          await retryGoogleAuthOperation2("canGenerateSignedUrl", async () => {
            await fileRef.getSignedUrl({
              action: "read",
              expires: Date.now() + 15 * 60 * 1e3
              // 15 mins
            });
          });
          tests.canGenerateSignedUrl = true;
        } catch (err) {
          errors2.push({
            test: "canGenerateSignedUrl",
            code: "GENERATE_SIGNED_URL_FAILED",
            message: err.message,
            hint: "Ensure the Service Account has the Service Account Token Creator role on itself or project."
          });
        }
        try {
          await fileRef.delete();
        } catch (e) {
        }
      }
    }
  }
  const firestoreOk = tests.adminInitialized && tests.canWriteHealthDoc && tests.canReadHealthDoc && tests.canQueryRagSources && tests.canQueryPastPapers && tests.canSaveChat;
  const storageOk = tests.canUploadStorage && tests.canGenerateSignedUrl;
  const ok = firestoreOk;
  let ocrAvailable = false;
  let ocrLastError = null;
  const isOcrEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true";
  const ocrInputBucket = process.env.VISION_OCR_INPUT_BUCKET || "al-ai-chat-ocr-input";
  const ocrOutputBucket = process.env.VISION_OCR_OUTPUT_BUCKET || "al-ai-chat-ocr-output";
  if (isOcrEnabled) {
    try {
      const { ImageAnnotatorClient: ImageAnnotatorClient2 } = await import("@google-cloud/vision");
      const client2 = new ImageAnnotatorClient2();
      const storage = getAdminStorage();
      const inBucket = storage.bucket(ocrInputBucket);
      const outBucket = storage.bucket(ocrOutputBucket);
      const [inExists] = await inBucket.exists();
      const [outExists] = await outBucket.exists();
      if (inExists && outExists) {
        ocrAvailable = true;
      } else {
        ocrLastError = `Bucket existence check: inputBucket(${ocrInputBucket}): ${inExists}, outputBucket(${ocrOutputBucket}): ${outExists}`;
      }
    } catch (err) {
      ocrLastError = err.message;
    }
  }
  const responsePayload = {
    ok,
    projectId: dbInfo.projectId || "al-ai-chat",
    firestoreDatabaseId: dbInfo.databaseId || "(default)",
    storageBucket: dbInfo.storageBucket || "al-ai-chat.firebasestorage.app",
    credentialMode: dbInfo.credentialMode || "not_initialized",
    credentialsEmail: dbInfo.credentialsEmail || "unknown",
    hasPrivateKey: dbInfo.hasPrivateKey === true,
    tests,
    errors: errors2,
    ocr: {
      enabled: isOcrEnabled,
      provider: "cloud_vision",
      inputBucket: ocrInputBucket,
      outputBucket: ocrOutputBucket,
      available: ocrAvailable,
      lastError: ocrLastError
    },
    recommendedUploadMode: FORCE_CLIENT_STORAGE ? "client_firebase_storage" : storageOk ? "backend_multer" : "client_firebase_storage",
    requiredIamRoles: [
      "Cloud Datastore User",
      "Cloud Datastore Owner",
      "Storage Object Admin",
      "Vertex AI User"
    ],
    aiCore: {
      version: "evidence-first-v1",
      parser: true,
      sourceLock: true,
      evidenceGate: true,
      answerVerifier: true,
      verifiedAnswers: true,
      wrongFeedback: true
    },
    directPdfQa: {
      enabled: process.env.ENABLE_DIRECT_PDF_QA !== "false",
      mode: "frontend_blob_to_gemini",
      requiresGcs: false,
      available: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      model: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"
    }
  };
  if (FORCE_CLIENT_STORAGE) {
    responsePayload.storageMode = {
      recommendedUploadMode: "client_firebase_storage",
      tests: {
        canUploadStorage: false,
        canGenerateSignedUrl: false,
        skippedAdminStorageTests: true,
        reason: "client_firebase_storage_forced"
      }
    };
  } else if (firestoreOk && !storageOk) {
    responsePayload.degraded = true;
    responsePayload.storageMode = {
      adminStorageAvailable: false,
      clientStorageFallbackEnabled: true,
      recommendedUploadMode: "client_firebase_storage"
    };
  }
  const { getRealtimeConfig: getRealtimeConfig2 } = await Promise.resolve().then(() => (init_config(), config_exports));
  const realtimeCfg = getRealtimeConfig2();
  responsePayload.directPdfQa = { mode: "frontend_blob_to_gemini", requiresGcs: false, available: true };
  responsePayload.tts = {
    enabled: process.env.ENABLE_TTS === "true",
    available: process.env.ENABLE_TTS === "true" && !!dbInfo.projectId,
    provider: process.env.TTS_PROVIDER || "google_cloud",
    lastError: null
  };
  responsePayload.realtime = {
    enabled: realtimeCfg.enabled,
    provider: realtimeCfg.provider,
    available: realtimeCfg.available,
    model: realtimeCfg.model,
    missing: realtimeCfg.missing,
    authMode: realtimeCfg.authMode
  };
  responsePayload.models = {
    final: { configured: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview", lastOk: true, lastError: null },
    fast: { configured: process.env.GEMINI_DEFAULT_MODEL || "gemini-3-flash-preview", lastOk: true, lastError: null },
    lite: { configured: process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite", lastOk: true, lastError: null },
    embeddings: { configured: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001", lastOk: true, lastError: null },
    image: { enabled: process.env.ENABLE_IMAGE_GENERATION === "true", available: !!process.env.GEMINI_IMAGE_MODEL, lastError: null }
  };
  cachedHealthResponse = responsePayload;
  cachedHealthTime = now;
  res.json(responsePayload);
});
aiRoutes.post("/debug-context", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { loadUserAIContext: loadUserAIContext2 } = await Promise.resolve().then(() => (init_userContext(), userContext_exports));
    const context = await loadUserAIContext2(user.uid, user.email);
    let databaseId2 = process.env.FIRESTORE_DATABASE_ID;
    if (!databaseId2) {
      try {
        const configPath = import_node_path2.default.join(process.cwd(), "firebase-applet-config.json");
        const config = JSON.parse(import_node_fs2.default.readFileSync(configPath, "utf-8"));
        databaseId2 = config.firestoreDatabaseId;
      } catch (e) {
      }
    }
    res.json({
      ok: true,
      uid: user.uid,
      emailMasked: (user.email || "").replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      loadedProfileFields: Object.keys(context.profile || {}),
      progressCount: context.recentProgress?.length || 0,
      weakLessonsCount: context.weakLessons?.length || 0,
      latestMarksCount: context.latestMarks?.length || 0,
      subjectCompletion: context.recentProgress?.map((p) => ({ subject: p.subject, percent: p.coveragePercent, completed: p.completedTopics, total: p.totalTopics })) || [],
      selectedMode: req.body.mode || "auto",
      dbProject: process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "al-ai-chat",
      firestoreDatabaseId: databaseId2 || "(default)",
      loadedFrom: context.loadedFrom || "unknown"
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/requests/:requestId/cancel", async (req, res) => {
  try {
    const user = await requireUser(req);
    cancelRequest(req.params.requestId);
    res.json({ ok: true, cancelled: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
aiRoutes.post("/respond-stream", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    await aiRespondStream(req, res);
  } catch (error) {
    const unauthorized = String(error?.message || "").startsWith("Unauthorized:");
    res.status(unauthorized ? 401 : 500).json({
      ok: false,
      error: unauthorized ? "AUTH_REQUIRED" : error.message,
      message: error.message
    });
  }
});
aiRoutes.post("/continue", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    await aiContinueStream(req, res);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.get("/stream-debug-last", async (req, res) => {
  try {
    const user = await requireUser(req);
    res.json(lastStreamTraces);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/respond", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    if (req.body.mode === "image_generation") {
      const { generateEducationalImage: generateEducationalImage2 } = await Promise.resolve().then(() => (init_generate(), generate_exports));
      const result2 = await generateEducationalImage2(req);
      if (!result2.ok) res.status(500).json(result2);
      else res.json(result2);
      return;
    }
    const result = await processAIRequest(req);
    if (!result.ok) {
      res.status(result.code === "QUOTA_EXCEEDED" ? 429 : 500).json(result);
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/chat", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/gemini-chat", async (req, res) => {
  try {
    const user = await requireUser(req).catch(() => {
      if (process.env.DEV_BYPASS_AUTH === "true") {
        return { uid: "dev-user-id", email: "dev@example.com", name: "Dev User" };
      }
      throw new Error("Unauthorized");
    });
    req.user = user;
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/notebook-quiz", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    req.body.mode = "quiz_generation";
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.get("/chat-history", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const userUidRef = db.collection("users").doc(user.uid);
    const [uidSnap, emailSnap] = await Promise.all([
      userUidRef.collection("chat_history").orderBy("createdAt", "asc").limit(100).get().catch(() => ({ docs: [] })),
      user.email ? db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").orderBy("createdAt", "asc").limit(100).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);
    const docs = [...uidSnap.docs, ...emailSnap.docs];
    const chatHistory = Array.from(new Map(docs.map((d) => [d.id, { id: d.id, ...d.data() }])).values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json({ ok: true, chatHistory });
  } catch (error) {
    console.error("[CHAT_HISTORY_FAILED]", error);
    return res.status(200).json({
      ok: false,
      chatHistory: [],
      errorCode: "CHAT_HISTORY_FAILED"
    });
  }
});
aiRoutes.post("/chat-history", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { role, text, mode, subject } = req.body;
    if (!role || !text) {
      return res.status(400).json({ ok: false, error: "Role and text are required" });
    }
    const db = getAdminDb();
    const userUidRef = db.collection("users").doc(user.uid);
    const docRef = userUidRef.collection("chat_history").doc();
    const messageData = {
      role,
      text,
      mode: mode || "auto",
      subject: subject || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await docRef.set(messageData);
    if (user.email) {
      await db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").doc(docRef.id).set(messageData).catch(() => null);
    }
    res.json({ ok: true, id: docRef.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/chat-history/clear", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const batch = db.batch();
    let opCount = 0;
    const uidSnap = await db.collection("users").doc(user.uid).collection("chat_history").get().catch(() => ({ docs: [] }));
    uidSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      opCount++;
    });
    if (user.email) {
      const emailSnap = await db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").get().catch(() => ({ docs: [] }));
      emailSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        opCount++;
      });
    }
    const chatCtxRef = db.collection("users").doc(user.uid).collection("chat_context").doc("current");
    batch.delete(chatCtxRef);
    opCount++;
    await batch.commit();
    res.json({ ok: true, clearedCount: opCount });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/image/generate", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    const { generateEducationalImage: generateEducationalImage2 } = await Promise.resolve().then(() => (init_generate(), generate_exports));
    const result = await generateEducationalImage2(req);
    if (!result.ok) {
      res.status(500).json(result);
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/ai/image", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    const { generateEducationalImage: generateEducationalImage2 } = await Promise.resolve().then(() => (init_generate(), generate_exports));
    const result = await generateEducationalImage2(req);
    if (!result.ok) {
      res.status(500).json(result);
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/answer-from-direct-pdf-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { answer, source, prompt, mode, subject } = req.body;
    if (!answer || !prompt) {
      return res.status(400).json({ ok: false, error: "Missing answer or prompt." });
    }
    const { saveFinalChat: saveFinalChat2 } = await Promise.resolve().then(() => (init_respondStream(), respondStream_exports));
    const chatRes = await saveFinalChat2({
      uid: user.uid,
      email: user.email,
      userText: prompt,
      assistantText: answer,
      mode: mode || "auto",
      subject: subject || null,
      sources: source ? [source] : []
    });
    res.json({
      ok: true,
      chatSaved: chatRes.chatSaved,
      messageId: chatRes.messageId
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/feedback/wrong-answer", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { sourceId, questionType, questionNo, reason } = req.body;
    if (!sourceId || !questionNo) {
      return res.status(400).json({ ok: false, error: "Missing sourceId or questionNo." });
    }
    const { handleWrongAnswerFeedback: handleWrongAnswerFeedback2 } = await Promise.resolve().then(() => (init_wrongAnswerHandler(), wrongAnswerHandler_exports));
    const result = await handleWrongAnswerFeedback2({
      uid: user.uid,
      sourceId,
      questionType,
      questionNo,
      reason
    });
    res.json(result);
  } catch (error) {
    console.error("[AI_ROUTES] feedback/wrong-answer error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/past-papers/search", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    const { searchPastPapers: searchPastPapers2 } = await Promise.resolve().then(() => (init_search(), search_exports));
    await searchPastPapers2(req, res);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/web/pdf-proxy", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ ok: false, error: "URL is required" });
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return res.status(400).json({ ok: false, error: "Only secure HTTPS URLs are allowed" });
      }
      const host = parsed.hostname.toLowerCase();
      const isPrivate = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.") || host.startsWith("172.16.") || host.startsWith("172.17.") || host.startsWith("172.18.") || host.startsWith("172.19.") || host.startsWith("172.20.") || host.startsWith("172.21.") || host.startsWith("172.22.") || host.startsWith("172.23.") || host.startsWith("172.24.") || host.startsWith("172.25.") || host.startsWith("172.26.") || host.startsWith("172.27.") || host.startsWith("172.28.") || host.startsWith("172.29.") || host.startsWith("172.30.") || host.startsWith("172.31.");
      if (isPrivate) {
        return res.status(400).json({ ok: false, error: "Access to private resources is forbidden" });
      }
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid URL format" });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25e3);
    const fetchResponse = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeoutId);
    if (!fetchResponse.ok) {
      return res.status(502).json({ ok: false, error: `Failed to fetch target URL. Status: ${fetchResponse.status}` });
    }
    const contentType = fetchResponse.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("pdf") && !contentType.toLowerCase().includes("octet-stream") && !contentType.toLowerCase().includes("application/")) {
      return res.status(400).json({ ok: false, error: "Target URL does not appear to point to a valid document file" });
    }
    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: "File exceeds safe size limit of 50MB" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="proxied_document.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error("PDF proxy failed:", error);
    res.status(500).json({ ok: false, error: error.message || "Fetch timeout or network issue" });
  }
});

// server/rag/routes.ts
init_client();
var import_express2 = require("express");
var import_genai3 = require("@google/genai");

// server/firebase/authMiddleware.ts
init_admin();
init_configuredRoles();
async function verifyAndExtractUser(req) {
  if (req.query && (req.query.token || req.query.auth || req.query.access_token)) {
    const err = new Error("Authentication tokens must be sent in the Authorization header.");
    err.code = "QUERY_TOKEN_NOT_ALLOWED";
    throw err;
  }
  const authHeader = req.headers.authorization;
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    const devUser = {
      uid: "dev-user-id",
      email: "dev@example.com",
      emailVerified: true,
      isAnonymous: false,
      name: "Dev User",
      admin: true,
      roles: ["admin"]
    };
    const authContext = {
      uid: devUser.uid,
      email: devUser.email,
      roles: ["admin"],
      isAnonymous: false
    };
    return { ...devUser, authContext };
  }
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1];
  }
  if (!token) {
    return null;
  }
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const isAnonymous = decodedToken.firebase?.sign_in_provider === "anonymous";
    let admin = decodedToken.admin || false;
    let roles = ["student"];
    if (admin) {
      roles.push("admin", "reviewer", "ops");
    }
    if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
      roles = [.../* @__PURE__ */ new Set([...roles, ...decodedToken.roles])];
    }
    if (decodedToken.role && typeof decodedToken.role === "string") {
      roles.push(decodedToken.role);
    }
    try {
      const db = getAdminDb();
      const roleDoc = await db.collection("user_roles").doc(decodedToken.uid).get();
      if (roleDoc.exists) {
        const data = roleDoc.data();
        if (data?.roles && Array.isArray(data.roles)) {
          roles = [.../* @__PURE__ */ new Set([...roles, ...data.roles])];
        }
        if (data?.role && typeof data.role === "string") {
          roles.push(data.role);
        }
      }
    } catch (e) {
    }
    roles = applyConfiguredAdminRoles(
      decodedToken.email,
      decodedToken.email_verified === true,
      roles,
      decodedToken.uid
    );
    if (roles.includes("admin")) {
      admin = true;
    }
    const rolesTyped = roles.filter((r) => ["student", "teacher", "content_editor", "reviewer", "ops", "admin"].includes(r));
    const authContext = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      roles: rolesTyped.length > 0 ? rolesTyped : ["student"],
      isAnonymous,
      tokenIssuedAt: decodedToken.iat,
      authTime: decodedToken.auth_time
    };
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      isAnonymous,
      name: decodedToken.name || decodedToken.email?.split("@")[0] || "User",
      admin,
      roles: [...new Set(roles)],
      authContext
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
async function requireFirebaseUser(req, res, next) {
  try {
    const user = await verifyAndExtractUser(req);
    if (!user) {
      return res.status(401).json({
        ok: false,
        code: "LOGIN_REQUIRED",
        message: "This operation requires a logged-in session."
      });
    }
    req.user = user;
    req.authContext = user.authContext;
    next();
  } catch (err) {
    if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
      return res.status(400).json({
        ok: false,
        code: "QUERY_TOKEN_NOT_ALLOWED",
        message: err.message
      });
    }
    res.status(401).json({ ok: false, error: err.message });
  }
}
async function requireNonAnonymousUser(req, res, next) {
  try {
    const user = await verifyAndExtractUser(req);
    if (!user || user.isAnonymous) {
      return res.status(401).json({
        ok: false,
        code: "AUTHENTICATED_USER_REQUIRED",
        message: "\u0DB8\u0DD9\u0DB8 \u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0DC0 \u0DC3\u0DD2\u0DAF\u0DD4 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8 \u0DC3\u0DB3\u0DC4\u0DCF \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0D94\u0DB6\u0D9C\u0DDA \u0D9C\u0DD2\u0DAB\u0DD4\u0DB8\u0DA7 \u0DBD\u0DDC\u0D9C\u0DCA \u0DC0\u0DB1\u0DCA\u0DB1. (Sign-in required)"
      });
    }
    req.user = user;
    req.authContext = user.authContext;
    next();
  } catch (err) {
    if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
      return res.status(400).json({
        ok: false,
        code: "QUERY_TOKEN_NOT_ALLOWED",
        message: err.message
      });
    }
    res.status(401).json({ ok: false, error: err.message });
  }
}

// server/rag/routes.ts
init_admin();

// server/pdf/legacySinhala.ts
function detectSinhalaTextEncoding(text) {
  if (!text) {
    return { encoding: "unknown", confidence: 0, reason: "Empty text" };
  }
  const unicodeMatches = text.match(/[\u0D80-\u0DFF]/g);
  const unicodeCount = unicodeMatches ? unicodeMatches.length : 0;
  const legacyPatterns = [
    "LKavdxl",
    "cHd",
    "\xF1",
    "\xFA",
    "Y%",
    "m%",
    "fuu",
    "fyd",
    "iS",
    "wxl",
    "m%Yak",
    "ms<s;=re",
    "fnda",
    ";dlaIK"
  ];
  let legacyHits = 0;
  legacyPatterns.forEach((pat) => {
    const regex = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(regex);
    if (matches) {
      legacyHits += matches.length;
    }
  });
  const totalChars = text.length || 1;
  const unicodeRatio = unicodeCount / totalChars;
  if (unicodeCount > 50 && unicodeRatio > 0.1) {
    return {
      encoding: "unicode_sinhala",
      confidence: 0.95,
      reason: `Found ${unicodeCount} Unicode Sinhala characters (Ratio: ${(unicodeRatio * 100).toFixed(1)}%).`
    };
  }
  if (legacyHits > 5) {
    return {
      encoding: "legacy_fm_abhaya",
      confidence: Math.min(0.9, 0.4 + legacyHits / 20),
      reason: `Found ${legacyHits} common FM-Abhaya legacy font garbage patterns (Unicode count: ${unicodeCount}).`
    };
  }
  if (unicodeCount === 0 && text.match(/[A-Za-z]/)) {
    if (legacyHits > 2 || text.includes("LKavdxl") || text.includes("cHd\xF1;sh") || text.includes(";dlaIK")) {
      return {
        encoding: "legacy_fm_abhaya",
        confidence: 0.8,
        reason: "Specific SFT/ET legacy keywords detected."
      };
    }
    const englishWords = text.match(/\b[A-Za-z]+\b/g);
    const hasEnglish = englishWords && englishWords.length > Math.max(1, totalChars / 20);
    if (hasEnglish) {
      return {
        encoding: "native_english",
        confidence: 0.9,
        reason: "Contains English alphabet letters with no legacy patterns."
      };
    }
    return {
      encoding: "unknown",
      confidence: 0.3,
      reason: "No Unicode Sinhala but contains some alphabet letters; not enough legacy patterns."
    };
  }
  return {
    encoding: "unknown",
    confidence: 0.3,
    reason: "No definitive Sinhala patterns detected."
  };
}
var WORD_REPLACEMENTS = [
  [/LKavdxl/g, "\u0D9B\u0DAB\u0DCA\u0DA9\u0DCF\u0D82\u0D9A"],
  [/cHdñ;sh/g, "\u0DA2\u0DCA\u200D\u0DBA\u0DCF\u0DB8\u0DD2\u0DAD\u0DD2\u0DBA"],
  [/;dlaIK/g, "\u0DAD\u0DCF\u0D9A\u0DCA\u200D\u0DC2\u0DAB"],
  [/ms<s;=re/g, "\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4"],
  [/m%Yak/g, "\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1"],
  [/fuu/g, "\u0DB8\u0DD9\u0DB8"],
  [/fyd/g, "\u0DC4\u0DDD"],
  [/wxlh/g, "\u0D85\u0D82\u0D9A\u0DBA"],
  [/wxl/g, "\u0D85\u0D82\u0D9A"],
  [/Y%/g, "\u0DC1\u0DCA\u200D\u0DBB\u0DD3"],
  [/m%/g, "\u0DB4\u0DCA\u200D\u0DBB"],
  [/úNd/g, "\u0DC0\u0DD2\u0DB7\u0DCF"],
  [/fnda/g, "\u0DB6\u0DDD"],
  [/iS/g, "\u0DC3\u0DD3"]
];
var CHAR_REPLACEMENTS = [
  // Consonants & basic letters
  ["wxl", "\u0D85\u0D82\u0D9A"],
  ["LKv", "\u0D9B\u0DAB\u0DCA\u0DA9"],
  ["w", "\u0D85"],
  ["W", "\u0D86"],
  ["b", "\u0D89"],
  ["B", "\u0D8A"],
  ["t", "\u0D91"],
  ["ta", "\u0D92"],
  ["l", "\u0D9A"],
  ["L", "\u0D9B"],
  ["g", "\u0D9C"],
  ["G", "\u0D9D"],
  ["p", "\u0DA0"],
  ["P", "\u0DA1"],
  ["c", "\u0DA2"],
  ["C", "\u0DA3"],
  ["v", "\u0DA9"],
  ["V", "\u0DAA"],
  ["K", "\u0DAB"],
  [";", "\u0DAD"],
  ["Q", "\u0DAE"],
  ["o", "\u0DAF"],
  ["O", "\u0DB0"],
  ["k", "\u0DB1"],
  ["m", "\u0DB4"],
  ["M", "\u0DB5"],
  ["n", "\u0DB6"],
  ["N", "\u0DB7"],
  ["u", "\u0DB8"],
  ["h", "\u0DBA"],
  ["r", "\u0DBB"],
  ["j", "\u0DC0"],
  ["Y", "\u0DC1"],
  ["I", "\u0DC2"],
  ["i", "\u0DC3"],
  ["y", "\u0DC4"],
  ["<", "\u0DC5"],
  // Vowels
  ["d", "\u0DCF"],
  ["s", "\u0DD2"],
  ["S", "\u0DD3"],
  ["=", "\u0DD4"],
  ["W", "\u0DD6"],
  ["D", "\u0DD8"],
  ["f", "\u0DD9"],
  ["F", "\u0DDA"],
  ["x", "\u0D82"],
  ["a", "\u0DCA"]
];
function normalizeSinhalaExtractedText(rawText) {
  if (!rawText) {
    return {
      rawText: "",
      normalizedText: "",
      textEncoding: "unknown",
      conversionApplied: false,
      conversionConfidence: 0,
      needsLegacyConversion: false,
      warnings: []
    };
  }
  const { encoding, confidence } = detectSinhalaTextEncoding(rawText);
  if (encoding === "unicode_sinhala" || encoding === "native_english") {
    return {
      rawText,
      normalizedText: rawText,
      textEncoding: encoding,
      conversionApplied: false,
      conversionConfidence: 1,
      needsLegacyConversion: false,
      warnings: []
    };
  }
  if (encoding === "legacy_fm_abhaya" || encoding === "legacy_unknown") {
    let converted = rawText;
    WORD_REPLACEMENTS.forEach(([regex, repl]) => {
      converted = converted.replace(regex, repl);
    });
    converted = converted.replace(/f([a-zA-Z;<`\[\]ˆ])(d)?/g, (match, consonant, ra_hida) => {
      let mappedCons = consonant;
      for (const [key, val] of CHAR_REPLACEMENTS) {
        if (key === consonant) {
          mappedCons = val;
          break;
        }
      }
      return mappedCons + (ra_hida ? "\u0DDD" : "\u0DD9");
    });
    converted = converted.replace(/F([a-zA-Z;<`\[\]ˆ])/g, (match, consonant) => {
      let mappedCons = consonant;
      for (const [key, val] of CHAR_REPLACEMENTS) {
        if (key === consonant) {
          mappedCons = val;
          break;
        }
      }
      return mappedCons + "\u0DDA";
    });
    for (const [legacyChar, unicodeChar] of CHAR_REPLACEMENTS) {
      const escaped = legacyChar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      converted = converted.replace(new RegExp(escaped, "g"), unicodeChar);
    }
    converted = converted.replace(/්‍රි/g, "\u0DCA\u200D\u0DBB\u0DD3").replace(/්ා/g, "\u0DCA").replace(/ිි/g, "\u0DD3");
    const postUnicodeMatches = converted.match(/[\u0D80-\u0DFF]/g);
    const postUnicodeCount = postUnicodeMatches ? postUnicodeMatches.length : 0;
    const conversionSuccess = postUnicodeCount > 20;
    return {
      rawText,
      normalizedText: converted,
      textEncoding: encoding,
      conversionApplied: true,
      conversionConfidence: conversionSuccess ? Math.max(0.7, confidence) : 0.4,
      needsLegacyConversion: !conversionSuccess,
      warnings: conversionSuccess ? [] : ["Legacy conversion confidence is low. Manual check recommended."]
    };
  }
  return {
    rawText,
    normalizedText: rawText,
    textEncoding: "unknown",
    conversionApplied: false,
    conversionConfidence: 0,
    needsLegacyConversion: true,
    warnings: ["Could not detect legacy font encoding type."]
  };
}

// server/pdf/extractText.ts
if (typeof globalThis !== "undefined") {
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = class DOMMatrix {
    };
  }
  if (!globalThis.Path2D) {
    globalThis.Path2D = class Path2D {
    };
  }
}
async function extractPdfText(pdfBuffer) {
  let pdfjsLib = null;
  try {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (err) {
    console.error("Failed to load pdfjs-dist:", err.message);
    return {
      text: "",
      pages: [],
      needsOcr: false,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      message: "PDF_PARSER_UNAVAILABLE"
    };
  }
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      disableFontFace: true,
      verbosity: 0
    });
    const pdf = await loadingTask.promise;
    let fullText = "";
    const pages = [];
    let overallNeedsLegacy = false;
    let dominantEncoding = "unknown";
    let legacyEncodingsCount = 0;
    let unicodeEncodingsCount = 0;
    let nativeEnglishCount = 0;
    let ocrRequiredCount = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageTextRaw = textContent.items.map((item) => item.str).join(" ").trim();
      const normResult = normalizeSinhalaExtractedText(pageTextRaw);
      if (normResult.needsLegacyConversion) {
        overallNeedsLegacy = true;
      }
      let pageQuality = "extraction_failed";
      if (pageTextRaw.length < 40) {
        pageQuality = "empty_expected";
      } else if (normResult.textEncoding === "unicode_sinhala") {
        unicodeEncodingsCount++;
        pageQuality = "native_unicode";
      } else if (normResult.textEncoding === "native_english") {
        nativeEnglishCount++;
        pageQuality = "native_english";
      } else if (normResult.textEncoding.startsWith("legacy_")) {
        legacyEncodingsCount++;
        if (normResult.conversionConfidence > 0.6) {
          pageQuality = "legacy_convertible";
        } else {
          pageQuality = "ocr_required";
          ocrRequiredCount++;
        }
      } else {
        pageQuality = "ocr_required";
        ocrRequiredCount++;
      }
      pages.push({
        pageNumber: i,
        text: normResult.normalizedText,
        rawText: normResult.rawText,
        textEncoding: normResult.textEncoding,
        conversionApplied: normResult.conversionApplied,
        conversionConfidence: normResult.conversionConfidence,
        needsLegacyConversion: normResult.needsLegacyConversion,
        pageQuality
      });
      fullText += (fullText ? "\n\n" : "") + normResult.normalizedText;
    }
    if (legacyEncodingsCount > unicodeEncodingsCount && legacyEncodingsCount > nativeEnglishCount) {
      dominantEncoding = "legacy_fm_abhaya";
    } else if (unicodeEncodingsCount > 0 || nativeEnglishCount > 0) {
      dominantEncoding = unicodeEncodingsCount >= nativeEnglishCount ? "unicode_sinhala" : "native_english";
    }
    const trimmed = fullText.trim();
    if (trimmed.length === 0) {
      return {
        text: "",
        pages: [],
        needsOcr: true,
        needsLegacyConversion: false,
        textEncoding: "unknown",
        message: "PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA text extract \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DC4\u0DD0. OCR \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DBA\u0DD2."
      };
    }
    return {
      text: trimmed,
      pages,
      needsOcr: ocrRequiredCount > 0,
      // If any page needs OCR, we might trigger it for those pages
      needsLegacyConversion: overallNeedsLegacy,
      textEncoding: dominantEncoding
    };
  } catch (e) {
    console.warn("PDF extraction error:", e.message);
    return {
      text: "",
      pages: [],
      needsOcr: true,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      message: "PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA text extract \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DC4\u0DD0. OCR \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DBA\u0DD2."
    };
  }
}

// server/rag/routes.ts
init_retry();
var import_multer = __toESM(require("multer"), 1);
init_sourceInventoryService();

// server/pdf/geminiPdfOcr.ts
var import_genai2 = require("@google/genai");
init_client();
function isGeminiPdfOcrConfigured() {
  const mode = String(process.env.GEMINI_USE_VERTEX || "").trim().toLowerCase();
  if (mode === "false") return Boolean(process.env.GEMINI_API_KEY);
  if (mode === "true") return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID
  );
  return Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}
async function extractPdfPagesWithGemini(buffer) {
  if (!buffer?.length) throw new Error("Cannot OCR an empty PDF buffer.");
  const ai9 = getAIClient();
  const response = await ai9.models.generateContent({
    model: process.env.GEMINI_OCR_MODEL || process.env.GEMINI_PDF_QA_MODEL || "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: buffer.toString("base64")
        }
      },
      {
        text: [
          "OCR this Sri Lankan A/L PDF page by page.",
          "Extract only text visible in the document; never invent missing questions or answers.",
          "Preserve Sinhala and English Unicode, question/option numbers, formulas, and concise diagram labels.",
          "Return JSON in the requested schema."
        ].join(" ")
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai2.Type.OBJECT,
        properties: {
          pages: {
            type: import_genai2.Type.ARRAY,
            items: {
              type: import_genai2.Type.OBJECT,
              properties: {
                pageNumber: { type: import_genai2.Type.INTEGER },
                text: { type: import_genai2.Type.STRING }
              },
              required: ["pageNumber", "text"]
            }
          }
        },
        required: ["pages"]
      }
    }
  });
  const parsed = JSON.parse(response.text || "{}");
  const pages = (Array.isArray(parsed?.pages) ? parsed.pages : []).map((page, index) => ({
    pageNumber: Number(page?.pageNumber) || index + 1,
    text: String(page?.text || "").trim()
  })).filter((page) => page.text.length > 0);
  if (pages.length === 0) throw new Error("Gemini OCR returned no readable pages.");
  return pages;
}

// server/pdf/sourceBuffer.ts
init_admin();
init_retry();
var DEFAULT_MAX_BYTES = 80 * 1024 * 1024;
var DEFAULT_TIMEOUT_MS = 45e3;
function configuredMaxBytes() {
  const configured = Number(process.env.DIRECT_PDF_MAX_BYTES || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}
function storageObjectPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("gs://")) return raw.replace(/^gs:\/\/[^/]+\//, "");
  if (/^https:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname === "firebasestorage.googleapis.com") {
        const marker = "/o/";
        const index = url.pathname.indexOf(marker);
        return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : "";
      }
      if (url.hostname === "storage.googleapis.com") {
        const parts = url.pathname.replace(/^\/+/, "").split("/");
        return decodeURIComponent(parts.slice(1).join("/"));
      }
    } catch {
      return "";
    }
  }
  return raw.replace(/^\/+/, "");
}
function storageBucketName(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("gs://")) {
    return raw.slice(5).split("/")[0] || "";
  }
  if (/^https:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname === "firebasestorage.googleapis.com") {
        return decodeURIComponent(url.pathname.match(/\/v0\/b\/([^/]+)\/o\//)?.[1] || "");
      }
      if (url.hostname === "storage.googleapis.com") {
        return decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] || "");
      }
    } catch {
      return "";
    }
  }
  return "";
}
function storageGsUri(value, fallbackPath) {
  const path5 = storageObjectPath(value) || storageObjectPath(fallbackPath);
  const bucket = storageBucketName(value) || String(process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim();
  if (!path5 || !bucket || !/^[a-z0-9._-]+$/i.test(bucket)) return "";
  return `gs://${bucket}/${path5}`;
}
function validatedPdfDownloadUrl(value, expectedStoragePath) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    if (!["firebasestorage.googleapis.com", "storage.googleapis.com"].includes(url.hostname)) return "";
    if (storageObjectPath(raw) !== storageObjectPath(expectedStoragePath)) return "";
    return url.toString();
  } catch {
    return "";
  }
}
async function fetchPdfUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1" }
    });
    if (!response.ok) throw new Error(`Firebase download URL returned HTTP ${response.status}.`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    const maxBytes = configuredMaxBytes();
    if (declaredSize > maxBytes) throw new Error(`PDF is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB direct-read limit.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxBytes) throw new Error("PDF download was empty or exceeded the direct-read limit.");
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Storage response is not a PDF document.");
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}
async function loadPdfSourceBuffer(params) {
  const { source, storagePath, submittedDownloadUrl } = params;
  const candidateUrls = [
    submittedDownloadUrl,
    source?.downloadUrl,
    source?.url,
    source?.firebaseDownloadUrl
  ].map((value) => validatedPdfDownloadUrl(value, storagePath)).filter(Boolean);
  const failures = [];
  for (const url of [...new Set(candidateUrls)]) {
    try {
      return { buffer: await fetchPdfUrl(url), method: "firebase_download_url" };
    } catch (error2) {
      failures.push(`token_url:${String(error2?.message || error2)}`);
    }
  }
  try {
    const bucket = getAdminBucket();
    const file = bucket.file(storageObjectPath(storagePath));
    const [bytes] = await retryGoogleAuthOperation("directPdfAdminDownload", async () => file.download());
    if (!bytes?.length || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Admin Storage returned an empty or non-PDF object.");
    }
    if (bytes.length > configuredMaxBytes()) throw new Error("PDF exceeds the direct-read limit.");
    return { buffer: bytes, method: "firebase_admin" };
  } catch (error2) {
    failures.push(`admin_storage:${String(error2?.message || error2)}`);
  }
  const error = new Error("The original PDF could not be read through its Firebase download URL or Admin Storage.");
  error.code = "DIRECT_QA_SOURCE_DOWNLOAD_FAILED";
  error.details = failures;
  throw error;
}

// server/rag/routes.ts
var ragRoutes = (0, import_express2.Router)();
var upload = (0, import_multer.default)({ storage: import_multer.default.memoryStorage() });
function normalizeSubject4(sub) {
  const s = (sub || "").trim().toUpperCase();
  if (s.includes("SFT") || s.includes("SCIENCE")) return "SFT";
  if (s.includes("ET") || s.includes("ENGINEERING")) return "ET";
  if (s.includes("ICT") || s.includes("INFORMATION")) return "ICT";
  return s || "SFT";
}
var isPermissionError = (err) => {
  const msg = (err?.message || "").toLowerCase();
  return msg.includes("permission_denied") || msg.includes("permission denied") || err?.code === 7 || err?.status === 7;
};
function detectQuestionNo(text) {
  const lower = text.toLowerCase();
  if (lower.includes("q1") || lower.includes("question 1") || lower.includes("question 01") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 1") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 01") || lower.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 1") || lower.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 01") || lower.includes("\u0DB4\u0DC5\u0DB8\u0DD4") || lower.includes("\u0DB4\u0DC5\u0DC0\u0DD9\u0DB1\u0DD2") || /(?:^|\s|\n)0?1\.\s/.test(lower)) {
    return "Q1";
  }
  if (lower.includes("q2") || lower.includes("question 2") || lower.includes("question 02") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 2") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 02") || lower.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 2") || lower.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 02") || lower.includes("\u0DAF\u0DD9\u0DC0\u0DB1") || lower.includes("\u0DAF\u0DD9\u0DC0\u0DD9\u0DB1\u0DD2") || /(?:^|\s|\n)0?2\.\s/.test(lower)) {
    return "Q2";
  }
  if (lower.includes("q3") || lower.includes("question 3") || lower.includes("question 03") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 3") || lower.includes("\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 03") || lower.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 3") || lower.includes("\u0DB4\u0DCA\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA 03") || lower.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DB1") || lower.includes("\u0DAD\u0DD4\u0DB1\u0DCA\u0DC0\u0DD9\u0DB1\u0DD2") || /(?:^|\s|\n)0?3\.\s/.test(lower)) {
    return "Q3";
  }
  return null;
}
ragRoutes.get("/sources/:sourceId/download", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();
    const docRef = db.collection("rag_sources").doc(sourceId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found" });
    }
    const data = docSnap.data();
    if (!data || !data.storagePath) {
      return res.status(404).json({ ok: false, error: "Storage path not found" });
    }
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const privileged = user?.admin === true || roles.some((role) => ["admin", "content_editor", "ops"].includes(role));
    if (data.ownerUid !== user.uid && !privileged) {
      return res.status(403).json({ ok: false, error: "Unauthorized access to source. Only the owner of the source document can download the file." });
    }
    const bucket = getAdminBucket();
    const file = bucket.file(data.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ ok: false, error: "File not found in storage" });
    }
    const shouldStream = req.query.stream === "true";
    if (!shouldStream) {
      try {
        const [signedUrl] = await retryGoogleAuthOperation("sourcesGetSignedUrl", async () => {
          return await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 15 * 60 * 1e3
            // 15 mins
          });
        });
        return res.redirect(signedUrl);
      } catch (signErr) {
        console.warn("Failed to generate signed URL, falling back to direct stream:", signErr);
      }
    }
    res.setHeader("Content-Type", data.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(data.fileName || "source.pdf")}"`);
    file.createReadStream().pipe(res);
  } catch (e) {
    if (isPermissionError(e)) {
      return res.status(403).json({
        ok: false,
        code: "FIRESTORE_PERMISSION_DENIED",
        message: "Firestore/Storage Admin permission issue. Check backend health."
      });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});
ragRoutes.post("/upload", upload.single("file"), requireNonAnonymousUser, async (req, res) => {
  return res.status(400).json({
    ok: false,
    code: "USE_CLIENT_STORAGE_UPLOAD",
    recommendedUploadMode: "client_firebase_storage",
    message: "Firebase Admin Storage is degraded in this workspace. Please use client-side storage uploads directly."
  });
});
ragRoutes.get("/past-papers", requireNonAnonymousUser, async (req, res) => {
  try {
    const subject = normalizeSubject4(String(req.query.subject || ""));
    let query = getAdminDb().collection("past_papers");
    if (subject) query = query.where("subject", "==", subject);
    const snapshot = await query.limit(200).get();
    const papers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
    res.json({ ok: true, papers });
  } catch (err) {
    res.status(500).json({ ok: false, code: "PAST_PAPERS_READ_FAILED", message: err.message });
  }
});
ragRoutes.post("/past-papers", requireNonAnonymousUser, async (req, res) => {
  try {
    const {
      id,
      sourceId,
      title,
      fileName,
      subject,
      year,
      category,
      paperType,
      type,
      resourceType,
      sourceType,
      sourceScope,
      storagePath,
      downloadUrl,
      chunkCount,
      needsOcr,
      createdAt,
      updatedAt
    } = req.body;
    const finalId = id || sourceId;
    if (!finalId) {
      return res.status(400).json({ ok: false, error: "Missing paper ID" });
    }
    const normSubject = normalizeSubject4(subject || "");
    const db = getAdminDb();
    const existingSnapshot = await db.collection("past_papers").doc(finalId).get();
    const existing = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
    const alreadyProcessed = Boolean(existing.processedAt) || Number(existing.chunkCount || 0) > 0 || existing.indexStatus === "failed" || existing.indexStatus === "needs_ocr";
    const paperDoc = {
      id: finalId,
      sourceId: finalId,
      title: title || fileName || "Untitled Past Paper",
      fileName: fileName || title || "untitled.pdf",
      subject: normSubject,
      year: String(year || ""),
      category: category || "A/L Past Papers",
      paperType: paperType || type || "Full Paper",
      type: paperType || type || "Full Paper",
      resourceType: resourceType || "past_paper",
      sourceType: sourceType || resourceType || "past_paper",
      sourceScope: sourceScope || "past_paper",
      storagePath: storagePath || null,
      downloadUrl: storagePath ? validatedPdfDownloadUrl(downloadUrl, storagePath) || existing.downloadUrl || null : null,
      ownerUid: req.user.uid,
      ownerEmail: req.user.email || "unknown",
      uploaded: true,
      chunkCount: alreadyProcessed ? Number(existing.chunkCount || 0) : Number(chunkCount || 0),
      needsOcr: alreadyProcessed ? existing.needsOcr === true : needsOcr === true,
      textIndexed: alreadyProcessed ? existing.textIndexed === true : Number(chunkCount || 0) > 0 && needsOcr !== true,
      createdAt: createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.collection("past_papers").doc(finalId).set(paperDoc, { merge: true });
    invalidateInventoryCache(req.user.uid);
    res.json({ ok: true, doc: paperDoc });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
ragRoutes.delete("/past-papers/:id", requireNonAnonymousUser, async (req, res) => {
  try {
    const sourceId = req.params.id;
    const db = getAdminDb();
    const isAdmin = req.user.roles?.includes("admin") || req.user.admin === true;
    let storagePath = null;
    let pastPaperDeleted = false;
    let ragSourceDeleted = false;
    let chunksDeletedCount = 0;
    let syllabusChunksDeletedCount = 0;
    const ppDoc = await db.collection("past_papers").doc(sourceId).get();
    if (ppDoc.exists) {
      const data = ppDoc.data();
      if (data?.ownerUid !== req.user.uid && !isAdmin) {
        return res.status(403).json({ ok: false, error: "Unauthorized" });
      }
      storagePath = data?.storagePath || null;
      await db.collection("past_papers").doc(sourceId).delete();
      pastPaperDeleted = true;
    }
    const sourceDoc = await db.collection("rag_sources").doc(sourceId).get();
    if (sourceDoc.exists) {
      const data = sourceDoc.data();
      if (data?.ownerUid !== req.user.uid && !isAdmin) {
        return res.status(403).json({ ok: false, error: "Unauthorized" });
      }
      if (!storagePath) {
        storagePath = data?.storagePath || null;
      }
      await db.collection("rag_sources").doc(sourceId).delete();
      ragSourceDeleted = true;
    }
    const chunks = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const batch = db.batch();
    chunks.docs.forEach((d) => {
      batch.delete(d.ref);
      chunksDeletedCount++;
    });
    const sylChunks = await db.collection("users").doc(req.user.uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunks.docs.forEach((d) => {
      batch.delete(d.ref);
      syllabusChunksDeletedCount++;
    });
    const syllabusResources = await db.collection("users").doc(req.user.uid).collection("syllabus_resources").doc(sourceId).get();
    if (syllabusResources.exists) {
      batch.delete(syllabusResources.ref);
    }
    await batch.commit();
    let storageAttempted = false;
    let storageOk = false;
    let storageError = null;
    if (storagePath) {
      storageAttempted = true;
      try {
        const { getAdminBucket: getAdminBucket2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
        const bucket = getAdminBucket2();
        await bucket.file(storagePath).delete();
        storageOk = true;
      } catch (e) {
        console.warn("Admin Storage delete failed (expected if degraded):", e.message);
        storageError = e.message;
      }
    }
    invalidateInventoryCache(req.user.uid);
    res.json({
      ok: true,
      deleted: {
        pastPaper: pastPaperDeleted,
        ragSource: ragSourceDeleted,
        chunks: chunksDeletedCount,
        syllabusChunks: syllabusChunksDeletedCount
      },
      storageDelete: {
        attempted: storageAttempted,
        ok: storageOk,
        skipped: !storagePath,
        error: storageError
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
ragRoutes.delete("/sources/:sourceId", requireNonAnonymousUser, async (req, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();
    const docRef = db.collection("rag_sources").doc(sourceId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }
    const data = docSnap.data();
    if (!data) {
      return res.status(404).json({ ok: false, error: "Source data not found." });
    }
    const isAdmin = user.roles?.includes("admin") || user.admin === true;
    if (data.ownerUid !== user.uid && !isAdmin) {
      return res.status(403).json({ ok: false, error: "\u0D94\u0DB6\u0DA7 \u0DB8\u0DD9\u0DB8 PDF \u0D91\u0D9A \u0DB8\u0D9A\u0DCF \u0DAF\u0DD0\u0DB8\u0DD3\u0DB8\u0DA7 \u0D85\u0DC0\u0DC3\u0DBB \u0DB1\u0DD0\u0DAD." });
    }
    const storagePath = data.storagePath;
    let storageAttempted = false;
    let storageOk = false;
    let storageError = null;
    if (storagePath) {
      storageAttempted = true;
      try {
        const bucket = getAdminBucket();
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          storageOk = true;
        }
      } catch (err) {
        console.warn("Storage deletion error (continuing):", err.message);
        storageError = err.message;
      }
    }
    const batch = db.batch();
    batch.delete(docRef);
    if (data.sourceScope === "owner_syllabus" || data.sourceScope === "past_paper") {
      const sylRef = db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId);
      batch.delete(sylRef);
      try {
        const sylChunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
        sylChunksSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      } catch (err) {
        console.warn("Syllabus chunks query error (continuing):", err.message);
      }
    }
    try {
      const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
      chunksSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
    } catch (err) {
      console.warn("RAG chunks query error (continuing):", err.message);
    }
    await batch.commit();
    invalidateInventoryCache(user.uid);
    return res.json({
      ok: true,
      message: "PDF document deleted successfully.",
      storageDelete: {
        attempted: storageAttempted,
        ok: storageOk,
        skipped: !storagePath,
        error: storageError
      }
    });
  } catch (error) {
    console.error("Error deleting source:", error);
    if (isPermissionError(error)) {
      return res.status(403).json({
        ok: false,
        code: "FIRESTORE_PERMISSION_DENIED",
        message: "Firestore Admin/IAM permission issue."
      });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});
ragRoutes.post("/reindex-uploaded", upload.single("file"), requireNonAnonymousUser, async (req, res) => {
  try {
    const user = req.user;
    const { sourceId, pages, mode = "auto", downloadUrl } = req.body;
    if (!sourceId) {
      return res.status(400).json({ ok: false, error: "Missing sourceId." });
    }
    const db = getAdminDb();
    const sourceRef = db.collection("rag_sources").doc(sourceId);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found in rag_sources." });
    }
    const sourceData = sourceSnap.data();
    const isAdmin = user.roles?.includes("admin") || user.admin === true;
    if (sourceData?.ownerUid !== user.uid && !isAdmin) {
      return res.status(403).json({ ok: false, error: "Unauthorized to reindex this source." });
    }
    let chunkCount = 0;
    let needsOcr = sourceData?.needsOcr || false;
    let needsLegacy = sourceData?.needsLegacyConversion || false;
    let textEncoding = sourceData?.textEncoding || "unknown";
    const title = sourceData?.title || "Reindexed Document";
    const fileName = sourceData?.fileName || "document.pdf";
    const subject = sourceData?.subject || "SFT";
    const lesson = sourceData?.lesson || null;
    const resourceType = sourceData?.resourceType || "uploaded_pdf";
    const year = sourceData?.year || null;
    const medium = sourceData?.medium || "Sinhala";
    const sourceScope = sourceData?.sourceScope || "personal";
    const batch = db.batch();
    const rag_chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    rag_chunksSnap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    const sylChunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunksSnap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    let finalPages = [];
    let isOcrRun = false;
    let isOcrFailed = false;
    let pdfData = null;
    let pdfLoadError = null;
    if (req.file) {
      pdfData = req.file.buffer;
    } else if (!pages && sourceData?.storagePath) {
      try {
        const loaded = await loadPdfSourceBuffer({
          source: sourceData,
          storagePath: sourceData.storagePath,
          submittedDownloadUrl: downloadUrl
        });
        pdfData = loaded.buffer;
      } catch (err) {
        console.error("Failed to download PDF from storage for reindexing:", err);
        pdfLoadError = err;
      }
    }
    if (!pdfData && !pages && pdfLoadError) {
      return res.status(424).json({
        ok: false,
        code: pdfLoadError.code || "DIRECT_QA_SOURCE_DOWNLOAD_FAILED",
        error: "The PDF could not be read from its verified Firebase URL or Admin Storage.",
        message: "PDF source \u0D91\u0D9A download \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DBB\u0DD2 \u0DC0\u0DD4\u0DAB\u0DCF. File \u0D91\u0D9A \u0DB1\u0DD0\u0DC0\u0DAD upload \u0D9A\u0DC5\u0DDC\u0DAD\u0DCA original File \u0D91\u0D9A\u0DD9\u0DB1\u0DCA index \u0D9A\u0DBB\u0DBA\u0DD2."
      });
    }
    if (pdfData) {
      if (mode === "text_extract") {
        const extraction = await extractPdfText(pdfData);
        needsOcr = extraction.needsOcr;
        needsLegacy = extraction.needsLegacyConversion;
        textEncoding = extraction.textEncoding;
        if (!needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        }
      } else if (mode === "legacy_convert") {
        const extraction = await extractPdfText(pdfData);
        needsOcr = extraction.needsOcr;
        needsLegacy = true;
        textEncoding = extraction.textEncoding;
        if (!needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        }
      } else if (mode === "ocr") {
        if (!isGeminiPdfOcrConfigured()) {
          invalidateInventoryCache(user.uid);
          return res.json({
            ok: true,
            chunkCount: 0,
            needsOcr: true,
            indexStatus: "needs_ocr",
            ocrUnavailable: true,
            message: "OCR provider not configured"
          });
        }
        isOcrRun = true;
        try {
          const ai9 = getAIClient();
          const pdfBase64 = pdfData.toString("base64");
          const response = await ai9.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64
                }
              },
              {
                text: "Extract all readable Sinhala/English text page-by-page from this Sri Lankan A/L Technology exam PDF. Preserve question numbers, MCQ numbers, diagrams descriptions, formulas. Return JSON pages [{pageNumber, text}]"
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: import_genai3.Type.OBJECT,
                properties: {
                  pages: {
                    type: import_genai3.Type.ARRAY,
                    items: {
                      type: import_genai3.Type.OBJECT,
                      properties: {
                        pageNumber: { type: import_genai3.Type.INTEGER },
                        text: { type: import_genai3.Type.STRING }
                      },
                      required: ["pageNumber", "text"]
                    }
                  }
                },
                required: ["pages"]
              }
            }
          });
          const responseText = response.text || "";
          const parsed = JSON.parse(responseText);
          if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
            finalPages = parsed.pages;
            needsOcr = false;
            textEncoding = "ocr_sinhala";
            needsLegacy = false;
          } else {
            isOcrFailed = true;
          }
        } catch (err) {
          console.error("Gemini OCR failed:", err);
          isOcrFailed = true;
        }
      } else {
        const extraction = await extractPdfText(pdfData);
        needsOcr = extraction.needsOcr;
        needsLegacy = extraction.needsLegacyConversion;
        textEncoding = extraction.textEncoding;
        const hasLegacyTextLayer = String(textEncoding || "").startsWith("legacy_") && Array.isArray(extraction.pages) && extraction.pages.length > 0;
        if (hasLegacyTextLayer) {
          finalPages = extraction.pages;
          needsOcr = false;
          needsLegacy = false;
        }
        if (!hasLegacyTextLayer && !needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        } else if (!hasLegacyTextLayer) {
          if (isGeminiPdfOcrConfigured()) {
            isOcrRun = true;
            try {
              const ai9 = getAIClient();
              const pdfBase64 = pdfData.toString("base64");
              const response = await ai9.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: pdfBase64
                    }
                  },
                  {
                    text: "Extract all readable Sinhala/English text page-by-page from this Sri Lankan A/L Technology exam PDF. Preserve question numbers, MCQ numbers, diagrams descriptions, formulas. Return JSON pages [{pageNumber, text}]"
                  }
                ],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: import_genai3.Type.OBJECT,
                    properties: {
                      pages: {
                        type: import_genai3.Type.ARRAY,
                        items: {
                          type: import_genai3.Type.OBJECT,
                          properties: {
                            pageNumber: { type: import_genai3.Type.INTEGER },
                            text: { type: import_genai3.Type.STRING }
                          },
                          required: ["pageNumber", "text"]
                        }
                      }
                    },
                    required: ["pages"]
                  }
                }
              });
              const responseText = response.text || "";
              const parsed = JSON.parse(responseText);
              if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
                finalPages = parsed.pages;
                needsOcr = false;
                textEncoding = "ocr_sinhala";
                needsLegacy = false;
              } else {
                isOcrFailed = true;
              }
            } catch (err) {
              console.error("Auto OCR failed:", err);
              isOcrFailed = true;
            }
          }
        }
      }
    } else if (pages) {
      const pagesArray = typeof pages === "string" ? JSON.parse(pages) : pages;
      if (Array.isArray(pagesArray)) {
        finalPages = pagesArray;
      } else {
        return res.status(400).json({ ok: false, error: "Invalid pages format." });
      }
    } else {
      return res.status(400).json({ ok: false, error: "Missing file or pages array for reindexing." });
    }
    if (isOcrRun && isOcrFailed && finalPages.length === 0) {
      const metaUpdate2 = {
        chunkCount: 0,
        needsOcr: true,
        textIndexed: false,
        indexStatus: "needs_ocr",
        needsLegacyConversion: false,
        textEncoding: "unknown",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await sourceRef.update(metaUpdate2).catch((err) => console.warn("Firestore update failed:", err));
      if (sourceScope === "past_paper") {
        await db.collection("past_papers").doc(sourceId).update(metaUpdate2).catch((err) => console.warn("Firestore update failed:", err));
      }
      invalidateInventoryCache(user.uid);
      return res.json({
        ok: true,
        chunkCount: 0,
        needsOcr: true,
        indexStatus: "needs_ocr",
        ocrUnavailable: false,
        message: "OCR processing failed or returned empty pages."
      });
    }
    if (finalPages.length === 0 && needsOcr) {
      const metaUpdate2 = {
        chunkCount: 0,
        needsOcr: true,
        textIndexed: false,
        indexStatus: "needs_ocr",
        needsLegacyConversion: false,
        textEncoding: "unknown",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await sourceRef.update(metaUpdate2).catch((err) => console.warn("Firestore update failed:", err));
      if (sourceScope === "past_paper") {
        await db.collection("past_papers").doc(sourceId).update(metaUpdate2).catch((err) => console.warn("Firestore update failed:", err));
      }
      invalidateInventoryCache(user.uid);
      return res.json({
        ok: true,
        chunkCount: 0,
        needsOcr: true,
        indexStatus: "needs_ocr",
        ocrUnavailable: !isGeminiPdfOcrConfigured(),
        message: "OCR provider not configured or PDF empty"
      });
    }
    const chunkText = (text, size = 1e3, overlap = 150) => {
      const chunks = [];
      if (!text) return chunks;
      let i = 0;
      while (i < text.length) {
        const chunk = text.slice(i, i + size);
        chunks.push(chunk);
        i += size - overlap;
        if (size - overlap <= 0) break;
      }
      return chunks;
    };
    if (finalPages.length > 0) {
      for (const p of finalPages) {
        const pageText = (p.text || "").trim();
        if (!pageText) continue;
        const pageNum = Number(p.pageNumber || p.page_number || 1);
        const subChunks = chunkText(pageText, 1e3, 150);
        for (let j = 0; j < subChunks.length; j++) {
          const chunkTextContent = subChunks[j];
          const questionNo = detectQuestionNo(chunkTextContent);
          const chunkId = `chunk_${sourceId}_${chunkCount}`;
          const chunkDoc = {
            sourceId,
            pageNumber: pageNum,
            questionNo: questionNo || null,
            ownerUid: user.uid,
            ownerEmail: user.email || "unknown",
            text: chunkTextContent,
            rawTextPreview: chunkTextContent.slice(0, 200),
            textEncoding: textEncoding || "unknown",
            conversionApplied: p.conversionApplied || false,
            conversionConfidence: p.conversionConfidence || 0,
            chunkIndex: chunkCount++,
            title,
            fileName,
            subject: normalizeSubject4(subject || ""),
            lesson,
            subtopic: null,
            resourceType,
            year: year ? String(year) : null,
            medium,
            tags: [title, subject].filter(Boolean),
            sourceScope,
            visibility: sourceScope === "official" ? "official" : "private",
            embeddingStatus: "none",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          batch.set(db.collection("rag_chunks").doc(chunkId), chunkDoc);
          if (sourceScope === "owner_syllabus") {
            const sylChunkRef = db.collection("users").doc(user.uid).collection("syllabus_chunks").doc(chunkId);
            batch.set(sylChunkRef, { id: chunkId, ...chunkDoc });
          }
        }
      }
    }
    await batch.commit();
    const finalIndexStatus = computeIndexStatus({
      chunkCount,
      needsOcr,
      needsLegacyConversion: needsLegacy,
      textEncoding,
      indexStatus: chunkCount > 0 ? "ready" : "not_indexed"
    });
    const finalTextIndexed = chunkCount > 0 && !needsOcr;
    const metaUpdate = {
      chunkCount,
      needsOcr,
      textIndexed: finalTextIndexed,
      indexStatus: finalIndexStatus,
      needsLegacyConversion: needsLegacy,
      textEncoding,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await sourceRef.update(metaUpdate);
    if (sourceScope === "past_paper") {
      await db.collection("past_papers").doc(sourceId).update(metaUpdate);
    } else if (sourceScope === "owner_syllabus") {
      await db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId).update({
        status: finalIndexStatus,
        ...metaUpdate
      });
    }
    invalidateInventoryCache(user.uid);
    return res.json({
      ok: true,
      message: `Document reindexed with ${chunkCount} chunks.`,
      chunkCount,
      needsOcr,
      needsLegacyConversion: needsLegacy,
      textEncoding
    });
  } catch (err) {
    console.error("Error in reindex-uploaded endpoint:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
ragRoutes.get("/sources/:sourceId/chunks", requireFirebaseUser, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const chunks = chunksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    chunks.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
    return res.json({
      ok: true,
      chunks
    });
  } catch (err) {
    console.error("Error fetching chunks:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// server/syllabus/routes.ts
var import_express3 = require("express");
init_admin();
init_sourceInventoryService();
var syllabusRoutes = (0, import_express3.Router)();
syllabusRoutes.get("/debug", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    const roles = roleDoc.exists ? roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : []) : [];
    const isOwner = roles.includes("admin") || roles.includes("teacher") || roles.includes("content_editor") || user.admin === true;
    const ownerEmail = process.env.SYLLABUS_OWNER_EMAIL || "admin";
    let resourcesCount = 0;
    let chunksCount = 0;
    if (isOwner) {
      const db2 = getAdminDb();
      const resSnap = await db2.collection("users").doc(user.uid).collection("syllabus_resources").count().get();
      resourcesCount = resSnap.data().count;
      const chunkSnap = await db2.collection("users").doc(user.uid).collection("syllabus_chunks").count().get();
      chunksCount = chunkSnap.data().count;
    }
    res.json({
      ok: true,
      ownerEmail,
      currentUserEmail: user?.email,
      currentUserIsOwner: isOwner,
      uid: user?.uid,
      resourcesCount,
      chunksCount,
      storagePrefix: `users/${user?.uid}/syllabus/`,
      firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
syllabusRoutes.get("/resources", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(user.uid).collection("syllabus_resources").orderBy("createdAt", "desc").get();
    const userResources = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    const roles = roleDoc.exists ? roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : []) : [];
    const isAdmin = roles.includes("admin") || user.admin === true;
    let resources = [...userResources];
    if (!isAdmin) {
      let ownerUid = null;
      const adminsSnap = await db.collection("user_roles").where("role", "==", "admin").limit(1).get();
      if (!adminsSnap.empty) {
        ownerUid = adminsSnap.docs[0].id;
      } else {
        const adminsSnap2 = await db.collection("user_roles").where("roles", "array-contains", "admin").limit(1).get();
        if (!adminsSnap2.empty) {
          ownerUid = adminsSnap2.docs[0].id;
        }
      }
      if (ownerUid) {
        const adminSnap = await db.collection("users").doc(ownerUid).collection("syllabus_resources").orderBy("createdAt", "desc").get();
        const adminResources = adminSnap.docs.map((d) => ({ id: d.id, ...d.data(), isOfficial: true }));
        const existingIds = new Set(resources.map((r) => r.id));
        adminResources.forEach((r) => {
          if (!existingIds.has(r.id)) {
            resources.push(r);
          }
        });
      }
    }
    res.json({ ok: true, resources });
  } catch (e) {
    res.status(403).json({ ok: false, error: e.message });
  }
});
syllabusRoutes.delete("/resources/:resourceId", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { resourceId } = req.params;
    const db = getAdminDb();
    const bucket = getAdminBucket();
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    const roles = roleDoc.exists ? roleDoc.data()?.roles || (roleDoc.data()?.role ? [roleDoc.data().role] : []) : [];
    const isAdmin = roles.includes("admin") || user.admin === true;
    const docRef = db.collection("users").doc(user.uid).collection("syllabus_resources").doc(resourceId);
    const docSnap = await docRef.get();
    let canDelete = docSnap.exists;
    let storagePath = null;
    if (docSnap.exists) {
      storagePath = docSnap.data()?.storagePath || null;
    } else if (isAdmin) {
      const ragRef = db.collection("rag_sources").doc(resourceId);
      const ragSnap = await ragRef.get();
      if (ragSnap.exists) {
        canDelete = true;
        storagePath = ragSnap.data()?.storagePath || null;
      }
    }
    if (!canDelete) {
      return res.status(403).json({ ok: false, error: "Unauthorized or resource not found" });
    }
    const batch = db.batch();
    batch.delete(docRef);
    const chunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", resourceId).get();
    chunksSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("rag_sources").doc(resourceId));
    const rag_chunks = await db.collection("rag_chunks").where("sourceId", "==", resourceId).get();
    rag_chunks.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    let storageAttempted = false;
    let storageOk = false;
    let storageError = null;
    if (storagePath) {
      storageAttempted = true;
      try {
        await bucket.file(storagePath).delete();
        storageOk = true;
      } catch (err) {
        console.warn("Syllabus Admin Storage delete failed:", err.message);
        storageError = err.message;
      }
    }
    invalidateInventoryCache(user.uid);
    res.json({
      ok: true,
      deletedId: resourceId,
      storageDelete: {
        attempted: storageAttempted,
        ok: storageOk,
        skipped: !storagePath,
        error: storageError
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
syllabusRoutes.get("/resources/:resourceId/download", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { resourceId } = req.params;
    const db = getAdminDb();
    let resourceDoc = await db.collection("users").doc(user.uid).collection("syllabus_resources").doc(resourceId).get();
    if (!resourceDoc.exists) {
      let ownerUid = null;
      const adminsSnap = await db.collection("user_roles").where("role", "==", "admin").limit(1).get();
      if (!adminsSnap.empty) {
        ownerUid = adminsSnap.docs[0].id;
      } else {
        const adminsSnap2 = await db.collection("user_roles").where("roles", "array-contains", "admin").limit(1).get();
        if (!adminsSnap2.empty) {
          ownerUid = adminsSnap2.docs[0].id;
        }
      }
      if (ownerUid) {
        resourceDoc = await db.collection("users").doc(ownerUid).collection("syllabus_resources").doc(resourceId).get();
      }
    }
    if (!resourceDoc.exists) {
      resourceDoc = await db.collection("rag_sources").doc(resourceId).get();
    }
    if (!resourceDoc.exists) {
      return res.status(404).json({ ok: false, error: "Resource not found in syllabus library" });
    }
    const data = resourceDoc.data();
    if (!data || !data.storagePath) {
      return res.status(404).json({ ok: false, error: "Storage path not found" });
    }
    const bucket = getAdminBucket();
    const file = bucket.file(data.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ ok: false, error: "File not found in storage" });
    }
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 15 * 60 * 1e3
        // 15 mins
      });
      return res.redirect(signedUrl);
    } catch (signErr) {
      console.warn("Failed to generate signed URL, falling back to direct stream:", signErr);
    }
    res.setHeader("Content-Type", data.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(data.fileName || "syllabus_resource.pdf")}"`);
    file.createReadStream().pipe(res);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// server/auth/routes.ts
var import_express4 = __toESM(require("express"), 1);
init_admin();

// server/utils/authContext.ts
init_admin();
function computeSourceCapabilities(auth, source) {
  const isOwner = source.ownerUid === auth.uid;
  const isAdmin = auth.roles.includes("admin");
  const isOps = auth.roles.includes("ops");
  const isEditor = auth.roles.includes("content_editor");
  const isReviewer = auth.roles.includes("reviewer");
  const isTeacher = auth.roles.includes("teacher");
  const visibility = source.visibility || "private";
  const isPublicOrOfficial = visibility === "public" || visibility === "official";
  const isShared = visibility === "shared";
  let canView = false;
  if (isOwner || isAdmin || isOps) {
    canView = true;
  } else if (isPublicOrOfficial) {
    canView = true;
  } else if (isShared) {
    canView = true;
  }
  let canDownload = canView;
  let canAskAI = canView;
  let canDelete = false;
  if (isAdmin || isOps) {
    canDelete = true;
  } else if (isOwner && !isPublicOrOfficial) {
    canDelete = true;
  }
  let canReprocess = false;
  let canReindex = false;
  let canRunOcr = false;
  if (isAdmin || isOps) {
    canReprocess = true;
    canReindex = true;
    canRunOcr = true;
  } else if (isOwner && !isPublicOrOfficial) {
    canReprocess = true;
    canReindex = true;
    canRunOcr = true;
  }
  let canViewOcrText = false;
  if (isAdmin || isOps || isOwner) {
    canViewOcrText = true;
  } else if (isPublicOrOfficial && (isEditor || isTeacher)) {
    canViewOcrText = true;
  }
  let canReviewCache = isAdmin || isReviewer;
  let canRepairSource = isAdmin || isOps;
  if (isOwner && !isPublicOrOfficial) {
    canRepairSource = true;
  }
  let canChangeVisibility = isAdmin || isEditor;
  if (isOwner && !isPublicOrOfficial) {
    canChangeVisibility = true;
  }
  let canEditMetadata = isAdmin || isEditor;
  if (isOwner && !isPublicOrOfficial) {
    canEditMetadata = true;
  }
  return {
    canView,
    canDownload,
    canAskAI,
    canDelete,
    canReprocess,
    canReindex,
    canRunOcr,
    canViewOcrText,
    canReviewCache,
    canRepairSource,
    canChangeVisibility,
    canEditMetadata
  };
}
async function createAuditEvent(params) {
  try {
    const db = getAdminDb();
    const docRef = db.collection("audit_logs").doc();
    const auditRecord = {
      auditId: docRef.id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...params
    };
    await docRef.set(auditRecord);
    console.log(`[AUDIT] ${params.operation} by ${params.actorUid} on ${params.targetType}:${params.targetId} - ${params.result}`);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// server/auth/routes.ts
init_configuredRoles();
var authRoutes = import_express4.default.Router();
authRoutes.get("/context", requireFirebaseUser, async (req, res) => {
  try {
    const authContext = req.authContext;
    const user = req.user;
    if (!authContext) {
      return res.status(401).json({ ok: false, error: "AuthContext not available" });
    }
    const capabilities = computeSourceCapabilities(authContext, {});
    const canUploadVideo = authContext.roles.some((role) => ["admin", "content_editor", "ops"].includes(role));
    res.json({
      ok: true,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        isAnonymous: user.isAnonymous
      },
      roles: authContext.roles,
      capabilities: { ...capabilities, canUploadVideo }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
authRoutes.post("/force-reset-password", async (req, res) => {
  try {
    await requireAdmin(req);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and new password are required" });
    }
    const userRecord = await getAdminAuth().getUserByEmail(email);
    await getAdminAuth().updateUser(userRecord.uid, { password });
    res.json({ success: true, message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update password" });
  }
});
authRoutes.post("/session", async (req, res) => {
  try {
    const { idToken, profileData } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const email = decodedToken.email;
    if (!email) {
      return res.status(400).json({ error: "Email missing from token" });
    }
    const configuredRoles = applyConfiguredAdminRoles(
      email,
      decodedToken.email_verified === true,
      Array.isArray(decodedToken.roles) ? decodedToken.roles : [],
      decodedToken.uid
    );
    let claimsUpdated = false;
    if (configuredRoles.includes("admin")) {
      try {
        const auth = getAdminAuth();
        const record = await auth.getUser(decodedToken.uid);
        const currentClaims = record.customClaims || {};
        const nextRoles = [.../* @__PURE__ */ new Set([...Array.isArray(currentClaims.roles) ? currentClaims.roles : [], ...configuredRoles])];
        if (currentClaims.admin !== true || JSON.stringify(currentClaims.roles || []) !== JSON.stringify(nextRoles)) {
          await auth.setCustomUserClaims(decodedToken.uid, {
            ...currentClaims,
            admin: true,
            role: "admin",
            roles: nextRoles
          });
          claimsUpdated = true;
        }
      } catch (claimError) {
        console.warn("[AUTH] Admin custom-claim sync skipped:", String(claimError?.message || claimError));
      }
    }
    const profile = {
      email: email.toLowerCase(),
      username: profileData?.username || decodedToken.name || email.split("@")[0],
      picture: decodedToken.picture || profileData?.picture || "",
      nic: profileData?.nic || "",
      mobileNumber: profileData?.mobileNumber || "",
      bday: profileData?.bday || "",
      gender: profileData?.gender || "",
      isVerified: decodedToken.email_verified === true,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      bio: profileData?.bio || "Technology Stream Learner"
    };
    const userSession = {
      email: profile.email,
      name: profile.username,
      picture: profile.picture,
      emailVerified: decodedToken.email_verified === true,
      uid: decodedToken.uid
    };
    res.json({ success: true, user: userSession, profile, claimsUpdated });
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired login" });
  }
});

// server/pdf/routes.ts
var import_express5 = __toESM(require("express"), 1);
var import_multer2 = __toESM(require("multer"), 1);
init_admin();

// server/pdf/processingPipeline.ts
init_admin();

// server/ocr/cloudVisionOcr.ts
init_retry();
var import_vision = require("@google-cloud/vision");
init_admin();
var visionClient = null;
function getVisionClient() {
  if (!visionClient) {
    const isEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true";
    if (!isEnabled) {
      throw new Error("Cloud Vision OCR is not enabled (ENABLE_CLOUD_VISION_OCR is not true).");
    }
    visionClient = new import_vision.ImageAnnotatorClient();
  }
  return visionClient;
}
async function runCloudVisionPdfOcr(params) {
  const { sourceId, uid, buffer, languageHints = ["si", "en"] } = params;
  const inputBucketName = process.env.VISION_OCR_INPUT_BUCKET || "al-ai-chat-ocr-input";
  const outputBucketName = process.env.VISION_OCR_OUTPUT_BUCKET || "al-ai-chat-ocr-output";
  const client2 = getVisionClient();
  const storage = getAdminStorage();
  const gcsSourceUri = params.gcsInputUri || `gs://${inputBucketName}/jobs/${sourceId}/original.pdf`;
  if (!params.gcsInputUri) {
    const inputBucket = storage.bucket(inputBucketName);
    const gcsFile = inputBucket.file(`jobs/${sourceId}/original.pdf`);
    await gcsFile.save(buffer, {
      contentType: "application/pdf",
      metadata: {
        owner: uid,
        sourceId
      }
    });
    console.log(`Uploaded PDF to ${gcsSourceUri} for Cloud Vision OCR`);
  }
  const gcsDestinationUri = `gs://${outputBucketName}/jobs/${sourceId}/`;
  const request = {
    requests: [
      {
        inputConfig: {
          mimeType: "application/pdf",
          gcsSource: {
            uri: gcsSourceUri
          }
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        outputConfig: {
          gcsDestination: {
            uri: gcsDestinationUri
          }
        },
        imageContext: {
          languageHints
        }
      }
    ]
  };
  console.log(`Triggering asyncBatchAnnotateFiles for sourceId: ${sourceId}`);
  const [operation] = await client2.asyncBatchAnnotateFiles(request);
  const operationName = operation.name;
  if (!operationName) {
    throw new Error("Failed to start Cloud Vision asyncBatchAnnotateFiles operation.");
  }
  const db = getAdminDb();
  await db.collection("ocr_jobs").doc(sourceId).set({
    sourceId,
    uid,
    operationName,
    status: "running",
    inputUri: gcsSourceUri,
    outputUri: gcsDestinationUri,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  console.log(`Started Cloud Vision OCR operation: ${operationName}. Polling for quick completion...`);
  const startTime = Date.now();
  let completedResponse = null;
  while (Date.now() - startTime < 25e3) {
    try {
      const [op] = await client2.operationsClient.getOperation({ name: operationName });
      if (op.done) {
        completedResponse = op;
        break;
      }
    } catch (pollErr) {
      console.warn("Polling operation error (ignoring and retrying):", pollErr);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  if (completedResponse && completedResponse.done) {
    console.log(`Cloud Vision OCR finished quickly! Downloading and parsing output...`);
    const result = await parseOcrOutputFromGcs(sourceId);
    await db.collection("ocr_jobs").doc(sourceId).update({
      status: "ready",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { queued: false, result };
  }
  return { queued: true, operationName };
}
async function checkOcrJobStatus(sourceId) {
  const db = getAdminDb();
  const jobSnap = await db.collection("ocr_jobs").doc(sourceId).get();
  if (!jobSnap.exists) {
    return { status: "queued" };
  }
  const jobData = jobSnap.data();
  if (jobData.status === "ready") {
    try {
      const result = await parseOcrOutputFromGcs(sourceId);
      return { status: "ready", result };
    } catch (err) {
      return { status: "failed", error: `Failed to parse OCR outputs: ${err.message}` };
    }
  }
  if (jobData.status === "failed") {
    return { status: "failed", error: jobData.error || "OCR job failed." };
  }
  const operationName = jobData.operationName;
  if (!operationName) {
    return { status: "failed", error: "Missing operation name in database." };
  }
  try {
    const client2 = getVisionClient();
    const [op] = await client2.operationsClient.getOperation({ name: operationName });
    if (op.error) {
      const errMsg = op.error.message || "Unknown error during GCV async processing";
      await db.collection("ocr_jobs").doc(sourceId).update({
        status: "failed",
        error: errMsg,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { status: "failed", error: errMsg };
    }
    if (op.done) {
      console.log(`Cloud Vision OCR background job finished. Downloading and parsing output...`);
      const result = await parseOcrOutputFromGcs(sourceId);
      await db.collection("ocr_jobs").doc(sourceId).update({
        status: "ready",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { status: "ready", result };
    }
    return { status: "running" };
  } catch (err) {
    console.error("Error checking Cloud Vision operation status:", err);
    return { status: "running" };
  }
}
async function parseOcrOutputFromGcs(sourceId) {
  const outputBucketName = process.env.VISION_OCR_OUTPUT_BUCKET || "al-ai-chat-ocr-output";
  const storage = getAdminStorage();
  const outputBucket = storage.bucket(outputBucketName);
  const prefix = `jobs/${sourceId}/`;
  const [files] = await outputBucket.getFiles({ prefix });
  const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
  if (jsonFiles.length === 0) {
    throw new Error(`No OCR output JSON files found in bucket ${outputBucketName} at ${prefix}`);
  }
  const pages = [];
  for (const file of jsonFiles) {
    const [contentBuffer] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());
    const content = JSON.parse(contentBuffer.toString("utf8"));
    if (content.responses && Array.isArray(content.responses)) {
      for (const resp of content.responses) {
        const pageNumber = resp.context?.pageNumber || 1;
        const text = resp.fullTextAnnotation?.text || "";
        let totalConfidence = 0;
        let blockCount = 0;
        if (resp.fullTextAnnotation?.pages) {
          for (const page of resp.fullTextAnnotation.pages) {
            if (page.blocks) {
              for (const block of page.blocks) {
                if (typeof block.confidence === "number") {
                  totalConfidence += block.confidence;
                  blockCount++;
                }
              }
            }
          }
        }
        const confidence = blockCount > 0 ? totalConfidence / blockCount : 0.85;
        pages.push({
          pageNumber,
          text,
          confidence
        });
      }
    }
  }
  if (pages.length === 0) {
    throw new Error("No pages could be parsed from Cloud Vision OCR output JSON files.");
  }
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  const fullText = pages.map((p) => p.text).join("\n\n");
  const totalConfidenceSum = pages.reduce((sum, p) => sum + p.confidence, 0);
  const avgConfidence = totalConfidenceSum / pages.length;
  return {
    pages,
    fullText,
    provider: "cloud_vision",
    confidence: avgConfidence
  };
}

// server/pdf/generateSinhalaTextPdf.ts
init_admin();
async function generateSinhalaTextPdf(params) {
  const { uid, sourceId, fileName, title, subject, year, extractionMethod, pages } = params;
  const storage = getAdminStorage();
  const bucket = storage.bucket();
  const safeFileName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\u0D80-\u0DFF-]/g, "_");
  const jsonStoragePath = `users/${uid}/ocr_text/${sourceId}/pages.json`;
  const htmlStoragePath = `users/${uid}/ocr_text_pdfs/${sourceId}/${safeFileName}_sinhala_text.html`;
  try {
    const jsonFile = bucket.file(jsonStoragePath);
    await jsonFile.save(
      JSON.stringify({
        sourceId,
        title,
        fileName,
        subject,
        year,
        extractionMethod,
        pages,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2),
      {
        contentType: "application/json",
        metadata: {
          owner: uid,
          sourceId
        }
      }
    );
    console.log(`Saved OCR raw pages JSON to: ${jsonStoragePath}`);
    let htmlContent = `<!DOCTYPE html>
<html lang="si">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Sinhala Text Version</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    
    body {
      font-family: "Noto Sans Sinhala", "Inter", sans-serif;
      line-height: 1.8;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 800px;
      margin: 40px auto;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    .doc-header {
      background-color: #0f172a;
      color: #ffffff;
      padding: 32px;
      border-bottom: 4px solid #3b82f6;
    }

    .doc-header h1 {
      margin: 0 0 12px 0;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.3;
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      font-size: 13px;
      opacity: 0.9;
    }

    .metadata-item span {
      display: block;
      color: #94a3b8;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }

    .metadata-item strong {
      color: #f1f5f9;
      font-weight: 500;
    }

    .page {
      padding: 40px;
      border-bottom: 1px dashed #e2e8f0;
      position: relative;
    }

    .page:last-child {
      border-bottom: none;
    }

    .page-num {
      position: absolute;
      top: 40px;
      right: 40px;
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .page-title {
      font-size: 14px;
      font-weight: 600;
      color: #3b82f6;
      margin-top: 0;
      margin-bottom: 24px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }

    .page-content {
      font-size: 16px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .page-content p {
      margin-top: 0;
      margin-bottom: 16px;
    }

    .diagram-desc {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      font-style: italic;
    }

    .footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #64748b;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    @media print {
      body {
        background-color: #ffffff;
      }
      .container {
        box-shadow: none;
        border: none;
        max-width: 100%;
        margin: 0;
      }
      .doc-header {
        background-color: #ffffff !important;
        color: #000000 !important;
        border-bottom: 2px solid #000000;
        padding: 20px 0;
      }
      .metadata-item strong {
        color: #000000 !important;
      }
      .page {
        page-break-after: always;
        padding: 20px 0;
      }
      .footer {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="doc-header">
      <h1>${title || fileName}</h1>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span>Subject / \u0DC0\u0DD2\u0DC2\u0DBA</span>
          <strong>${subject || "N/A"}</strong>
        </div>
        <div class="metadata-item">
          <span>Year / \u0DC0\u0DBB\u0DCA\u0DC2\u0DBA</span>
          <strong>${year || "N/A"}</strong>
        </div>
        <div class="metadata-item">
          <span>Method / \u0D9A\u0DCA\u200D\u0DBB\u0DB8\u0DBA</span>
          <strong>${extractionMethod.replace(/_/g, " ").toUpperCase()}</strong>
        </div>
        <div class="metadata-item">
          <span>Generated / \u0DC3\u0DCF\u0DAF\u0DB1 \u0DBD\u0DAF\u0DD3</span>
          <strong>${(/* @__PURE__ */ new Date()).toLocaleDateString("si-LK")}</strong>
        </div>
      </div>
    </header>

    <main>`;
    for (const page of pages) {
      const cleanText = page.text.replace(/\s+/g, " ").trim();
      htmlContent += `
      <section class="page">
        <div class="page-num">Page ${page.pageNumber}</div>
        <div class="page-title">\u0DB4\u0DD2\u0DA7\u0DD4\u0DC0 ${page.pageNumber} / Page ${page.pageNumber}</div>
        <div class="page-content">${cleanText || "<i>(\u0DB8\u0DD9\u0DB8 \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0\u0DDA \u0D9A\u0DD2\u0DC3\u0DD2\u0DAF\u0DD4 \u0D85\u0D9A\u0DD4\u0DBB\u0D9A\u0DCA \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DAD \u0DB1\u0DDC\u0DC4\u0DD0\u0D9A\u0DD2 \u0DC0\u0DD2\u0DBA / No text detected on this page)</i>"}</div>
      </section>`;
    }
    htmlContent += `
    </main>

    <footer class="footer">
      Clora X / A.L Tech Blueprint - Sinhala-First A/L Learning Platform &copy; ${(/* @__PURE__ */ new Date()).getFullYear()}
    </footer>
  </div>
</body>
</html>`;
    const htmlFile = bucket.file(htmlStoragePath);
    await htmlFile.save(htmlContent, {
      contentType: "text/html",
      metadata: {
        owner: uid,
        sourceId
      }
    });
    console.log(`Successfully generated and uploaded readable HTML document to GCS: ${htmlStoragePath}`);
    return {
      ocrTextPdfStoragePath: htmlStoragePath,
      ocrTextStoragePath: jsonStoragePath,
      ocrTextPdfStatus: "ready"
    };
  } catch (error) {
    console.error("Error generating Sinhala text HTML/PDF document:", error);
    return {
      ocrTextPdfStoragePath: null,
      ocrTextStoragePath: jsonStoragePath,
      ocrTextPdfStatus: "failed_storage_upload"
    };
  }
}

// server/pdf/processingPipeline.ts
init_sourceInventoryService();

// server/pdf/lessonDetector.ts
init_syllabus();
function detectLessonForChunk(text, subject) {
  const normSubj = subject.toLowerCase().trim();
  const def = SYLLABUS[normSubj];
  if (!def) return null;
  const topics = /* @__PURE__ */ new Set();
  if (def.mcqItems) {
    for (const item of def.mcqItems) {
      if (item.title) topics.add(item.title);
    }
  }
  if (def.partAItems) {
    for (const item of def.partAItems) {
      if (item.topics) {
        for (const t of item.topics) topics.add(t);
      }
    }
  }
  if (def.bcdGroups) {
    for (const g of def.bcdGroups) {
      if (g.items) {
        for (const item of g.items) {
          if (item.topics) {
            for (const t of item.topics) topics.add(t);
          }
        }
      }
    }
  }
  const lowerText = text.toLowerCase();
  for (const topic of topics) {
    if (topic.length > 3 && lowerText.includes(topic.toLowerCase())) {
      return topic;
    }
  }
  return null;
}

// server/platform/documentIntelligence.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
function normalize(value) {
  return String(value || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
}
function cleanupResourceTitle(value) {
  const withoutExtension = normalize(value).replace(/\.(pdf|docx?|pptx?|txt|jpg|jpeg|png)$/i, "").replace(/\b(?:copy|final|new|edited|scan|scanned|compressed)\b/gi, "").replace(/\b[0-9a-f]{16,}\b/gi, "").replace(/[()[\]{}]+/g, " ").replace(/\s+/g, " ").trim();
  return withoutExtension || "Untitled resource";
}
function detectSubject(combined, explicit) {
  const explicitNormalized = normalize(explicit).toUpperCase();
  if (["SFT", "ET", "ICT"].includes(explicitNormalized))
    return explicitNormalized;
  const value = combined.toLowerCase();
  if (/\b(?:sft|science for technology|67\s*s)\b/i.test(combined) || value.includes("\u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA \u0DC3\u0DB3\u0DC4\u0DCF \u0DC0\u0DD2\u0DAF\u0DCA\u200D\u0DBA\u0DCF\u0DC0"))
    return "SFT";
  if (/\b(?:engineering technology|et|65\s*e)\b/i.test(combined) || value.includes("\u0D89\u0D82\u0DA2\u0DD2\u0DB1\u0DDA\u0DBB\u0DD4 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DC0\u0DDA\u0DAF\u0DBA"))
    return "ET";
  if (/\b(?:ict|information and communication technology|66\s*i)\b/i.test(
    combined
  ) || value.includes("\u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DC4\u0DCF \u0DC3\u0DB1\u0DCA\u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1 \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA"))
    return "ICT";
  return "UNKNOWN";
}
function detectYear(combined, explicit) {
  const explicitYear = String(explicit || "").match(/\b(20\d{2})\b/)?.[1];
  if (explicitYear) return explicitYear;
  return combined.match(/\b(20\d{2})\b/)?.[1] || null;
}
function detectMedium(text) {
  if (!text.trim()) return "Unknown";
  const letters = [...text].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return "Unknown";
  const sinhala = letters.filter(
    (char) => /[\u0D80-\u0DFF]/u.test(char)
  ).length;
  const latin = letters.filter((char) => /[A-Za-z]/.test(char)).length;
  const siRatio = sinhala / letters.length;
  const enRatio = latin / letters.length;
  if (siRatio >= 0.55 && enRatio < 0.25) return "Sinhala";
  if (enRatio >= 0.55 && siRatio < 0.25) return "English";
  if (siRatio >= 0.15 && enRatio >= 0.15) return "Mixed";
  return siRatio > enRatio ? "Sinhala" : enRatio > siRatio ? "English" : "Unknown";
}
function detectPaperKind(combined, resourceType) {
  const value = combined.toLowerCase();
  const explicit = normalize(resourceType).toLowerCase();
  if (/marking\s*scheme|answer\s*scheme|scheme|පිළිතුරු\s*පත්‍ර|ලකුණු\s*දීමේ/.test(
    value
  ) || explicit.includes("marking"))
    return "marking_scheme";
  if (/syllabus|විෂය\s*නිර්දේශ/.test(value) || explicit.includes("syllabus"))
    return "syllabus";
  if (/model\s*paper|guess\s*paper|අනුමාන\s*ප්‍රශ්න|ආදර්ශ\s*ප්‍රශ්න/.test(
    value
  ) || explicit.includes("model"))
    return "model_paper";
  if (/question\s*bank|mcq\s*bank|ප්‍රශ්න\s*බැංකු/.test(value) || explicit.includes("question_bank"))
    return "question_bank";
  if (/past\s*paper|g\.c\.e|advanced\s*level|අධ්‍යයන\s*පොදු\s*සහතික|විභාගය/.test(
    value
  ) || explicit.includes("past_paper"))
    return "past_paper";
  if (/lesson|note|tutorial|tute|පාඩම|සටහන්/.test(value) || explicit.includes("note"))
    return "lesson_note";
  return "unknown";
}
function detectQuestionType(text) {
  const value = text.toLowerCase();
  const hasMcq = /\(1\)[\s\S]{0,500}\(2\)/.test(text) || /\bmcq\b/.test(value) || /බහුවරණ/.test(value);
  const hasStructured = /structured|ව්‍යුහගත|කෙටි\s*පිළිතුරු/.test(value);
  const hasEssay = /essay|රචනා|b\s*කොටස|c\s*කොටස|d\s*කොටස/.test(value);
  const matches = [hasMcq, hasStructured, hasEssay].filter(Boolean).length;
  if (matches > 1) return "Mixed";
  if (hasMcq) return "MCQ";
  if (hasStructured) return "Structured";
  if (hasEssay) return "Essay";
  return "Unknown";
}
function detectTeacherName(combined) {
  const patterns = [
    /(?:teacher|sir|miss|mr\.?|mrs\.?)\s*[:\-]?\s*([A-Z][A-Za-z .]{2,50})/i,
    /(?:ගුරු|සර්|මිස්|මහතා|මහත්මිය)\s*[:\-]?\s*([\u0D80-\u0DFFA-Za-z .]{2,50})/u
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern)?.[1]?.trim();
    if (match) return match.replace(/\s+/g, " ").slice(0, 60);
  }
  return null;
}
function classifyDocumentMetadata(input) {
  const cleanedTitle = cleanupResourceTitle(input.title || input.fileName);
  const textSample = normalize(input.text).slice(0, 2e4);
  const combined = normalize(
    [
      input.fileName,
      input.title,
      input.resourceType,
      input.subject,
      input.year,
      textSample
    ].filter(Boolean).join(" ")
  );
  const evidence = [];
  const warnings = [];
  const subject = detectSubject(combined, input.subject);
  const year = detectYear(combined, input.year);
  const medium = detectMedium(textSample || combined);
  const paperKind = detectPaperKind(combined, input.resourceType);
  const questionType = detectQuestionType(textSample || combined);
  const teacherName = detectTeacherName(combined);
  if (subject !== "UNKNOWN") evidence.push(`subject:${subject}`);
  else warnings.push("Subject could not be detected confidently.");
  if (year) evidence.push(`year:${year}`);
  else warnings.push("Exam/resource year could not be detected.");
  if (medium !== "Unknown") evidence.push(`medium:${medium}`);
  if (paperKind !== "unknown") evidence.push(`resource:${paperKind}`);
  if (questionType !== "Unknown") evidence.push(`questionType:${questionType}`);
  if (teacherName) evidence.push(`teacher:${teacherName}`);
  const detectedFields = [
    subject !== "UNKNOWN",
    Boolean(year),
    medium !== "Unknown",
    paperKind !== "unknown",
    questionType !== "Unknown"
  ];
  const confidence = clamp01(
    0.2 + detectedFields.filter(Boolean).length * 0.15 + (textSample.length > 300 ? 0.05 : 0)
  );
  return {
    cleanedTitle,
    subject,
    year,
    medium,
    paperKind,
    questionType,
    teacherName,
    confidence,
    evidence,
    warnings
  };
}
function calculateDocumentQuality(input) {
  const buffer = input.buffer;
  const pages = input.pages || [];
  const text = String(
    input.text || pages.map((page) => page.text || "").join("\n\n")
  );
  const pageCount = pages.length;
  const nonEmptyPageCount = pages.filter(
    (page) => String(page.text || "").trim().length >= 20
  ).length;
  const textLength = text.length;
  const averageCharactersPerPage = pageCount > 0 ? Math.round(textLength / pageCount) : textLength;
  const validPdfHeader = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const hasEofMarker = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1").includes("%%EOF");
  const unicodeSinhalaCount = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  const controlCount = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  const unicodeSinhalaRatio = textLength > 0 ? unicodeSinhalaCount / textLength : 0;
  const replacementCharacterRatio = textLength > 0 ? replacementCount / textLength : 0;
  const controlCharacterRatio = textLength > 0 ? controlCount / textLength : 0;
  const ocrConfidence = clamp01(Number(input.ocrConfidence ?? 1));
  const lowConfidencePages = pages.filter((page) => {
    const pageText = String(page.text || "").trim();
    const confidence = page.conversionConfidence == null ? ocrConfidence : clamp01(Number(page.conversionConfidence));
    return pageText.length < 40 || confidence < 0.72;
  }).map((page, index) => Number(page.pageNumber || index + 1));
  const pageCoverage = pageCount > 0 ? nonEmptyPageCount / pageCount : textLength > 100 ? 1 : 0;
  const textDensity = clamp01(averageCharactersPerPage / 900);
  const characterHealth = clamp01(
    1 - replacementCharacterRatio * 8 - controlCharacterRatio * 12
  );
  const structureHealth = (validPdfHeader ? 0.6 : 0) + (hasEofMarker ? 0.4 : 0);
  const completenessScore = clamp01(
    pageCoverage * 0.3 + textDensity * 0.2 + characterHealth * 0.2 + ocrConfidence * 0.2 + structureHealth * 0.1
  );
  const warnings = [];
  if (!validPdfHeader)
    warnings.push("File header is not a valid PDF signature.");
  if (!hasEofMarker)
    warnings.push("PDF EOF marker was not found; the file may be truncated.");
  if (pageCount === 0) warnings.push("No pages were extracted.");
  if (pageCoverage < 0.7)
    warnings.push(
      "A significant number of pages contain little or no searchable text."
    );
  if (replacementCharacterRatio > 0.02)
    warnings.push("Extracted text contains many replacement characters.");
  if (ocrConfidence < 0.75)
    warnings.push("OCR confidence is low and should be reviewed.");
  if (lowConfidencePages.length > 0)
    warnings.push(
      `${lowConfidencePages.length} page(s) require OCR/text review.`
    );
  const corruptionRisk = !validPdfHeader || completenessScore < 0.35 ? "high" : !hasEofMarker || completenessScore < 0.68 ? "medium" : "low";
  return {
    fileFingerprint: import_node_crypto2.default.createHash("sha256").update(buffer).digest("hex"),
    fileSizeBytes: buffer.length,
    validPdfHeader,
    hasEofMarker,
    pageCount,
    nonEmptyPageCount,
    textLength,
    averageCharactersPerPage,
    unicodeSinhalaRatio,
    replacementCharacterRatio,
    controlCharacterRatio,
    ocrConfidence,
    completenessScore,
    corruptionRisk,
    needsHumanReview: corruptionRisk !== "low" || lowConfidencePages.length > 0 || ocrConfidence < 0.75,
    lowConfidencePages,
    warnings
  };
}
function calculateTextOnlyQuality(params) {
  const syntheticPdf = Buffer.from(`%PDF-1.7
${params.fingerprintSeed || "text-only-finalization"}
%%EOF`);
  const report = calculateDocumentQuality({
    buffer: syntheticPdf,
    text: params.text,
    pages: params.pages,
    ocrConfidence: params.ocrConfidence
  });
  return {
    ...report,
    fileFingerprint: import_node_crypto2.default.createHash("sha256").update(params.fingerprintSeed || "").update(params.text).digest("hex"),
    warnings: [
      ...report.warnings,
      "Original source buffer was unavailable during background finalization; duplicate fingerprint is text-derived."
    ]
  };
}

// server/pdf/processingPipeline.ts
async function processUploadedPdf(params) {
  let {
    uid,
    sourceId,
    storagePath,
    fileName,
    title,
    subject,
    year,
    resourceType,
    sourceType,
    sourceScope,
    lesson,
    buffer,
    forceOcr = false
  } = params;
  console.log(
    `Starting PDF processing pipeline for sourceId: ${sourceId}, title: "${title}", forceOcr: ${forceOcr}`
  );
  const db = getAdminDb();
  const sourceRef = db.collection("rag_sources").doc(sourceId);
  try {
    if (!buffer) {
      if (!storagePath) {
        throw new Error("Either buffer or storagePath must be provided.");
      }
      console.log(
        `Downloading PDF from ${storagePath} for sourceId: ${sourceId}`
      );
      const bucket = getAdminBucket();
      const file = bucket.file(storagePath);
      const [downloaded] = await file.download();
      buffer = downloaded;
    }
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error(
        "INVALID_PDF_SIGNATURE: The uploaded file is not a valid PDF document."
      );
    }
    let pages = [];
    let fullText = "";
    let needsOcr = false;
    let needsLegacyConversion = false;
    let textEncoding = "unknown";
    let extractionMethod = "pdf_text";
    let ocrConfidence = 1;
    const extraction = await extractPdfText(buffer);
    pages = extraction.pages || [];
    fullText = extraction.text || "";
    needsOcr = extraction.needsOcr;
    needsLegacyConversion = extraction.needsLegacyConversion;
    textEncoding = extraction.textEncoding;
    const textLength = fullText.length;
    const unicodeMatches = fullText.match(/[\u0D80-\u0DFF]/g);
    const unicodeCount = unicodeMatches ? unicodeMatches.length : 0;
    const unicodeSinhalaRatio = textLength > 0 ? unicodeCount / textLength : 0;
    const replacementMatches = fullText.match(/\uFFFD/g);
    const replacementCount = replacementMatches ? replacementMatches.length : 0;
    const replacementCharRatio = textLength > 0 ? replacementCount / textLength : 0;
    const legacyPatterns = [
      "LKavdxl",
      "cHd",
      "\xF1",
      "\xFA",
      "Y%",
      "m%",
      "fuu",
      "fyd",
      "iS",
      "wxl",
      "m%Yak",
      "ms<s;=re",
      "fnda",
      ";dlaIK"
    ];
    let legacyPatternScore = 0;
    legacyPatterns.forEach((pat) => {
      const regex = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const matches = fullText.match(regex);
      if (matches) {
        legacyPatternScore += matches.length;
      }
    });
    const isScanned = textLength < 40 || pages.length === 0;
    const hasHighReplacement = replacementCharRatio > 0.05;
    console.log(`PDF Quality Metrics for ${sourceId}:`, {
      textLength,
      unicodeSinhalaRatio: unicodeSinhalaRatio.toFixed(3),
      replacementCharRatio: replacementCharRatio.toFixed(3),
      legacyPatternScore,
      isScanned,
      hasHighReplacement,
      needsOcr,
      needsLegacyConversion
    });
    let triggerOcr = forceOcr || isScanned || hasHighReplacement;
    if (textEncoding.startsWith("legacy_") || legacyPatternScore > 5) {
      extractionMethod = "legacy_text_layer";
      textEncoding = "legacy_converted_sinhala";
      needsOcr = false;
      needsLegacyConversion = false;
      triggerOcr = Boolean(forceOcr);
      console.log(
        `Legacy Sinhala text layer detected. Keeping ${textLength} extracted characters without OCR.`
      );
    }
    if (triggerOcr) {
      needsOcr = true;
      const isCloudVisionEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true";
      const ocrErrors = [];
      if (isCloudVisionEnabled) {
        console.log(
          `Triggering Cloud Vision OCR fallback for sourceId: ${sourceId}...`
        );
        try {
          const ocrResponse = await runCloudVisionPdfOcr({
            sourceId,
            uid,
            buffer,
            languageHints: ["si", "en"]
          });
          if (ocrResponse.queued) {
            const metaUpdate = {
              ocrStatus: "running",
              indexStatus: "needs_ocr",
              needsOcr: true,
              chunkCount: 0,
              textIndexed: false,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            await sourceRef.set(
              {
                sourceId,
                ownerUid: uid,
                storagePath,
                fileName,
                title,
                subject: normalizeSubject4(subject || ""),
                resourceType,
                sourceType: sourceType || resourceType,
                sourceScope,
                ...metaUpdate
              },
              { merge: true }
            );
            if (sourceScope === "past_paper") {
              await db.collection("past_papers").doc(sourceId).set(
                {
                  id: sourceId,
                  sourceId,
                  ownerUid: uid,
                  sourceScope,
                  ...metaUpdate
                },
                { merge: true }
              ).catch(() => {
              });
            }
            return {
              ok: true,
              status: "queued",
              message: "OCR processing has been queued.",
              chunkCount: 0,
              needsOcr: true,
              extractionMethod: "cloud_vision_ocr"
            };
          }
          if (ocrResponse.result) {
            pages = ocrResponse.result.pages.map((page) => ({
              pageNumber: page.pageNumber,
              text: page.text,
              rawText: page.text,
              textEncoding: "unicode_sinhala",
              conversionApplied: false,
              conversionConfidence: 1
            }));
            fullText = ocrResponse.result.fullText;
            extractionMethod = "cloud_vision_ocr";
            textEncoding = "unicode_sinhala";
            ocrConfidence = ocrResponse.result.confidence;
            needsOcr = false;
            needsLegacyConversion = false;
          }
        } catch (ocrErr) {
          console.error(
            "Cloud Vision OCR operation failed; trying Gemini PDF OCR:",
            ocrErr
          );
          ocrErrors.push(`Cloud Vision: ${ocrErr?.message || String(ocrErr)}`);
        }
      }
      if (needsOcr && isGeminiPdfOcrConfigured()) {
        try {
          const geminiPages = await extractPdfPagesWithGemini(buffer);
          pages = geminiPages.map((page) => ({
            ...page,
            rawText: page.text,
            textEncoding: "unicode_sinhala",
            conversionApplied: false,
            conversionConfidence: 1
          }));
          fullText = geminiPages.map((page) => page.text).join("\n\n");
          extractionMethod = "gemini_pdf_ocr";
          textEncoding = "unicode_sinhala";
          ocrConfidence = 0.85;
          needsOcr = false;
          needsLegacyConversion = false;
          console.log(
            `Gemini PDF OCR completed successfully. Extracted ${pages.length} pages.`
          );
        } catch (ocrErr) {
          console.error("Gemini PDF OCR operation failed:", ocrErr);
          ocrErrors.push(`Gemini: ${ocrErr?.message || String(ocrErr)}`);
        }
      }
      if (needsOcr) {
        const errorMsg = ocrErrors.length > 0 ? `OCR failed. ${ocrErrors.join(" | ")}` : "OCR is required, but neither Cloud Vision nor Gemini PDF OCR is configured.";
        await finalizeFailedProcessing({
          sourceId,
          sourceScope,
          uid,
          errorMsg,
          needsOcr: true,
          needsLegacyConversion: false,
          status: "needs_ocr"
        });
        return {
          ok: false,
          status: "needs_ocr",
          message: errorMsg,
          chunkCount: 0,
          needsOcr: true,
          extractionMethod: "none",
          error: errorMsg
        };
      }
    }
    if (pages.length === 0) {
      const errorMsg = "No pages could be extracted or OCR'd.";
      await finalizeFailedProcessing({
        sourceId,
        sourceScope,
        uid,
        errorMsg,
        needsOcr: true,
        needsLegacyConversion: false,
        status: "needs_ocr"
      });
      return {
        ok: false,
        status: "needs_ocr",
        message: errorMsg,
        chunkCount: 0,
        needsOcr: true,
        extractionMethod: "none"
      };
    }
    const documentMetadata = classifyDocumentMetadata({
      fileName,
      title,
      subject,
      year,
      resourceType,
      text: fullText
    });
    const qualityReport = calculateDocumentQuality({
      buffer,
      text: fullText,
      pages,
      ocrConfidence
    });
    title = documentMetadata.cleanedTitle || title;
    subject = documentMetadata.subject !== "UNKNOWN" ? documentMetadata.subject : subject;
    year = documentMetadata.year || year;
    const finalizeResult = await finalizePipelineProcessing({
      uid,
      sourceId,
      storagePath,
      fileName,
      title,
      subject,
      year,
      resourceType,
      sourceType,
      sourceScope,
      lesson,
      pages,
      extractionMethod,
      textEncoding,
      ocrConfidence,
      needsOcr,
      needsLegacyConversion,
      documentMetadata,
      qualityReport
    });
    return {
      ok: true,
      status: finalizeResult.indexStatus,
      message: `PDF processed successfully with ${finalizeResult.chunkCount} chunks.`,
      chunkCount: finalizeResult.chunkCount,
      needsOcr: finalizeResult.needsOcr,
      extractionMethod
    };
  } catch (err) {
    console.error(
      `Unhandled error in processUploadedPdf pipeline for ${sourceId}:`,
      err
    );
    await finalizeFailedProcessing({
      sourceId,
      sourceScope,
      uid,
      errorMsg: err.message,
      needsOcr: true,
      needsLegacyConversion: false,
      status: "failed"
    });
    return {
      ok: false,
      status: "failed",
      message: err.message,
      chunkCount: 0,
      needsOcr: true,
      extractionMethod: "none",
      error: err.message
    };
  }
}
async function finalizePipelineProcessing(params) {
  const {
    uid,
    sourceId,
    storagePath,
    fileName,
    title,
    subject,
    year,
    resourceType,
    sourceType,
    sourceScope,
    lesson,
    pages,
    extractionMethod,
    textEncoding,
    ocrConfidence,
    needsOcr,
    needsLegacyConversion,
    documentMetadata,
    qualityReport
  } = params;
  const effectiveDocumentMetadata = documentMetadata ?? classifyDocumentMetadata({
    fileName,
    title,
    subject,
    year,
    resourceType,
    text: pages.map((page) => page.text || "").join("\n\n")
  });
  const effectiveQualityReport = qualityReport ?? calculateTextOnlyQuality({
    text: pages.map((page) => page.text || "").join("\n\n"),
    pages,
    ocrConfidence,
    fingerprintSeed: `${sourceId}:${storagePath}`
  });
  const trustedSource = String(sourceScope) === "official";
  const db = getAdminDb();
  const bulkWriter = db.bulkWriter();
  const rag_chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
  rag_chunksSnap.docs.forEach((d) => {
    bulkWriter.delete(d.ref);
  });
  if (sourceScope === "owner_syllabus") {
    const sylChunksSnap = await db.collection("users").doc(uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunksSnap.docs.forEach((d) => {
      bulkWriter.delete(d.ref);
    });
  }
  const chunkText = (text, size = 1e3, overlap = 150) => {
    const chunks = [];
    if (!text) return chunks;
    let i = 0;
    while (i < text.length) {
      const chunk = text.slice(i, i + size);
      chunks.push(chunk);
      i += size - overlap;
      if (size - overlap <= 0) break;
    }
    return chunks;
  };
  let chunkCount = 0;
  const normalizedSubjectKey = normalizeSubject4(subject || "");
  for (const p of pages) {
    const pageText = (p.text || "").trim();
    if (!pageText) continue;
    const pageNum = Number(p.pageNumber || 1);
    const subChunks = chunkText(pageText, 1e3, 150);
    for (let j = 0; j < subChunks.length; j++) {
      const chunkTextContent = subChunks[j];
      const questionNo = detectQuestionNo(chunkTextContent);
      const detectedLesson = lesson?.trim() || detectLessonForChunk(chunkTextContent, normalizedSubjectKey);
      const chunkId = `chunk_${sourceId}_${chunkCount}`;
      const rawPreview = p.rawText ? p.rawText.slice(0, 200) : chunkTextContent.slice(0, 200);
      const cleanedChunkText = chunkTextContent.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
      const chunkDoc = {
        sourceId,
        pageNumber: pageNum,
        questionNo: questionNo || null,
        ownerUid: uid,
        text: cleanedChunkText,
        rawTextPreview: rawPreview,
        textEncoding,
        extractionMethod,
        conversionApplied: p.conversionApplied || false,
        ocrConfidence,
        chunkIndex: chunkCount++,
        title: effectiveDocumentMetadata.cleanedTitle || title,
        fileName,
        subject: normalizedSubjectKey,
        lesson: detectedLesson,
        resourceType,
        sourceType: sourceType || resourceType,
        year: effectiveDocumentMetadata.year || (year ? String(year) : null),
        medium: effectiveDocumentMetadata.medium === "Unknown" ? "Mixed" : effectiveDocumentMetadata.medium,
        tags: [title, subject].filter(Boolean),
        sourceScope,
        visibility: sourceScope === "official" ? "official" : "private",
        embeddingStatus: "none",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      bulkWriter.set(db.collection("rag_chunks").doc(chunkId), chunkDoc);
      if (sourceScope === "owner_syllabus") {
        const sylChunkRef = db.collection("users").doc(uid).collection("syllabus_chunks").doc(chunkId);
        bulkWriter.set(sylChunkRef, { id: chunkId, ...chunkDoc });
      }
    }
  }
  console.log(
    `Generating separate readable Sinhala text PDF (HTML companion) for sourceId: ${sourceId}...`
  );
  const textPdfResponse = await generateSinhalaTextPdf({
    uid,
    sourceId,
    fileName,
    title,
    subject: normalizedSubjectKey,
    year,
    extractionMethod,
    pages: pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text }))
  });
  const finalIndexStatus = computeIndexStatus({
    chunkCount,
    needsOcr,
    needsLegacyConversion,
    textEncoding,
    indexStatus: chunkCount > 0 ? "ready" : "not_indexed"
  });
  const textIndexed = chunkCount > 0 && !needsOcr;
  const metaUpdate = {
    chunkCount,
    needsOcr,
    textIndexed,
    indexStatus: finalIndexStatus,
    needsLegacyConversion,
    textEncoding,
    extractionMethod,
    ocrConfidence,
    ocrStatus: "ready",
    ocrProvider: "cloud_vision",
    ocrTextPdfStoragePath: textPdfResponse.ocrTextPdfStoragePath,
    ocrTextStoragePath: textPdfResponse.ocrTextStoragePath,
    ocrTextPdfStatus: textPdfResponse.ocrTextPdfStatus,
    lesson: lesson?.trim() || null,
    detectedMetadata: effectiveDocumentMetadata,
    fileFingerprint: effectiveQualityReport.fileFingerprint,
    documentQuality: effectiveQualityReport,
    indexedTextCompleteness: effectiveQualityReport.completenessScore,
    needsTextReview: effectiveQualityReport.needsHumanReview,
    lowConfidencePages: effectiveQualityReport.lowConfidencePages,
    processedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await bulkWriter.close();
  console.log(
    `Committed ${chunkCount} chunks to Firestore for source: ${sourceId}`
  );
  const duplicateSnap = await db.collection("rag_sources").where("fileFingerprint", "==", effectiveQualityReport.fileFingerprint).limit(3).get().catch(() => null);
  const duplicateOfSourceId = duplicateSnap?.docs.map((doc) => doc.id).find((id) => id !== sourceId) || null;
  await db.collection("rag_sources").doc(sourceId).set(
    {
      sourceId,
      ownerUid: uid,
      storagePath,
      fileName,
      title,
      subject: normalizedSubjectKey,
      year: year ? String(year) : null,
      resourceType,
      sourceType: sourceType || resourceType,
      sourceScope,
      visibility: sourceScope === "official" ? "official" : "private",
      isDuplicate: Boolean(duplicateOfSourceId),
      duplicateOfSourceId,
      trustedSource,
      ...metaUpdate
    },
    { merge: true }
  );
  if (sourceScope === "past_paper") {
    await db.collection("past_papers").doc(sourceId).set(
      {
        id: sourceId,
        sourceId,
        ownerUid: uid,
        storagePath,
        fileName,
        title,
        subject: normalizedSubjectKey,
        year: year ? String(year) : null,
        resourceType,
        sourceType: sourceType || resourceType,
        sourceScope,
        isDuplicate: Boolean(duplicateOfSourceId),
        duplicateOfSourceId,
        trustedSource,
        ...metaUpdate
      },
      { merge: true }
    ).catch(() => {
    });
  } else if (sourceScope === "owner_syllabus") {
    await db.collection("users").doc(uid).collection("syllabus_resources").doc(sourceId).set(
      {
        id: sourceId,
        sourceId,
        ownerUid: uid,
        storagePath,
        fileName,
        title,
        subject: normalizedSubjectKey,
        year: year ? String(year) : null,
        resourceType,
        sourceType: sourceType || resourceType,
        sourceScope,
        status: finalIndexStatus,
        isDuplicate: Boolean(duplicateOfSourceId),
        duplicateOfSourceId,
        ...metaUpdate
      },
      { merge: true }
    ).catch(() => {
    });
  }
  invalidateInventoryCache(uid);
  return {
    chunkCount,
    indexStatus: finalIndexStatus,
    needsOcr
  };
}
async function finalizeFailedProcessing(params) {
  const {
    sourceId,
    sourceScope,
    uid,
    errorMsg,
    needsOcr,
    needsLegacyConversion,
    status
  } = params;
  const db = getAdminDb();
  const metaUpdate = {
    chunkCount: 0,
    needsOcr,
    textIndexed: false,
    indexStatus: status,
    ocrStatus: "failed",
    ocrError: errorMsg,
    needsLegacyConversion,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.collection("rag_sources").doc(sourceId).set(
    {
      sourceId,
      ownerUid: uid,
      sourceScope,
      ...metaUpdate
    },
    { merge: true }
  ).catch(() => {
  });
  if (sourceScope === "past_paper") {
    await db.collection("past_papers").doc(sourceId).set(
      {
        id: sourceId,
        sourceId,
        ownerUid: uid,
        sourceScope,
        ...metaUpdate
      },
      { merge: true }
    ).catch(() => {
    });
  } else if (sourceScope === "owner_syllabus") {
    await db.collection("users").doc(uid).collection("syllabus_resources").doc(sourceId).set(
      {
        id: sourceId,
        sourceId,
        ownerUid: uid,
        sourceScope,
        status,
        ...metaUpdate
      },
      { merge: true }
    ).catch(() => {
    });
  }
  invalidateInventoryCache(uid);
}

// server/pdf/directPdfQa.ts
init_admin();
init_client();
async function askGeminiDirectPdf(params) {
  const { sourceId, pdfBuffer, prompt, questionId, subject, year } = params;
  const db = getAdminDb();
  if (questionId) {
    const cacheRef = db.collection("pdf_question_cache");
    const cacheSnap = await cacheRef.where("sourceId", "==", sourceId).where("questionId", "==", questionId).limit(1).get();
    if (!cacheSnap.empty) {
      const cachedData = cacheSnap.docs[0].data();
      console.log(`Cache hit for ${sourceId} question ${questionId}`);
      return {
        answer: cachedData.answer,
        cached: true,
        model: "cached"
      };
    }
  }
  console.log(`Calling Gemini Direct PDF QA for source ${sourceId}, prompt length: ${prompt.length}`);
  const ai9 = getAIClient();
  const modelName = "gemini-3.1-pro-preview";
  const systemInstruction = `You are a specialized A/L Technology Tutor for SFT, ET, and ICT in Sri Lanka. 
You are currently reading an uploaded PDF file which is an exam paper, tute, or marking scheme.
Instructions:
- Provide accurate, helpful answers in Sinhala Unicode.
- If the question asks for a specific MCQ answer, find it in the PDF and explain why.
- If the PDF has old Sinhala fonts (legacy fonts like LKavdxl), use your visual understanding to read them correctly and output in Unicode.
- If you cannot find the answer in the provided PDF, state that clearly. Do NOT guess.
- Be precise. Cite page numbers if possible.`;
  const pdfPart = {
    inlineData: {
      mimeType: "application/pdf",
      data: pdfBuffer.toString("base64")
    }
  };
  const textPart = {
    text: prompt
  };
  try {
    const response = await ai9.models.generateContent({
      model: modelName,
      contents: { parts: [pdfPart, textPart] },
      config: {
        systemInstruction,
        temperature: 0.2
        // Lower temperature for more factual answers
      }
    });
    const answer = response.text || "\u0DC3\u0DB8\u0DCF\u0DC0\u0DB1\u0DCA\u0DB1, \u0D91\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0DA7 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAF\u0DD3\u0DB8\u0DA7 \u0DB8\u0DA7 \u0DB1\u0DDC\u0DC4\u0DD0\u0D9A\u0DD2 \u0DC0\u0DD2\u0DBA.";
    if (questionId && answer) {
      await db.collection("pdf_question_cache").add({
        sourceId,
        questionId,
        answer,
        subject: subject || null,
        year: year || null,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return {
      answer,
      cached: false,
      model: modelName
    };
  } catch (err) {
    console.error("Gemini Direct PDF QA Error:", err);
    throw new Error(`Direct PDF QA failed: ${err.message}`);
  }
}

// server/pdf/routes.ts
init_stripVisualBlocks();
init_retrieve();

// server/pdf/syllabusGrounding.ts
init_admin();
init_client();
var CACHE_TTL_MS3 = 15 * 60 * 1e3;
var cache2 = /* @__PURE__ */ new Map();
function configuredSftSyllabusUrl() {
  return String(process.env.SFT_SYLLABUS_PDF_URL || "").trim();
}
function configuredSftSyllabusPath() {
  return String(process.env.SFT_SYLLABUS_STORAGE_PATH || "").trim();
}
async function findSftSyllabusSource(uid) {
  const db = getAdminDb();
  const snapshots = await Promise.allSettled([
    db.collection("users").doc(uid).collection("syllabus_resources").where("subject", "==", "SFT").limit(20).get(),
    db.collection("rag_sources").where("subject", "==", "SFT").where("sourceScope", "==", "owner_syllabus").limit(20).get()
  ]);
  const candidates = [];
  for (const snapshot of snapshots) {
    if (snapshot.status !== "fulfilled") continue;
    snapshot.value.docs.forEach((doc) => candidates.push({ id: doc.id, ...doc.data() }));
  }
  return candidates.find((source) => {
    const text = `${source.title || ""} ${source.fileName || ""} ${source.storagePath || ""}`.toLowerCase();
    return /syllabus|syl_|curriculum/.test(text);
  }) || candidates[0] || null;
}
async function loadGroundingPdf(uid) {
  const configuredUrl = configuredSftSyllabusUrl();
  const configuredPath = storageObjectPath(configuredSftSyllabusPath());
  if (configuredUrl || configuredPath) {
    const storagePath = storageObjectPath(configuredUrl) || configuredPath;
    const verifiedUrl = configuredUrl ? validatedPdfDownloadUrl(configuredUrl, storagePath) : "";
    if (!storagePath || !/\.pdf$/i.test(storagePath) || configuredUrl && !verifiedUrl) {
      console.warn("[SFT_SYLLABUS] Ignoring invalid configured SFT syllabus location.");
    } else {
      const gcsUri2 = isVertexAiEnabled() ? storageGsUri(configuredUrl || configuredSftSyllabusPath(), storagePath) : "";
      if (gcsUri2) {
        return { buffer: null, gcsUri: gcsUri2, sourceId: "configured_sft_syllabus", method: "vertex_gcs_uri" };
      }
      try {
        const loaded = await loadPdfSourceBuffer({
          source: verifiedUrl ? { downloadUrl: verifiedUrl } : null,
          storagePath,
          submittedDownloadUrl: verifiedUrl
        });
        return { buffer: loaded.buffer, sourceId: "configured_sft_syllabus", method: loaded.method };
      } catch (error) {
        throw error;
      }
    }
  }
  const source = await findSftSyllabusSource(uid);
  if (!source?.storagePath) return null;
  const gcsUri = isVertexAiEnabled() ? storageGsUri(source.storagePath) : "";
  if (gcsUri) {
    return {
      buffer: null,
      gcsUri,
      sourceId: source.id || source.sourceId || "sft_syllabus",
      method: "vertex_gcs_uri"
    };
  }
  try {
    const loaded = await loadPdfSourceBuffer({ source, storagePath: source.storagePath });
    return { buffer: loaded.buffer, sourceId: source.id || source.sourceId || "sft_syllabus", method: loaded.method };
  } catch (error) {
    throw error;
  }
}
async function getSftSyllabusGroundingPdf(uid, subject) {
  if (String(subject || "").trim().toUpperCase() !== "SFT") return null;
  const key = `${uid}:SFT:${configuredSftSyllabusUrl() || configuredSftSyllabusPath() ? "configured" : "library"}`;
  const cached = cache2.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = loadGroundingPdf(uid).catch((error) => {
    console.warn("[SFT_SYLLABUS] Grounding PDF unavailable; continuing without fabricated evidence:", String(error?.message || error));
    return null;
  });
  cache2.set(key, { expiresAt: Date.now() + CACHE_TTL_MS3, value });
  return value;
}

// server/pdf/routes.ts
init_client();
init_aiCircuitBreaker();
var pdfRoutes = (0, import_express5.Router)();
var upload2 = (0, import_multer2.default)({ storage: import_multer2.default.memoryStorage() });
function storageObjectPath2(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (value.startsWith("gs://")) {
    return value.replace(/^gs:\/\/[^/]+\//, "");
  }
  if (value.startsWith("https://firebasestorage.googleapis.com")) {
    try {
      const parsed = new URL(value);
      const marker = "/o/";
      const index = parsed.pathname.indexOf(marker);
      return index >= 0 ? decodeURIComponent(parsed.pathname.slice(index + marker.length)) : "";
    } catch {
      return "";
    }
  }
  return value.replace(/^\/+/, "");
}
function canUseStoragePath(user, path5) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const privileged = user?.admin === true || roles.some((role) => ["admin", "content_editor", "ops"].includes(role));
  return privileged || path5.startsWith(`users/${user.uid}/`) || path5.startsWith(`rag_uploads/${user.uid}/`);
}
async function resolveDirectQaSource(user, sourceId, submittedPath, submittedDownloadUrl) {
  const db = getAdminDb();
  const snapshots = await Promise.all([
    sourceId ? db.collection("rag_sources").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("past_papers").doc(sourceId).get() : Promise.resolve(null)
  ]);
  const sourceSnapshot = snapshots.find((snapshot) => snapshot?.exists);
  const source = sourceSnapshot?.data?.() || null;
  const path5 = storageObjectPath2(
    source?.storagePath || submittedPath || source?.downloadUrl || source?.firebaseDownloadUrl || source?.url || submittedDownloadUrl
  );
  if (!path5) throw Object.assign(new Error("PDF source has no valid storage path."), { status: 400, code: "DIRECT_QA_SOURCE_PATH_INVALID" });
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const privileged = user?.admin === true || roles.some((role) => ["admin", "content_editor", "ops"].includes(role));
  const visible = ["public", "official", "shared"].includes(String(source?.visibility || "").toLowerCase()) || ["public", "official", "shared"].includes(String(source?.sourceScope || "").toLowerCase());
  const owned = source?.ownerUid === user.uid || canUseStoragePath(user, path5);
  if (!privileged && !visible && !owned) {
    throw Object.assign(new Error("You do not have access to this PDF source."), { status: 403, code: "DIRECT_QA_SOURCE_FORBIDDEN" });
  }
  const downloadUrl = validatedPdfDownloadUrl(
    submittedDownloadUrl || source?.downloadUrl || source?.url,
    path5
  );
  return { source: { ...source || {}, storagePath: path5 }, path: path5, downloadUrl };
}
pdfRoutes.post("/process-uploaded", requireNonAnonymousUser, import_express5.default.json(), async (req, res) => {
  try {
    const user = req.user;
    const {
      sourceId,
      storagePath,
      title,
      fileName,
      subject,
      year,
      resourceType,
      sourceType,
      sourceScope,
      lesson,
      deferProcessing,
      downloadUrl
    } = req.body;
    if (!sourceId || !storagePath) {
      return res.status(400).json({ ok: false, error: "Missing sourceId or storagePath." });
    }
    const normalizedStoragePath = storageObjectPath2(storagePath);
    if (!normalizedStoragePath || !canUseStoragePath(user, normalizedStoragePath)) {
      return res.status(403).json({ ok: false, error: "Storage path is outside the signed-in user's upload area." });
    }
    const db = getAdminDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const verifiedDownloadUrl = validatedPdfDownloadUrl(downloadUrl, normalizedStoragePath) || null;
    await db.collection("rag_sources").doc(sourceId).set({
      sourceId,
      ownerUid: user.uid,
      storagePath: normalizedStoragePath,
      downloadUrl: verifiedDownloadUrl,
      title: title || fileName || "Uploaded PDF",
      fileName: fileName || "upload.pdf",
      subject: String(subject || "").toUpperCase(),
      lesson: lesson ? String(lesson).trim().slice(0, 180) : null,
      year: year ? String(year) : null,
      resourceType: resourceType || "uploaded_pdf",
      sourceType: sourceType || resourceType || "uploaded_pdf",
      sourceScope: sourceScope || "personal",
      visibility: "private",
      indexStatus: "queued",
      chunkCount: 0,
      needsOcr: false,
      textIndexed: false,
      createdAt: now,
      updatedAt: now
    }, { merge: true });
    if ((sourceScope || "") === "past_paper") {
      await db.collection("past_papers").doc(sourceId).set({
        id: sourceId,
        sourceId,
        ownerUid: user.uid,
        storagePath: normalizedStoragePath,
        downloadUrl: verifiedDownloadUrl,
        title: title || fileName || "Uploaded PDF",
        fileName: fileName || "upload.pdf",
        subject: String(subject || "").toUpperCase(),
        year: year ? String(year) : null,
        resourceType: resourceType || "past_paper",
        sourceType: sourceType || resourceType || "past_paper",
        sourceScope: "past_paper",
        indexStatus: "queued",
        chunkCount: 0,
        needsOcr: false,
        textIndexed: false,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
    }
    if (deferProcessing !== true) setImmediate(() => {
      processUploadedPdf({
        uid: user.uid,
        sourceId,
        storagePath: normalizedStoragePath,
        fileName: fileName || "upload.pdf",
        title: title || fileName || "Uploaded PDF",
        subject,
        year: year || null,
        resourceType: resourceType || "uploaded_pdf",
        sourceType: sourceType || resourceType || "uploaded_pdf",
        sourceScope: sourceScope || "personal",
        lesson: lesson ? String(lesson).trim().slice(0, 180) : void 0,
        forceOcr: false
      }).catch((err) => console.error("Async processUploadedPdf error:", err));
    });
    return res.json({
      ok: true,
      status: deferProcessing === true ? "awaiting_client_file" : "queued",
      message: deferProcessing === true ? "Source registered; awaiting direct client file hand-off" : "Processing queued",
      sourceId
    });
  } catch (err) {
    console.error("Error in process-uploaded route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.post("/reprocess/:sourceId", requireNonAnonymousUser, upload2.single("file"), async (req, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();
    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }
    const srcData = sourceSnap.data();
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const privileged = user?.admin === true || roles.some((role) => ["admin", "content_editor", "ops"].includes(role));
    if (srcData.ownerUid !== user.uid && !privileged) {
      return res.status(403).json({ ok: false, error: "You do not have permission to reprocess this source." });
    }
    let buffer;
    if (req.file) {
      buffer = req.file.buffer;
    } else {
      const storagePath = srcData.storagePath;
      if (!storagePath) {
        return res.status(400).json({ ok: false, error: "Source has no original PDF storage path." });
      }
      console.log(`Downloading original file from GCS: ${storagePath} to reprocess...`);
      const bucket = getAdminBucket();
      const file = bucket.file(storagePath);
      const [downloaded] = await file.download();
      buffer = downloaded;
    }
    const result = await processUploadedPdf({
      uid: srcData.ownerUid || user.uid,
      sourceId,
      storagePath: srcData.storagePath,
      fileName: srcData.fileName,
      title: srcData.title,
      subject: srcData.subject,
      year: srcData.year,
      resourceType: srcData.resourceType || "uploaded_pdf",
      sourceType: srcData.sourceType || "uploaded_pdf",
      sourceScope: srcData.sourceScope || "personal",
      buffer,
      forceOcr: true
      // repocess always forces OCR
    });
    return res.json(result);
  } catch (err) {
    console.error("Error in reprocess route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.get("/ocr-status/:sourceId", requireFirebaseUser, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }
    const src = sourceSnap.data();
    const job = await checkOcrJobStatus(sourceId);
    if (job.status === "ready" && job.result) {
      console.log(`Background OCR job became ready. Running finalization for ${sourceId}`);
      await finalizePipelineProcessing({
        uid: src.ownerUid,
        sourceId,
        storagePath: src.storagePath,
        fileName: src.fileName,
        title: src.title,
        subject: src.subject,
        year: src.year,
        resourceType: src.resourceType || "uploaded_pdf",
        sourceScope: src.sourceScope || "personal",
        pages: job.result.pages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
          rawText: p.text,
          textEncoding: "unicode_sinhala",
          conversionApplied: false,
          conversionConfidence: 1
        })),
        extractionMethod: "cloud_vision_ocr",
        textEncoding: "unicode_sinhala",
        ocrConfidence: job.result.confidence,
        needsOcr: false,
        needsLegacyConversion: false
      });
      const updatedSnap = await db.collection("rag_sources").doc(sourceId).get();
      const updatedSrc = updatedSnap.data();
      return res.json({
        ok: true,
        sourceId,
        ocrStatus: "ready",
        indexStatus: updatedSrc.indexStatus,
        chunkCount: updatedSrc.chunkCount,
        textIndexed: updatedSrc.textIndexed,
        needsOcr: updatedSrc.needsOcr,
        extractionMethod: updatedSrc.extractionMethod,
        ocrTextPdfStoragePath: updatedSrc.ocrTextPdfStoragePath,
        ocrTextPdfStatus: updatedSrc.ocrTextPdfStatus
      });
    }
    return res.json({
      ok: true,
      sourceId,
      ocrStatus: job.status,
      indexStatus: src.indexStatus || "not_indexed",
      chunkCount: src.chunkCount || 0,
      textIndexed: src.textIndexed || false,
      needsOcr: src.needsOcr || false,
      extractionMethod: src.extractionMethod || "none",
      ocrTextPdfStoragePath: src.ocrTextPdfStoragePath || null,
      ocrTextPdfStatus: src.ocrTextPdfStatus || "disabled",
      error: job.error || null
    });
  } catch (err) {
    console.error("Error in ocr-status route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.get("/ocr-text/:sourceId", requireFirebaseUser, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }
    const source = sourceSnap.data();
    const uid = source.ownerUid;
    const bucket = getAdminBucket();
    const safeFileName = source.fileName ? source.fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\u0D80-\u0DFF-]/g, "_") : "document";
    const jsonStoragePath = `users/${uid}/ocr_text/${sourceId}/pages.json`;
    const jsonFile = bucket.file(jsonStoragePath);
    const [exists] = await jsonFile.exists();
    if (exists) {
      const [downloaded] = await jsonFile.download();
      const parsed = JSON.parse(downloaded.toString("utf8"));
      return res.json({
        ok: true,
        source,
        pages: parsed.pages || []
      });
    }
    const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const pageMap = /* @__PURE__ */ new Map();
    chunksSnap.docs.forEach((d) => {
      const chunk = d.data();
      const pageNum = chunk.pageNumber || 1;
      const current = pageMap.get(pageNum) || "";
      pageMap.set(pageNum, current + (current ? "\n\n" : "") + chunk.text);
    });
    const pages = Array.from(pageMap.entries()).map(([pageNumber, text]) => ({
      pageNumber,
      text,
      confidence: 1,
      method: source.extractionMethod || "pdf_text"
    })).sort((a, b) => a.pageNumber - b.pageNumber);
    return res.json({
      ok: true,
      source,
      pages
    });
  } catch (err) {
    console.error("Error in ocr-text route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
var inFlightDirectQa = /* @__PURE__ */ new Map();
var failedDirectQaCooldown = /* @__PURE__ */ new Map();
function directQaHttpError(error) {
  const code = String(error?.code || error?.errorCode || "DIRECT_QA_BACKEND_FAILED");
  const sourceDownloadFailed = code === "DIRECT_QA_SOURCE_DOWNLOAD_FAILED";
  return {
    status: Number(error?.status) || (sourceDownloadFailed ? 424 : 500),
    body: {
      ok: false,
      found: false,
      errorCode: code,
      stage: error?.stage || (sourceDownloadFailed ? "SOURCE_DOWNLOAD" : "MODEL_CALL"),
      message: sourceDownloadFailed ? "PDF source \u0D91\u0D9A direct read \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DBB\u0DD2 \u0DC0\u0DD4\u0DAB\u0DCF. Source access/IAM settings \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF \u0D9A\u0DBB \u0DB1\u0DD0\u0DC0\u0DAD \u0D8B\u0DAD\u0DCA\u0DC3\u0DCF\u0DC4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1." : error?.message || "Direct PDF QA failed"
    }
  };
}
pdfRoutes.post("/direct-qa-file", requireNonAnonymousUser, upload2.single("file"), async (req, res) => {
  try {
    const {
      sourceId,
      storagePath,
      downloadUrl,
      prompt,
      questionId,
      questionNo,
      questionType,
      subject,
      year,
      scanMode,
      interactionMode,
      quizStartQuestionNo,
      quizEndQuestionNo
    } = req.body;
    console.log(`[DirectPDFQA] Received request for sourceId: ${sourceId}, questionNo: ${questionNo}, scanMode: ${scanMode || "full_paper"}, interactionMode: ${interactionMode || "answer"}`);
    const idempotencyKey = `${req.user.uid}:${sourceId}:${questionType}:${questionNo}:${interactionMode || "answer"}`;
    const cooldownUntil = failedDirectQaCooldown.get(idempotencyKey);
    if (cooldownUntil && Date.now() < cooldownUntil || isAiBillingCircuitOpen()) {
      return res.status(429).json({
        ok: false,
        found: false,
        errorCode: "AI_BILLING_EXHAUSTED",
        stage: "AI_UNAVAILABLE",
        message: "AI credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DB1\u0DD2\u0DC3\u0DCF Direct PDF QA run \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DC4\u0DD0.",
        canRetry: false,
        billing: getAiBillingState()
      });
    }
    if (inFlightDirectQa.has(idempotencyKey)) {
      console.log(`[DirectPDFQA] Duplicate request detected for ${idempotencyKey}, attaching to existing promise.`);
      try {
        const result = await inFlightDirectQa.get(idempotencyKey);
        if (result.status) {
          const { status, ...rest } = result;
          return res.status(status).json(rest);
        }
        return res.json(result);
      } catch (e) {
        const mapped = directQaHttpError(e);
        return res.status(mapped.status).json(mapped.body);
      }
    }
    const requestPromise = async () => {
      let buffer = null;
      let resolvedSource = null;
      if (req.file) {
        buffer = req.file.buffer;
        console.log(`[DirectPDFQA] File received via upload. Buffer size: ${req.file.buffer.length} bytes`);
      } else {
        const resolved = await resolveDirectQaSource(req.user, sourceId, storagePath, downloadUrl);
        resolvedSource = resolved.source || {};
        resolvedSource.__resolvedStoragePath = resolved.path;
        resolvedSource.__verifiedDownloadUrl = resolved.downloadUrl;
      }
      const effectivePrompt = prompt?.trim() || `${year || ""} ${subject || ""} ${questionType || "question"} ${questionNo} answer`;
      if (!questionNo || !questionType) {
        console.error("[DirectPDFQA] Missing questionNo or questionType");
        return {
          ok: false,
          status: 400,
          found: false,
          errorCode: "DIRECT_QA_MISSING_STRUCTURED_INTENT",
          stage: "VALIDATION",
          message: "Direct PDF QA requires questionNo and questionType."
        };
      }
      if (questionNo && questionType) {
        const allowOfficialAnswer = [
          resolvedSource?.resourceType,
          resolvedSource?.sourceType,
          resolvedSource?.sourceScope
        ].some((value) => String(value || "").toLowerCase().includes("marking")) || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || ""));
        console.log(`[DirectPDFQA] Using structured extraction for ${questionType} ${questionNo}`);
        const { askGeminiDirectPdfStructured: askGeminiDirectPdfStructured2, askIndexedPdfQuestionStructured: askIndexedPdfQuestionStructured2 } = await Promise.resolve().then(() => (init_directPdfQa(), directPdfQa_exports));
        const syllabusGrounding = await getSftSyllabusGroundingPdf(req.user.uid, subject);
        let result2;
        const runFullPaperVisualScan = async () => {
          const sourceGcsUri = isVertexAiEnabled() ? storageGsUri(resolvedSource.__resolvedStoragePath) : "";
          if (sourceGcsUri) {
            return askGeminiDirectPdfStructured2({
              uid: req.user.uid,
              sourceId,
              pdfGcsUri: sourceGcsUri,
              year: year || "unknown",
              subject: subject || "unknown",
              questionType,
              questionNo,
              prompt: effectivePrompt,
              allowOfficialAnswer,
              syllabusPdfBuffer: syllabusGrounding?.buffer,
              syllabusPdfGcsUri: syllabusGrounding?.gcsUri
            });
          }
          const loaded = await loadPdfSourceBuffer({
            source: resolvedSource,
            storagePath: resolvedSource.__resolvedStoragePath,
            submittedDownloadUrl: resolvedSource.__verifiedDownloadUrl
          });
          return askGeminiDirectPdfStructured2({
            uid: req.user.uid,
            sourceId,
            pdfBuffer: loaded.buffer,
            year: year || "unknown",
            subject: subject || "unknown",
            questionType,
            questionNo,
            prompt: effectivePrompt,
            allowOfficialAnswer,
            syllabusPdfBuffer: syllabusGrounding?.buffer,
            syllabusPdfGcsUri: syllabusGrounding?.gcsUri
          });
        };
        if (!req.file) {
          const indexed = await retrieveExactPaperQuestion({
            uid: req.user.uid,
            sourceId,
            subject,
            year,
            questionNo,
            questionType
          });
          const fullPaperChunks = Array.isArray(indexed.allChunks) && indexed.allChunks.length > 0 ? indexed.allChunks : indexed.chunks;
          const canTrustFullPaperIndex = !indexed.badTextQuality && !indexed.needsOcr && !indexed.needsLegacyConversion && fullPaperChunks.length > 0;
          if (canTrustFullPaperIndex) {
            result2 = await askIndexedPdfQuestionStructured2({
              uid: req.user.uid,
              sourceId,
              chunks: fullPaperChunks,
              year: year || "unknown",
              subject: subject || "unknown",
              questionType,
              questionNo,
              allowOfficialAnswer,
              syllabusPdfBuffer: syllabusGrounding?.buffer,
              syllabusPdfGcsUri: syllabusGrounding?.gcsUri
            });
            if (result2?.errorCode === "FULL_PAPER_VISUAL_SCAN_REQUIRED") {
              console.log(`[DirectPDFQA] OCR index could not isolate Q${questionNo}; scanning the complete original PDF visually.`);
              result2 = await runFullPaperVisualScan();
            }
          } else {
            console.log(`[DirectPDFQA] Searchable full-paper index unavailable; scanning the complete original PDF visually.`);
            result2 = await runFullPaperVisualScan();
          }
        } else {
          result2 = await askGeminiDirectPdfStructured2({
            uid: req.user.uid,
            sourceId: sourceId || "uploaded_temp",
            pdfBuffer: buffer,
            year: year || "unknown",
            subject: subject || "unknown",
            questionType,
            questionNo,
            prompt: effectivePrompt,
            allowOfficialAnswer,
            syllabusPdfBuffer: syllabusGrounding?.buffer,
            syllabusPdfGcsUri: syllabusGrounding?.gcsUri
          });
        }
        console.log(`[DirectPDFQA] Structured extraction result: ${result2.found ? "FOUND" : "NOT_FOUND"}`);
        if (!result2.ok || !result2.found || !result2.sourceEvidence?.questionText) {
          const isRequire = result2.errorCode === "AI_CLIENT_RUNTIME_ERROR" || result2.error && String(result2.error).includes("require is not defined");
          const isBilling = result2.errorCode === "AI_BILLING_EXHAUSTED" || result2.error && (String(result2.error).includes("depleted") || String(result2.error).includes("credits") || String(result2.error).includes("billing") || String(result2.error).includes("RESOURCE_EXHAUSTED"));
          const isRateLimit = result2.errorCode === "AI_RATE_LIMITED";
          if (isBilling || result2.errorCode === "AI_BILLING_EXHAUSTED") {
            failedDirectQaCooldown.set(idempotencyKey, Date.now() + 10 * 60 * 1e3);
            return {
              ok: false,
              found: false,
              errorCode: "AI_BILLING_EXHAUSTED",
              stage: "MODEL_CALL",
              reason: "AI billing exhausted. PDF was not fully analyzed by Gemini.",
              message: "AI credits \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DB1\u0DD2\u0DC3\u0DCF PDF scan/answer generation complete \u0DC0\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0.",
              canRetry: false
            };
          }
          return {
            ok: false,
            status: result2.errorCode === "PDF_REINDEX_REQUIRED" ? 409 : void 0,
            found: false,
            errorCode: isRequire ? "AI_CLIENT_RUNTIME_ERROR" : isRateLimit ? "AI_RATE_LIMITED" : result2.errorCode || "EXACT_QUESTION_EVIDENCE_MISSING",
            stage: result2.stage || "MODEL_CALL",
            reason: isRequire ? "AI client runtime error: require is not defined" : isRateLimit ? "AI rate limit hit. Please retry in a moment." : result2.reason || "Question evidence not found in PDF.",
            error: result2.error
          };
        }
        if (interactionMode === "quiz_question") {
          const solved = result2.answer?.solvedAnswer || null;
          const officialText = String(result2.answer?.officialAnswer || "").trim();
          const officialNo = officialText.match(/(?:^|\()\s*([1-5])\s*(?:\)|[.)]|$)/)?.[1] || null;
          const optionNo = String(solved?.optionNo || officialNo || "").trim();
          if (!/^[1-5]$/.test(optionNo)) {
            return {
              ok: false,
              found: false,
              errorCode: "MCQ_SOLVER_EMPTY",
              stage: "QUIZ_ANSWER_PREPARATION",
              reason: "The question was extracted, but its correct option could not be stored safely for quiz evaluation."
            };
          }
          const { attachPaperMcqQuizQuestion: attachPaperMcqQuizQuestion2 } = await Promise.resolve().then(() => (init_paperMcqQuiz(), paperMcqQuiz_exports));
          const quizState = await attachPaperMcqQuizQuestion2({
            uid: req.user.uid,
            sourceId,
            year: year || "unknown",
            subject: subject || "unknown",
            questionNo: Number(questionNo),
            pageNumber: result2.sourceEvidence?.pageNumber ?? null,
            questionText: result2.sourceEvidence.questionText,
            options: Array.isArray(result2.sourceEvidence.options) ? result2.sourceEvidence.options : [],
            optionNo,
            optionText: solved?.optionText || null,
            explanationSinhala: solved?.explanationSinhala || result2.answer?.explanationSinhala || null,
            lesson: result2.answer?.lesson || null
          });
          if (!quizState) {
            return {
              ok: false,
              found: false,
              errorCode: "QUIZ_SESSION_STALE",
              stage: "QUIZ_STATE",
              reason: "The active quiz changed before this question finished loading."
            };
          }
          return {
            ok: true,
            found: true,
            sourceEvidence: result2.sourceEvidence,
            quiz: {
              interactionMode: "quiz_question",
              questionNo: Number(questionNo),
              startQuestionNo: Number(quizStartQuestionNo || quizState.startQuestionNo),
              endQuestionNo: Number(quizEndQuestionNo || quizState.endQuestionNo),
              year: quizState.year,
              subject: quizState.subject
            },
            answer: { quizQuestion: true },
            confidence: result2.confidence,
            reason: result2.reason
          };
        }
        return {
          ok: true,
          ...result2
        };
      }
      console.log("[DirectPDFQA] Using general extraction");
      if (!buffer) {
        return {
          ok: false,
          status: 400,
          errorCode: "DIRECT_QA_MISSING_STRUCTURED_INTENT",
          message: "Select a question number before asking from a saved PDF."
        };
      }
      const result = await askGeminiDirectPdf({
        sourceId: sourceId || "uploaded_temp",
        pdfBuffer: buffer,
        prompt: effectivePrompt,
        questionId,
        subject,
        year
      });
      if (result.answer) {
        result.answer = stripRawVisualBlocks(result.answer);
      }
      console.log(`[DirectPDFQA] General extraction result: ${result.answer ? "SUCCESS" : "EMPTY"}`);
      return {
        ok: true,
        ...result
      };
    };
    inFlightDirectQa.set(idempotencyKey, requestPromise());
    try {
      const result = await inFlightDirectQa.get(idempotencyKey);
      if (result && result.errorCode === "AI_BILLING_EXHAUSTED") {
        setTimeout(() => {
          inFlightDirectQa.delete(idempotencyKey);
        }, 10 * 60 * 1e3);
      } else {
        inFlightDirectQa.delete(idempotencyKey);
      }
      if (result.status) {
        const { status, ...rest } = result;
        return res.status(status).json(rest);
      }
      return res.json(result);
    } catch (err) {
      inFlightDirectQa.delete(idempotencyKey);
      throw err;
    }
  } catch (err) {
    console.error("[DirectPDFQA] Backend error:", err);
    const mapped = directQaHttpError(err);
    return res.status(mapped.status).json(mapped.body);
  }
});
pdfRoutes.get("/question-cache", requireFirebaseUser, async (req, res) => {
  try {
    const { sourceId } = req.query;
    if (!sourceId) return res.status(400).json({ ok: false, error: "Missing sourceId" });
    const db = getAdminDb();
    const cacheSnap = await db.collection("pdf_question_cache").where("sourceId", "==", sourceId).orderBy("updatedAt", "desc").get();
    const items = cacheSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    return res.json({
      ok: true,
      sourceId,
      items
    });
  } catch (err) {
    console.error("Error in question-cache route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.post("/question-cache/:docId/reject", requireFirebaseUser, async (req, res) => {
  try {
    const { docId } = req.params;
    const db = getAdminDb();
    await db.collection("pdf_question_cache").doc(docId).update({
      validationStatus: "rejected",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.post("/question-cache/:docId/resolve", requireFirebaseUser, async (req, res) => {
  try {
    const { docId } = req.params;
    const db = getAdminDb();
    const doc = await db.collection("pdf_question_cache").doc(docId).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: "Cache not found" });
    const data = doc.data();
    if (!data.questionText || !data.options) {
      return res.status(400).json({ ok: false, error: "Missing question text or options for solving" });
    }
    const { solveExtractedMcqQuestion: solveExtractedMcqQuestion2 } = await Promise.resolve().then(() => (init_solveExtractedQuestion(), solveExtractedQuestion_exports));
    const solved = await solveExtractedMcqQuestion2({
      questionText: data.questionText,
      options: data.options,
      subject: data.subject || "SFT",
      year: data.year || "unknown",
      questionNo: data.questionNo || ""
    });
    if (solved) {
      await db.collection("pdf_question_cache").doc(docId).update({
        solvedAnswer: solved,
        explanationSinhala: solved.explanationSinhala,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return res.json({ ok: true, solved });
    }
    return res.status(500).json({ ok: false, error: "Solver failed to return result" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.get("/verified-answers/:sourceId", requireFirebaseUser, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const snap = await db.collection("verified_answers").where("sourceId", "==", sourceId).get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.post("/verified-answers", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = user.roles?.includes("admin") || user.admin === true;
    if (!isAdmin) return res.status(403).json({ ok: false, error: "Admin only" });
    const { sourceId, questionType, questionNo, ...data } = req.body;
    if (!sourceId || !questionType || !questionNo) {
      return res.status(400).json({ ok: false, error: "Missing identification fields" });
    }
    const db = getAdminDb();
    const docId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
    const verifiedDoc = {
      ...data,
      sourceId,
      questionType,
      questionNo,
      verifiedBy: user.uid,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "verified"
    };
    await db.collection("verified_answers").doc(docId).set(verifiedDoc, { merge: true });
    return res.json({ ok: true, id: docId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.get("/sources", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    const isAdmin = user.roles?.includes("admin") || user.admin === true;
    let query = db.collection("rag_sources");
    if (!isAdmin) {
      query = query.where("ownerUid", "==", user.uid);
    }
    const snap = await query.orderBy("createdAt", "desc").get();
    const sources = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ ok: true, sources });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});
pdfRoutes.post("/admin/repair-source/:sourceId", requireFirebaseUser, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const canRepair = req.user?.admin === true || roles.some((role) => ["admin", "content_editor", "ops"].includes(role));
    if (!canRepair) {
      return res.status(403).json({ ok: false, code: "ADMIN_REQUIRED", message: "Admin or content-editor access is required." });
    }
    const db = getAdminDb();
    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }
    const src = sourceSnap.data();
    await db.collection("rag_sources").doc(sourceId).update({
      indexStatus: "queued",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    setImmediate(() => {
      processUploadedPdf({
        uid: src.ownerUid,
        sourceId,
        storagePath: src.storagePath,
        fileName: src.fileName,
        title: src.title,
        subject: src.subject,
        year: src.year,
        resourceType: src.resourceType || "uploaded_pdf",
        sourceType: src.sourceType || "uploaded_pdf",
        sourceScope: src.sourceScope || "personal",
        forceOcr: req.body.forceOcr === true
      }).catch((err) => console.error("Async repair error:", err));
    });
    return res.json({ ok: true, message: "Repair queued." });
  } catch (err) {
    console.error("Error in repair endpoint:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// server/routes/examIntelRoutes.ts
var import_express6 = require("express");
init_admin();

// server/ai-core/pdf/indexing.ts
init_retry();
var import_genai4 = require("@google/genai");
init_admin();
var import_storage3 = require("firebase-admin/storage");
init_client();
var ai = getAIClient();
async function buildExamIndex() {
  const db = getAdminDb();
  const storage = (0, import_storage3.getStorage)();
  const sourcesSnap = await db.collection("rag_sources").get();
  const sources = sourcesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const results = [];
  for (const source of sources) {
    try {
      const file = storage.bucket().file(source.storagePath);
      const [buffer] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());
      const prompt = `
        Analyze this PDF which is an exam paper for ${source.subject}.
        Extract all questions including MCQ, Structured, and Essay questions.
        For each question, identify the lesson, subtopic, marks, and skill type.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { text: prompt },
          { inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" } }
        ],
        config: {
          systemInstruction: "You are a professional exam paper digitizer. Extract questions into the specified JSON format.",
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai4.Type.ARRAY,
            items: {
              type: import_genai4.Type.OBJECT,
              properties: {
                questionNo: { type: import_genai4.Type.INTEGER },
                partNo: { type: import_genai4.Type.STRING },
                questionType: { type: import_genai4.Type.STRING, enum: ["MCQ", "Structured", "Essay", "Practical", "Drawing", "Calculation", "Diagram", "Theory"] },
                marks: { type: import_genai4.Type.NUMBER },
                compulsory: { type: import_genai4.Type.BOOLEAN },
                lesson: { type: import_genai4.Type.STRING },
                subtopic: { type: import_genai4.Type.STRING },
                concept: { type: import_genai4.Type.STRING },
                skillType: { type: import_genai4.Type.STRING, enum: ["memory", "understanding", "calculation", "diagram", "application", "comparison", "explanation", "data interpretation"] },
                questionText: { type: import_genai4.Type.STRING },
                options: { type: import_genai4.Type.ARRAY, items: { type: import_genai4.Type.STRING } },
                answer: { type: import_genai4.Type.STRING },
                markingPoints: { type: import_genai4.Type.ARRAY, items: { type: import_genai4.Type.STRING } },
                pageNumber: { type: import_genai4.Type.INTEGER }
              },
              required: ["questionNo", "questionType", "lesson", "questionText"]
            }
          }
        }
      });
      const questions = JSON.parse(response.text || "[]");
      const batch = db.batch();
      for (const q of questions) {
        const questionId = `${source.id}_${q.questionNo}_${q.partNo || "main"}`;
        const ref = db.collection("exam_question_index").doc(questionId);
        batch.set(ref, {
          ...q,
          sourceId: source.id,
          sourceTitle: source.title,
          subject: source.subject,
          year: source.year || "unknown",
          paperType: source.type || "past_paper",
          extractionMethod: "gemini-3.5-flash",
          confidence: 0.9,
          verified: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      await batch.commit();
      results.push({ sourceId: source.id, count: questions.length });
    } catch (err) {
      console.error(`Failed to index source ${source.id}:`, err);
      results.push({ sourceId: source.id, error: String(err) });
    }
  }
  return results;
}

// server/ai-core/exam-intel/probabilityRanker.ts
var import_genai5 = require("@google/genai");
init_admin();
init_client();
var ai2 = getAIClient();
async function rankTopicProbability(subject) {
  const db = getAdminDb();
  const reportSnap = await db.collection("exam_pattern_reports").doc(subject).get();
  const patternData = reportSnap.exists ? reportSnap.data() : null;
  const syllabusSnap = await db.collection("syllabus_nodes").where("subject", "==", subject).get();
  const syllabusNodes = syllabusSnap.docs.map((d) => d.data());
  const prompt = `
    Analyze the exam patterns and syllabus for ${subject}.
    
    Pattern Data: ${JSON.stringify(patternData)}
    Syllabus Structure: ${JSON.stringify(syllabusNodes)}
    
    Rank the probability of topics appearing in the 2026 exam.
    Consider:
    1. Syllabus weight
    2. Past frequency
    3. Recency
    4. Rotation pattern
    5. Not asked recently
    
    Return a list of rankings.
  `;
  const response = await ai2.models.generateContent({
    model: "gemini-3.1-pro-preview",
    // Use Pro for complex reasoning
    contents: prompt,
    config: {
      systemInstruction: "You are an advanced exam intelligence architect. Output evidence-based probability rankings in JSON. Do not claim exact prediction.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai5.Type.ARRAY,
        items: {
          type: import_genai5.Type.OBJECT,
          properties: {
            topic: { type: import_genai5.Type.STRING },
            subject: { type: import_genai5.Type.STRING },
            lesson: { type: import_genai5.Type.STRING },
            probability: { type: import_genai5.Type.STRING, enum: ["Very High", "High", "Medium", "Low"] },
            confidence: { type: import_genai5.Type.NUMBER },
            evidence: {
              type: import_genai5.Type.ARRAY,
              items: {
                type: import_genai5.Type.OBJECT,
                properties: {
                  year: { type: import_genai5.Type.INTEGER },
                  question: { type: import_genai5.Type.STRING },
                  reason: { type: import_genai5.Type.STRING }
                }
              }
            },
            studentPriority: { type: import_genai5.Type.STRING, enum: ["Must study today", "This week", "Later"] },
            riskIfSkipped: { type: import_genai5.Type.STRING, enum: ["High", "Medium", "Low"] }
          },
          required: ["topic", "subject", "lesson", "probability", "confidence", "evidence", "studentPriority", "riskIfSkipped"]
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

// server/ai-core/exam-intel/unaskedTopicDetector.ts
var import_genai6 = require("@google/genai");
init_admin();
init_client();
var ai3 = getAIClient();
async function detectUnaskedTopics(subject) {
  const db = getAdminDb();
  const syllabusSnap = await db.collection("syllabus_nodes").where("subject", "==", subject).get();
  const syllabus = syllabusSnap.docs.map((d) => d.data());
  const questionsSnap = await db.collection("exam_question_index").where("subject", "==", subject).get();
  const coveredQuestions = questionsSnap.docs.map((d) => d.data());
  const prompt = `
    Compare the syllabus with the questions asked in the past.
    
    Syllabus: ${JSON.stringify(syllabus)}
    Covered Questions: ${JSON.stringify(coveredQuestions)}
    
    Identify topics or subtopics that have NEVER been asked or are RARELY asked.
    Assess their importance based on syllabus weight.
  `;
  const response = await ai3.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are a senior syllabus auditor. Identify unasked and rare topics in JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai6.Type.OBJECT,
        properties: {
          subject: { type: import_genai6.Type.STRING },
          unaskedTopics: { type: import_genai6.Type.ARRAY, items: { type: import_genai6.Type.STRING } },
          rarelyAskedTopics: { type: import_genai6.Type.ARRAY, items: { type: import_genai6.Type.STRING } },
          lastAppeared: { type: import_genai6.Type.ARRAY, items: { type: import_genai6.Type.OBJECT, properties: { topic: { type: import_genai6.Type.STRING }, year: { type: import_genai6.Type.STRING } } } },
          syllabusImportance: { type: import_genai6.Type.ARRAY, items: { type: import_genai6.Type.OBJECT, properties: { topic: { type: import_genai6.Type.STRING }, weight: { type: import_genai6.Type.NUMBER } } } },
          predictionWeight: { type: import_genai6.Type.ARRAY, items: { type: import_genai6.Type.OBJECT, properties: { topic: { type: import_genai6.Type.STRING }, weight: { type: import_genai6.Type.NUMBER } } } }
        },
        required: ["subject", "unaskedTopics", "rarelyAskedTopics", "lastAppeared", "syllabusImportance", "predictionWeight"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

// server/ai-core/exam-intel/predictedPaper.ts
var import_genai7 = require("@google/genai");
init_admin();
init_client();
var ai4 = getAIClient();
async function generatePredictedPaper(params) {
  const db = getAdminDb();
  const reportSnap = await db.collection("exam_pattern_reports").doc(params.subject).get();
  const patternData = reportSnap.exists ? reportSnap.data() : null;
  let studentWeakness = null;
  if (params.studentUid) {
    const forecastSnap = await db.collection("users").doc(params.studentUid).collection("forecasts").orderBy("updatedAt", "desc").limit(1).get();
    if (!forecastSnap.empty) {
      studentWeakness = forecastSnap.docs[0].data().mustFix;
    }
  }
  const prompt = `
    Generate a Predicted Exam Paper for ${params.subject} in ${params.mode} mode.
    
    Pattern Data: ${JSON.stringify(patternData)}
    Student Weakness: ${JSON.stringify(studentWeakness)}
    
    Modes:
    - safe: high frequency + syllabus weight
    - balanced: high frequency + medium rotation + student weak areas
    - surprise: rare but syllabus-important topics
    
    Include:
    - questions
    - answer key
    - evidence citation for each prediction
    - confidence report
  `;
  const response = await ai4.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert exam predictor. Generate a simulated revision paper in JSON. Always cite evidence. Do not claim it will appear exactly.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai7.Type.OBJECT,
        properties: {
          paperMode: { type: import_genai7.Type.STRING },
          questions: {
            type: import_genai7.Type.ARRAY,
            items: {
              type: import_genai7.Type.OBJECT,
              properties: {
                questionNo: { type: import_genai7.Type.INTEGER },
                text: { type: import_genai7.Type.STRING },
                options: { type: import_genai7.Type.ARRAY, items: { type: import_genai7.Type.STRING } },
                marks: { type: import_genai7.Type.NUMBER },
                lesson: { type: import_genai7.Type.STRING },
                subtopic: { type: import_genai7.Type.STRING }
              }
            }
          },
          answerKey: { type: import_genai7.Type.ARRAY, items: { type: import_genai7.Type.STRING } },
          evidenceMap: {
            type: import_genai7.Type.ARRAY,
            items: {
              type: import_genai7.Type.OBJECT,
              properties: {
                questionNo: { type: import_genai7.Type.INTEGER },
                evidence: { type: import_genai7.Type.STRING },
                confidence: { type: import_genai7.Type.NUMBER }
              }
            }
          },
          confidenceReport: { type: import_genai7.Type.ARRAY, items: { type: import_genai7.Type.STRING } }
        },
        required: ["paperMode", "questions", "answerKey", "evidenceMap", "confidenceReport"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

// server/routes/examIntelRoutes.ts
var router = (0, import_express6.Router)();
router.post("/build-index", async (req, res) => {
  try {
    await requireAdmin(req);
    const results = await buildExamIndex();
    res.json({ ok: true, results });
  } catch (err) {
    res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
  }
});
router.get("/report", async (req, res) => {
  try {
    await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    const db = getAdminDb();
    const reportSnap = await db.collection("exam_pattern_reports").doc(subject).get();
    if (reportSnap.exists) {
      res.json(reportSnap.data());
    } else {
      res.json({ subject, message: "Report not yet generated for this subject" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/probability", async (req, res) => {
  try {
    await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    const rankings = await rankTopicProbability(subject);
    res.json(rankings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/unasked-topics", async (req, res) => {
  try {
    await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    const data = await detectUnaskedTopics(subject);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/predicted-paper", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { subject, mode, targetMarks, includeAnswers } = req.body;
    const paper = await generatePredictedPaper({
      subject,
      mode,
      targetMarks,
      includeAnswers,
      studentUid: user.uid
    });
    res.json(paper);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var examIntelRoutes_default = router;

// server/routes/studentRoutes.ts
var import_express7 = require("express");
init_admin();

// server/ai-core/student/studentDiagnosis.ts
var import_genai8 = require("@google/genai");
init_admin();
init_client();
var ai5 = getAIClient();
async function diagnoseStudent(uid, subject) {
  const db = getAdminDb();
  const progressSnap = await db.collection("users").doc(uid).collection("progress").doc("data").get();
  const progressData = progressSnap.exists ? progressSnap.data()?.data?.[subject.toLowerCase()] : null;
  const mockResultsSnap = await db.collection("users").doc(uid).collection("mock_results").where("subject", "==", subject).orderBy("date", "desc").limit(5).get();
  const mockResults = mockResultsSnap.docs.map((d) => d.data());
  const mistakesSnap = await db.collection("users").doc(uid).collection("mistake_notebook").where("subject", "==", subject).limit(50).get();
  const mistakes = mistakesSnap.docs.map((d) => d.data());
  const prompt = `
    Analyze the following student data for subject: ${subject}.
    
    Student Progress: ${JSON.stringify(progressData)}
    Recent Mock Results: ${JSON.stringify(mockResults)}
    Mistake History: ${JSON.stringify(mistakes)}
    
    Identify:
    - Weak lessons (low completion or low marks)
    - High-yield weak lessons (important lessons where student is weak)
    - Urgent repair lessons (lessons with frequent mistakes)
    - Already strong lessons
    - Recommended daily focus
    - Risk reasons
  `;
  const response = await ai5.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert A/L education analyst. Provide a detailed diagnosis in JSON format.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai8.Type.OBJECT,
        properties: {
          subject: { type: import_genai8.Type.STRING },
          weakLessons: { type: import_genai8.Type.ARRAY, items: { type: import_genai8.Type.STRING } },
          highYieldWeakLessons: { type: import_genai8.Type.ARRAY, items: { type: import_genai8.Type.STRING } },
          urgentRepairLessons: { type: import_genai8.Type.ARRAY, items: { type: import_genai8.Type.STRING } },
          alreadyStrongLessons: { type: import_genai8.Type.ARRAY, items: { type: import_genai8.Type.STRING } },
          recommendedDailyFocus: { type: import_genai8.Type.ARRAY, items: { type: import_genai8.Type.STRING } },
          riskReasons: { type: import_genai8.Type.ARRAY, items: { type: import_genai8.Type.STRING } }
        },
        required: ["subject", "weakLessons", "highYieldWeakLessons", "urgentRepairLessons", "alreadyStrongLessons", "recommendedDailyFocus", "riskReasons"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
}

// server/ai-core/study/warPlan.ts
var import_genai9 = require("@google/genai");
init_admin();
init_client();
var ai6 = getAIClient();
async function generateWarPlan(params) {
  const db = getAdminDb();
  const progressSnap = await db.collection("users").doc(params.uid).collection("progress").doc("data").get();
  const progress = progressSnap.exists ? progressSnap.data()?.data : {};
  const mockResultsSnap = await db.collection("users").doc(params.uid).collection("mock_results").orderBy("date", "desc").limit(10).get();
  const mocks = mockResultsSnap.docs.map((d) => d.data());
  const prompt = `
    Generate a 30-Day A3 Recovery War Plan for a student.
    
    Target: ${params.target}
    Daily Hours: ${params.dailyHours}
    Subjects: ${params.subjects.join(", ")}
    Exam Dates: ${JSON.stringify(params.examDates)}
    
    Student Progress: ${JSON.stringify(progress)}
    Mock Performance: ${JSON.stringify(mocks)}
    
    Rules:
    - Daily schedule with morning/afternoon/night tasks.
    - Prioritize 80% mark-return lessons.
    - Include MCQ drills, past paper blocks, and mistake repair.
    - Use forgetting-curve repeats (3-day, 7-day).
    - Give a realistic forecast and risk assessment.
  `;
  const response = await ai6.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are a top-tier A/L exam coach. Output a strict but motivating 30-day war plan in JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai9.Type.OBJECT,
        properties: {
          target: { type: import_genai9.Type.STRING },
          daysRemaining: { type: import_genai9.Type.INTEGER },
          currentRisk: { type: import_genai9.Type.STRING, enum: ["High", "Medium", "Low"] },
          realisticForecast: { type: import_genai9.Type.OBJECT },
          dailyPlan: {
            type: import_genai9.Type.ARRAY,
            items: {
              type: import_genai9.Type.OBJECT,
              properties: {
                day: { type: import_genai9.Type.INTEGER },
                morning: { type: import_genai9.Type.STRING },
                afternoon: { type: import_genai9.Type.STRING },
                night: { type: import_genai9.Type.STRING },
                mock: { type: import_genai9.Type.STRING },
                targetScore: { type: import_genai9.Type.INTEGER }
              }
            }
          },
          weeklyMilestones: { type: import_genai9.Type.ARRAY, items: { type: import_genai9.Type.STRING } },
          mustDoLessons: { type: import_genai9.Type.ARRAY, items: { type: import_genai9.Type.STRING } },
          skipOrLowPriorityLessons: { type: import_genai9.Type.ARRAY, items: { type: import_genai9.Type.STRING } },
          mockTestSchedule: { type: import_genai9.Type.ARRAY, items: { type: import_genai9.Type.STRING } },
          revisionCycles: { type: import_genai9.Type.ARRAY, items: { type: import_genai9.Type.STRING } },
          warnings: { type: import_genai9.Type.ARRAY, items: { type: import_genai9.Type.STRING } }
        },
        required: ["target", "daysRemaining", "currentRisk", "realisticForecast", "dailyPlan", "weeklyMilestones", "mustDoLessons", "skipOrLowPriorityLessons", "mockTestSchedule", "revisionCycles", "warnings"]
      }
    }
  });
  const plan = JSON.parse(response.text || "{}");
  await db.collection("users").doc(params.uid).collection("war_plans").add({
    ...plan,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return plan;
}

// server/routes/studentRoutes.ts
var router2 = (0, import_express7.Router)();
router2.get("/diagnosis", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    const diagnosis = await diagnoseStudent(user.uid, subject);
    res.json(diagnosis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/war-plan", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { target, days, dailyHours, subjects, examDates } = req.body;
    const plan = await generateWarPlan({
      uid: user.uid,
      target,
      days,
      dailyHours,
      subjects,
      examDates
    });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.post("/mock-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const { subject, date, mcqMarks, structuredMarks, essayMarks, totalMarks, timeTaken, weakLessons } = req.body;
    const resultRef = await db.collection("users").doc(user.uid).collection("mock_results").add({
      subject,
      date: date || (/* @__PURE__ */ new Date()).toISOString(),
      mcqMarks,
      structuredMarks,
      essayMarks,
      totalMarks,
      timeTaken,
      weakLessons,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const currentMarkEstimate = totalMarks;
    await db.collection("users").doc(user.uid).collection("forecasts").add({
      uid: user.uid,
      currentMarkEstimate,
      forecast7Day: currentMarkEstimate + 5,
      forecast30Day: currentMarkEstimate + 15,
      a3Chance: currentMarkEstimate > 50 ? "Medium" : "Low",
      mustFix: weakLessons || [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ ok: true, id: resultRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router2.get("/mistakes", async (req, res) => {
  try {
    const user = await requireUser(req);
    const snapshot = await getAdminDb().collection("users").doc(user.uid).collection("mistake_notebook").orderBy("createdAt", "desc").limit(100).get();
    const bucket = getAdminBucket();
    const mistakes = await Promise.all(snapshot.docs.map(async (document) => {
      const data = document.data();
      let imageUrl = null;
      if (data.imageStoragePath) {
        try {
          [imageUrl] = await bucket.file(data.imageStoragePath).getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1e3
          });
        } catch (error) {
          console.warn("[mistakes] Could not sign image", { id: document.id, error: String(error) });
        }
      }
      return { id: document.id, ...data, imageUrl };
    }));
    res.json({ ok: true, mistakes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
router2.post("/mistake", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const { subject, lesson, questionText, errorText, imageStoragePath, imageMimeType, imageFileName } = req.body || {};
    const normalizedSubject = String(subject || "").trim().toUpperCase();
    const normalizedLesson = String(lesson || "").trim().slice(0, 180);
    const normalizedError = String(errorText || questionText || "").trim().slice(0, 8e3);
    const normalizedImagePath = String(imageStoragePath || "").replace(/^\/+/, "");
    if (!["SFT", "ET", "ICT"].includes(normalizedSubject)) {
      return res.status(400).json({ ok: false, error: "Choose SFT, ET, or ICT." });
    }
    if (!normalizedLesson) {
      return res.status(400).json({ ok: false, error: "Lesson is required." });
    }
    if (!normalizedError && !normalizedImagePath) {
      return res.status(400).json({ ok: false, error: "Add error text or an image." });
    }
    if (normalizedImagePath && !normalizedImagePath.startsWith(`users/${user.uid}/images/`)) {
      return res.status(403).json({ ok: false, error: "Invalid mistake image path." });
    }
    const document = await db.collection("users").doc(user.uid).collection("mistake_notebook").add({
      uid: user.uid,
      subject: normalizedSubject,
      lesson: normalizedLesson,
      errorText: normalizedError,
      questionText: normalizedError,
      imageStoragePath: normalizedImagePath || null,
      imageMimeType: normalizedImagePath ? String(imageMimeType || "image/jpeg").slice(0, 100) : null,
      imageFileName: normalizedImagePath ? String(imageFileName || "mistake-image").slice(0, 180) : null,
      retryDate: (/* @__PURE__ */ new Date()).toISOString(),
      repeatCount: 0,
      mastered: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ ok: true, id: document.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var studentRoutes_default = router2;

// server/routes/reportRoutes.ts
var import_express8 = require("express");
init_admin();
var router3 = (0, import_express8.Router)();
router3.post("/student-weekly", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    res.json({ ok: true, message: "Weekly report generated (Mocked for now)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var reportRoutes_default = router3;

// server/routes/learningRoutes.ts
var import_express9 = require("express");
init_admin();

// server/learning/learningEngine.ts
var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function normalizeComparableText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/ප්ර/g, "\u0DB4\u0DCA\u200D\u0DBB").replace(/ක්ර/g, "\u0D9A\u0DCA\u200D\u0DBB").replace(/ත්ර/g, "\u0DAD\u0DCA\u200D\u0DBB").replace(/ද්ර/g, "\u0DAF\u0DCA\u200D\u0DBB").replace(/ශ්ර/g, "\u0DC1\u0DCA\u200D\u0DBB").replace(/[^\p{L}\p{M}\p{N}.+\-*/=]+/gu, " ").replace(/\s+/g, " ").trim();
}
function tokenSet(value) {
  return new Set(normalizeComparableText(value).split(" ").filter((token) => token.length > 1));
}
function textSimilarity(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(1, Math.min(left.size, right.size));
}
function addDays(date, days) {
  return new Date(date.getTime() + days * 864e5);
}
function analyseLearningAttempt(input) {
  const confidence = clamp(Number(input.confidence ?? 0.5), 0, 1);
  const responseTimeMs = Math.max(0, Number(input.responseTimeMs || 0));
  const previousErrorCount = Math.max(0, Number(input.previousErrorCount || 0));
  const difficulty = clamp(Number(input.difficulty ?? 0.5), 0, 1);
  const working = normalizeComparableText(input.working);
  const mistakeTypes = [];
  const recommendations = [];
  const guessed = Boolean(
    !input.correct && confidence >= 0.75 || input.correct && confidence <= 0.25 || responseTimeMs > 0 && responseTimeMs < 2500 && String(input.questionType).toUpperCase() === "MCQ"
  );
  if (!input.correct) {
    if (guessed) mistakeTypes.push("guessing");
    if (input.expectedUnit && normalizeComparableText(input.expectedUnit) !== normalizeComparableText(input.submittedUnit)) {
      mistakeTypes.push("unit_conversion");
      recommendations.push("\u0D92\u0D9A\u0D9A\u0DBA \u0DC0\u0DD9\u0DB1\u0DB8 \u0DB4\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DCF \u0D9A\u0DBB \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DA7 \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 SI \u0D92\u0D9A\u0D9A\u0DBA \u0DBD\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1.");
    }
    if (input.expectedSignificantFigures != null && input.submittedSignificantFigures != null && input.expectedSignificantFigures !== input.submittedSignificantFigures) {
      mistakeTypes.push("significant_figures");
      recommendations.push("\u0D85\u0DC0\u0DC3\u0DCF\u0DB1 \u0D85\u0D9C\u0DBA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0DDA \u0D89\u0DBD\u0DCA\u0DBD\u0DCF \u0D87\u0DAD\u0DD2 significant figures \u0D9C\u0DAB\u0DB1\u0DA7 \u0DC0\u0DA7 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.");
    }
    if (/\b(?:f|ma|v|u|s|t|p|e|q)\s*=/.test(working) && /(?:wrong formula|formula error|සූත්‍ර)/.test(working)) {
      mistakeTypes.push("formula_misuse");
    } else if (String(input.questionType).toLowerCase().includes("calculation") || /[=+\-*/]/.test(working)) {
      mistakeTypes.push("calculation_step");
    } else if (String(input.questionType).toLowerCase().includes("essay") || String(input.questionType).toLowerCase().includes("structured")) {
      mistakeTypes.push("answer_structure");
    } else if (!guessed) {
      mistakeTypes.push("concept_misconception");
    }
  } else if (guessed) {
    mistakeTypes.push("guessing");
    recommendations.push("\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DC0\u0DD4\u0DC0\u0DAD\u0DCA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DBA \u0D85\u0DA9\u0DD4\u0DBA\u0DD2. \u0D91\u0D9A\u0DB8 concept \u0D91\u0D9A\u0DDA \u0DAD\u0DC0\u0DAD\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.");
  }
  if (mistakeTypes.length === 0 && !input.correct) mistakeTypes.push("unknown");
  const quality = input.correct ? confidence >= 0.7 ? 5 : confidence >= 0.4 ? 4 : 3 : confidence <= 0.35 ? 2 : 1;
  const oldEase = clamp(2.5 - previousErrorCount * 0.12, 1.3, 2.5);
  const easeFactor = clamp(oldEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)), 1.3, 2.7);
  const baseIntervals = input.correct ? [1, 3, 7, 14, 30, 60] : [1, 1, 2, 4, 7, 14];
  const intervalIndex = clamp(previousErrorCount, 0, baseIntervals.length - 1);
  const intervalDays = Math.max(1, Math.round(baseIntervals[intervalIndex] * (input.correct ? easeFactor / 2.2 : 1)));
  const now = input.now || /* @__PURE__ */ new Date();
  if (!input.correct && recommendations.length === 0) {
    recommendations.push("\u0DC0\u0DD0\u0DBB\u0DAF\u0DD4\u0DAB\u0DD4 concept \u0D91\u0D9A \u0DB8\u0DD2\u0DB1\u0DD2\u0DAD\u0DCA\u0DAD\u0DD4 10\u0D9A\u0DCA recall \u0D9A\u0DBB \u0DC3\u0DB8\u0DCF\u0DB1 MCQ \u0DAF\u0DD9\u0D9A\u0D9A\u0DCA \u0DB1\u0DD0\u0DC0\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.");
  }
  if (input.correct && !guessed) recommendations.push("\u0DB8\u0DA7\u0DCA\u0DA7\u0DB8 \u0DBB\u0DB3\u0DC0\u0DCF \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0D8A\u0DC5\u0D9F review \u0D91\u0D9A\u0DDA \u0DC0\u0DA9\u0DCF \u0D85\u0DB8\u0DCF\u0DBB\u0DD4 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.");
  return {
    mistakeTypes: [...new Set(mistakeTypes)],
    guessed,
    masteryDelta: input.correct ? guessed ? 2 : Math.round(6 + difficulty * 4) : -Math.round(5 + confidence * 5),
    difficultyAdjustment: input.correct && confidence >= 0.7 ? 1 : !input.correct ? -1 : 0,
    nextReviewAt: addDays(now, intervalDays).toISOString(),
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    recommendations
  };
}
function buildRevisionPlan(items, options = {}) {
  const days = clamp(Math.round(options.days || 7), 1, 60);
  const dailyMinutes = clamp(Math.round(options.dailyMinutes || 120), 20, 900);
  const startDate = options.startDate || /* @__PURE__ */ new Date();
  const examDate = options.examDate || null;
  const ranked = [...items].map((item) => ({
    ...item,
    weaknessScore: clamp(Number(item.weaknessScore || 0), 0, 100),
    estimatedMinutes: clamp(Math.round(item.estimatedMinutes || 25), 10, 90)
  })).sort((a, b) => {
    const aDue = a.nextReviewAt && new Date(a.nextReviewAt).getTime() <= startDate.getTime() ? 20 : 0;
    const bDue = b.nextReviewAt && new Date(b.nextReviewAt).getTime() <= startDate.getTime() ? 20 : 0;
    return b.weaknessScore + bDue + Number(b.errorCount || 0) * 3 - (a.weaknessScore + aDue + Number(a.errorCount || 0) * 3);
  });
  if (ranked.length === 0) return [];
  const result = [];
  let cursor = 0;
  for (let day = 0; day < days; day += 1) {
    const date = addDays(startDate, day);
    const tasks = [];
    let used = 0;
    let guard = 0;
    while (used < dailyMinutes && guard < ranked.length * 3) {
      const item = ranked[cursor % ranked.length];
      cursor += 1;
      guard += 1;
      const remaining = dailyMinutes - used;
      if (remaining < 10) break;
      const minutes = Math.min(item.estimatedMinutes || 25, remaining);
      const isExamNear = examDate ? (examDate.getTime() - date.getTime()) / 864e5 <= 3 : false;
      const activity = isExamNear ? "mock" : item.weaknessScore >= 75 ? "practice" : day % 3 === 2 ? "recall" : "review";
      tasks.push({
        id: item.id,
        subject: item.subject,
        lesson: item.lesson,
        minutes,
        activity,
        reason: item.weaknessScore >= 70 ? `Weakness ${item.weaknessScore}% \u0DC3\u0DC4 \u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 ${item.errorCount || 0}` : "Scheduled spaced-repetition review"
      });
      used += minutes;
    }
    result.push({ day: day + 1, date: date.toISOString().slice(0, 10), totalMinutes: used, tasks });
  }
  return result;
}
function gradeAnswer(input) {
  const student = normalizeComparableText(input.studentAnswer);
  const model = normalizeComparableText(input.modelAnswer);
  const points = input.markingPoints.map((point) => typeof point === "string" ? { text: point, marks: void 0, alternatives: [] } : { text: point.text, marks: point.marks, alternatives: point.alternatives || [] });
  const defaultPointMarks = points.length > 0 ? input.maxMarks / points.length : 0;
  const matchedPoints = [];
  const missingPoints = [];
  const alternativeMatches = [];
  let awarded = 0;
  for (const point of points) {
    const mainSimilarity = textSimilarity(student, point.text);
    const matchedAlternative = point.alternatives.find((alternative) => textSimilarity(student, alternative) >= 0.55);
    const matched = mainSimilarity >= 0.5 || Boolean(matchedAlternative);
    if (matched) {
      matchedPoints.push(point.text);
      if (matchedAlternative) alternativeMatches.push(matchedAlternative);
      awarded += point.marks ?? defaultPointMarks;
    } else {
      missingPoints.push(point.text);
    }
  }
  if (points.length > 0 && awarded === 0 && model && textSimilarity(student, model) >= 0.45) {
    awarded = Math.min(input.maxMarks * 0.25, defaultPointMarks);
  }
  const issues = [];
  if (input.expectedUnit && normalizeComparableText(input.expectedUnit) !== normalizeComparableText(input.submittedUnit)) {
    issues.push({ type: "unit_conversion", message: `Expected unit: ${input.expectedUnit}` });
    awarded = Math.max(0, awarded - Math.min(1, input.maxMarks * 0.1));
  }
  if (input.expectedSignificantFigures != null && input.submittedSignificantFigures != null && input.expectedSignificantFigures !== input.submittedSignificantFigures) {
    issues.push({ type: "significant_figures", message: `Use ${input.expectedSignificantFigures} significant figures.` });
    awarded = Math.max(0, awarded - Math.min(1, input.maxMarks * 0.1));
  }
  if (student.length < 20 && input.maxMarks >= 5) {
    issues.push({ type: "answer_structure", message: "Answer is too short for the allocated marks." });
  }
  const awardedMarks = Number(clamp(awarded, 0, input.maxMarks).toFixed(2));
  const feedback = [];
  if (matchedPoints.length) feedback.push(`Matched ${matchedPoints.length}/${points.length} marking points.`);
  if (missingPoints.length) feedback.push("Missing marking points are shown for targeted correction.");
  if (!issues.length && awardedMarks === input.maxMarks) feedback.push("All supplied marking points are present.");
  return {
    awardedMarks,
    maxMarks: input.maxMarks,
    percentage: input.maxMarks > 0 ? Math.round(awardedMarks / input.maxMarks * 100) : 0,
    matchedPoints,
    missingPoints,
    alternativeMatches,
    issues,
    feedback
  };
}

// server/routes/learningRoutes.ts
var router4 = (0, import_express9.Router)();
function safeString(value, max = 4e3) {
  return String(value || "").trim().slice(0, max);
}
router4.post("/attempts", async (req, res) => {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const input = {
      subject: safeString(body.subject, 20).toUpperCase(),
      lesson: safeString(body.lesson, 180),
      questionId: safeString(body.questionId, 220) || null,
      questionType: safeString(body.questionType, 40) || "MCQ",
      correct: Boolean(body.correct),
      selectedAnswer: safeString(body.selectedAnswer, 1e3) || null,
      correctAnswer: safeString(body.correctAnswer, 1e3) || null,
      responseTimeMs: Number(body.responseTimeMs || 0),
      confidence: body.confidence == null ? null : Number(body.confidence),
      working: safeString(body.working, 8e3) || null,
      expectedUnit: safeString(body.expectedUnit, 50) || null,
      submittedUnit: safeString(body.submittedUnit, 50) || null,
      expectedSignificantFigures: body.expectedSignificantFigures == null ? null : Number(body.expectedSignificantFigures),
      submittedSignificantFigures: body.submittedSignificantFigures == null ? null : Number(body.submittedSignificantFigures),
      previousErrorCount: Number(body.previousErrorCount || 0),
      difficulty: body.difficulty == null ? null : Number(body.difficulty)
    };
    if (!input.subject || !input.lesson) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "subject and lesson are required" });
    }
    const analysis = analyseLearningAttempt(input);
    const db = getAdminDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const attemptRef = db.collection("users").doc(user.uid).collection("answer_history").doc();
    await attemptRef.set({
      id: attemptRef.id,
      uid: user.uid,
      ...input,
      ...analysis,
      createdAt: now,
      updatedAt: now
    });
    if (!input.correct) {
      const mistakeKey = `${input.subject}:${input.questionId || input.lesson}`.replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 300);
      const mistakeRef = db.collection("users").doc(user.uid).collection("mistake_notebook").doc(mistakeKey);
      const existing = await mistakeRef.get();
      const previous = existing.exists ? existing.data() || {} : {};
      await mistakeRef.set({
        id: mistakeKey,
        uid: user.uid,
        subject: input.subject,
        lesson: input.lesson,
        questionId: input.questionId,
        questionType: input.questionType,
        studentAnswer: input.selectedAnswer,
        correctAnswer: input.correctAnswer,
        mistakeTypes: analysis.mistakeTypes,
        guessed: analysis.guessed,
        sameErrorCount: Number(previous.sameErrorCount || previous.repeatCount || 0) + 1,
        intervalDays: analysis.intervalDays,
        easeFactor: analysis.easeFactor,
        nextReviewAt: analysis.nextReviewAt,
        lastAttemptAt: now,
        mastered: false,
        createdAt: previous.createdAt || now,
        updatedAt: now
      }, { merge: true });
    }
    return res.json({ ok: true, attemptId: attemptRef.id, analysis });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "ATTEMPT_SAVE_FAILED", message: error.message });
  }
});
router4.get("/revision-queue", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = safeString(req.query.subject, 20).toUpperCase();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
    const snap = await getAdminDb().collection("users").doc(user.uid).collection("mistake_notebook").orderBy("updatedAt", "desc").limit(250).get();
    const now = Date.now();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((item) => !subject || String(item.subject || "").toUpperCase() === subject).map((item) => ({
      ...item,
      due: !item.nextReviewAt || new Date(item.nextReviewAt).getTime() <= now,
      priorityScore: Math.min(100, Number(item.sameErrorCount || item.repeatCount || 1) * 15 + (item.mastered ? 0 : 30))
    })).sort((a, b) => Number(b.due) - Number(a.due) || b.priorityScore - a.priorityScore).slice(0, limit);
    return res.json({ ok: true, items, total: items.length });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "REVISION_QUEUE_FAILED", message: error.message });
  }
});
router4.post("/revision-plan", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const snap = await db.collection("users").doc(user.uid).collection("mistake_notebook").limit(300).get();
    const items = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        subject: String(data.subject || "SFT"),
        lesson: String(data.lesson || "Unknown lesson"),
        weaknessScore: Math.min(100, 35 + Number(data.sameErrorCount || data.repeatCount || 1) * 12),
        errorCount: Number(data.sameErrorCount || data.repeatCount || 1),
        lastAttemptAt: data.lastAttemptAt || data.updatedAt || null,
        nextReviewAt: data.nextReviewAt || null,
        estimatedMinutes: Number(data.estimatedMinutes || 25)
      };
    });
    const days = Number(req.body?.days || 7);
    const dailyMinutes = Number(req.body?.dailyMinutes || 120);
    const examDate = req.body?.examDate ? new Date(req.body.examDate) : null;
    const plan = buildRevisionPlan(items, { days, dailyMinutes, examDate });
    const planRef = db.collection("users").doc(user.uid).collection("revision_plans").doc();
    await planRef.set({ id: planRef.id, days, dailyMinutes, examDate: examDate?.toISOString() || null, plan, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    return res.json({ ok: true, planId: planRef.id, plan });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "REVISION_PLAN_FAILED", message: error.message });
  }
});
router4.post("/grade", async (req, res) => {
  try {
    await requireUser(req);
    const body = req.body || {};
    if (!Array.isArray(body.markingPoints) || !Number.isFinite(Number(body.maxMarks))) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "markingPoints and maxMarks are required" });
    }
    const result = gradeAnswer({
      studentAnswer: safeString(body.studentAnswer, 3e4),
      modelAnswer: safeString(body.modelAnswer, 3e4) || null,
      markingPoints: body.markingPoints,
      maxMarks: Number(body.maxMarks),
      expectedUnit: safeString(body.expectedUnit, 50) || null,
      submittedUnit: safeString(body.submittedUnit, 50) || null,
      expectedSignificantFigures: body.expectedSignificantFigures == null ? null : Number(body.expectedSignificantFigures),
      submittedSignificantFigures: body.submittedSignificantFigures == null ? null : Number(body.submittedSignificantFigures)
    });
    return res.json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "ANSWER_GRADING_FAILED", message: error.message });
  }
});
router4.get("/daily-quiz", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = safeString(req.query.subject || "SFT", 20).toUpperCase();
    const db = getAdminDb();
    const mistakesSnap = await db.collection("users").doc(user.uid).collection("mistake_notebook").limit(100).get();
    const weakLessons = [...new Set(mistakesSnap.docs.map((doc) => String(doc.data().lesson || "")).filter(Boolean))].slice(0, 5);
    let query = db.collection("exam_question_index").where("subject", "==", subject).where("questionType", "==", "MCQ").limit(30);
    const questionSnap = await query.get();
    const questions = questionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => Number(weakLessons.includes(String(b.lesson))) - Number(weakLessons.includes(String(a.lesson)))).slice(0, 5).map((question) => ({
      id: question.id,
      questionNo: question.questionNo,
      questionText: question.questionText,
      options: question.options || [],
      lesson: question.lesson,
      pageNumber: question.pageNumber || null,
      sourceId: question.sourceId
      // Do not expose the correct answer before submission.
    }));
    return res.json({ ok: true, subject, weakLessons, questions });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "DAILY_QUIZ_FAILED", message: error.message });
  }
});
router4.post("/bookmarks", async (req, res) => {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const questionId = safeString(body.questionId, 300);
    if (!questionId) return res.status(400).json({ ok: false, message: "questionId is required" });
    const ref = getAdminDb().collection("users").doc(user.uid).collection("question_bookmarks").doc(questionId.replace(/[^A-Za-z0-9:_-]/g, "_"));
    await ref.set({
      id: ref.id,
      uid: user.uid,
      questionId,
      sourceId: safeString(body.sourceId, 300) || null,
      subject: safeString(body.subject, 20).toUpperCase() || null,
      lesson: safeString(body.lesson, 180) || null,
      difficult: Boolean(body.difficult),
      note: safeString(body.note, 2e3) || null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: body.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    return res.json({ ok: true, id: ref.id });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "BOOKMARK_SAVE_FAILED", message: error.message });
  }
});
var learningRoutes_default = router4;

// server/platform/routes.ts
var import_express10 = require("express");
init_admin();

// shared/platform/featureCatalog.ts
var FEATURE_CATEGORY_LABELS = {
  ai_learning: "AI \u0DC3\u0DC4 learning",
  auth_data: "Authentication, data \u0DC3\u0DC4 profiles",
  performance_reliability: "Performance \u0DC3\u0DC4 reliability",
  ui_ux: "UI/UX \u0DC3\u0DC4 responsive design",
  files_media: "Files, PDFs \u0DC3\u0DC4 video",
  security_quality: "Security, DevOps, SEO \u0DC3\u0DC4 quality"
};
var PLATFORM_FEATURES = [
  {
    "id": 1,
    "category": "ai_learning",
    "title": "PDF \u0D91\u0D9A\u0DDA Q1, Q2 \u0DC0\u0D9C\u0DDA question-number lookup.",
    "key": "feature_001",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 2,
    "category": "ai_learning",
    "title": "Previous message \u0D91\u0D9A\u0DDA selected PDF \u0D91\u0D9A conversation memory \u0D91\u0D9A\u0DDA \u0DAD\u0DB6\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8.",
    "key": "feature_002",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 3,
    "category": "ai_learning",
    "title": "Lesson name Sinhala/English/Singlish \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA resolve \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_003",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 4,
    "category": "ai_learning",
    "title": "\u201C\u0DAD\u0DBB\u0DBD\u201D, \u201Ctharala\u201D, \u201Cfluids\u201D \u0D91\u0D9A\u0DB8 lesson \u0D91\u0D9A\u0D9A\u0DCA \u0DBD\u0DD9\u0DC3 \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8.",
    "key": "feature_004",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 5,
    "category": "ai_learning",
    "title": "Uploaded PDFs \u0DC3\u0DD2\u0DBA\u0DBD\u0DCA\u0DBD automatic indexing \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_005",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 6,
    "category": "ai_learning",
    "title": "Indexing status \u0D91\u0D9A real time \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8.",
    "key": "feature_006",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 7,
    "category": "ai_learning",
    "title": "Failed indexing \u0DC3\u0DB3\u0DC4\u0DCF automatic retry.",
    "key": "feature_007",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 8,
    "category": "ai_learning",
    "title": "Scanned PDFs \u0DC3\u0DB3\u0DC4\u0DCF OCR fallback.",
    "key": "feature_008",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 9,
    "category": "ai_learning",
    "title": "Sinhala OCR confidence scoring.",
    "key": "feature_009",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 10,
    "category": "ai_learning",
    "title": "Low-confidence OCR text user review \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DBD\u0DB6\u0DCF\u0DAF\u0DD3\u0DB8.",
    "key": "feature_010",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 11,
    "category": "ai_learning",
    "title": "PDF page-number citations.",
    "key": "feature_011",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 12,
    "category": "ai_learning",
    "title": "Answer \u0D91\u0D9A \u0DC3\u0DB8\u0D9F source page preview.",
    "key": "feature_012",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 13,
    "category": "ai_learning",
    "title": "Exact source quote highlighting.",
    "key": "feature_013",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 14,
    "category": "ai_learning",
    "title": "Fabricated questions \u0DC3\u0DC4 answers \u0D85\u0DC0\u0DC4\u0DD2\u0DBB \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_014",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 15,
    "category": "ai_learning",
    "title": "Source \u0D91\u0D9A\u0DDA \u0DB1\u0DD0\u0DAD\u0DD2 facts \u0DAF\u0DD9\u0DB1 \u0DC0\u0DD2\u0DA7 clear warning.",
    "key": "feature_015",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 16,
    "category": "ai_learning",
    "title": "Answer confidence indicator.",
    "key": "feature_016",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 17,
    "category": "ai_learning",
    "title": "Multiple PDFs \u0D91\u0D9A\u0DC0\u0DBB search \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_017",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 18,
    "category": "ai_learning",
    "title": "Lesson container \u0D91\u0D9A\u0DDA \u0DC3\u0DD2\u0DBA\u0DBD\u0DD4 resources combine \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_018",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 19,
    "category": "ai_learning",
    "title": "Past paper \u0DC3\u0DC4 marking scheme automatically pair \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_019",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 20,
    "category": "ai_learning",
    "title": "Question paper year/type detection.",
    "key": "feature_020",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 21,
    "category": "ai_learning",
    "title": "MCQ/Structured/Essay automatic classification.",
    "key": "feature_021",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 22,
    "category": "ai_learning",
    "title": "Question number extraction.",
    "key": "feature_022",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 23,
    "category": "ai_learning",
    "title": "Marking scheme answer extraction.",
    "key": "feature_023",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 24,
    "category": "ai_learning",
    "title": "Diagram-based question detection.",
    "key": "feature_024",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 25,
    "category": "ai_learning",
    "title": "Table extraction.",
    "key": "feature_025",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 26,
    "category": "ai_learning",
    "title": "Equation extraction.",
    "key": "feature_026",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 27,
    "category": "ai_learning",
    "title": "Sinhala mathematical text normalization.",
    "key": "feature_027",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 28,
    "category": "ai_learning",
    "title": "Image-only page understanding.",
    "key": "feature_028",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 29,
    "category": "ai_learning",
    "title": "PDF duplicate detection.",
    "key": "feature_029",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 30,
    "category": "ai_learning",
    "title": "Bad/corrupt PDF detection.",
    "key": "feature_030",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 31,
    "category": "ai_learning",
    "title": "Indexed text completeness report.",
    "key": "feature_031",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 32,
    "category": "ai_learning",
    "title": "PDF page rotation correction.",
    "key": "feature_032",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 33,
    "category": "ai_learning",
    "title": "Handwritten note OCR.",
    "key": "feature_033",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 34,
    "category": "ai_learning",
    "title": "Mixed Sinhala-English OCR.",
    "key": "feature_034",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 35,
    "category": "ai_learning",
    "title": "Resource title automatic cleanup.",
    "key": "feature_035",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 36,
    "category": "ai_learning",
    "title": "File name \u0DC0\u0DD9\u0DB1\u0DD4\u0DC0\u0DA7 lesson-friendly title generation.",
    "key": "feature_036",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 37,
    "category": "ai_learning",
    "title": "Teacher name extraction.",
    "key": "feature_037",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 38,
    "category": "ai_learning",
    "title": "Exam year extraction.",
    "key": "feature_038",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 39,
    "category": "ai_learning",
    "title": "Subject detection: SFT/ET/ICT.",
    "key": "feature_039",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 40,
    "category": "ai_learning",
    "title": "Medium detection: Sinhala/English.",
    "key": "feature_040",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 41,
    "category": "ai_learning",
    "title": "Paper vs marking scheme detection.",
    "key": "feature_041",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 42,
    "category": "ai_learning",
    "title": "Lesson-level semantic search.",
    "key": "feature_042",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 43,
    "category": "ai_learning",
    "title": "Keyword search fallback.",
    "key": "feature_043",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 44,
    "category": "ai_learning",
    "title": "Exact phrase search.",
    "key": "feature_044",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 45,
    "category": "ai_learning",
    "title": "Source relevance ranking.",
    "key": "feature_045",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 46,
    "category": "ai_learning",
    "title": "Outdated source warning.",
    "key": "feature_046",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 47,
    "category": "ai_learning",
    "title": "Duplicate source merging.",
    "key": "feature_047",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 48,
    "category": "ai_learning",
    "title": "Admin source verification.",
    "key": "feature_048",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 49,
    "category": "ai_learning",
    "title": "Trusted-source badges.",
    "key": "feature_049",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 50,
    "category": "ai_learning",
    "title": "AI answer audit trail.",
    "key": "feature_050",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 51,
    "category": "ai_learning",
    "title": "Student weak-lesson detection.",
    "key": "feature_051",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 52,
    "category": "ai_learning",
    "title": "Mastered-lesson detection.",
    "key": "feature_052",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 53,
    "category": "ai_learning",
    "title": "Personalized revision plan.",
    "key": "feature_053",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 54,
    "category": "ai_learning",
    "title": "Daily lesson recommendation.",
    "key": "feature_054",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 55,
    "category": "ai_learning",
    "title": "Upcoming exam countdown plan.",
    "key": "feature_055",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 56,
    "category": "ai_learning",
    "title": "Student marks-based difficulty adjustment.",
    "key": "feature_056",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 57,
    "category": "ai_learning",
    "title": "Beginner/intermediate/advanced answer modes.",
    "key": "feature_057",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 58,
    "category": "ai_learning",
    "title": "Short/normal/detailed answer length controls.",
    "key": "feature_058",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 59,
    "category": "ai_learning",
    "title": "Sinhala/English/Singlish response selector.",
    "key": "feature_059",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 60,
    "category": "ai_learning",
    "title": "Teacher-style explanation selector.",
    "key": "feature_060",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 61,
    "category": "ai_learning",
    "title": "Step-by-step calculation mode.",
    "key": "feature_061",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 62,
    "category": "ai_learning",
    "title": "Hint-only mode.",
    "key": "feature_062",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 63,
    "category": "ai_learning",
    "title": "Socratic tutoring mode.",
    "key": "feature_063",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 64,
    "category": "ai_learning",
    "title": "\u201CDon\u2019t reveal answer yet\u201D mode.",
    "key": "feature_064",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 65,
    "category": "ai_learning",
    "title": "Formula-first explanation.",
    "key": "feature_065",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 66,
    "category": "ai_learning",
    "title": "Diagram-first explanation.",
    "key": "feature_066",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 67,
    "category": "ai_learning",
    "title": "Example-first explanation.",
    "key": "feature_067",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 68,
    "category": "ai_learning",
    "title": "Common-mistake explanation.",
    "key": "feature_068",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 69,
    "category": "ai_learning",
    "title": "Exam marking-point explanation.",
    "key": "feature_069",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 70,
    "category": "ai_learning",
    "title": "Time-saving exam technique suggestions.",
    "key": "feature_070",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 71,
    "category": "ai_learning",
    "title": "Student\u2019s previous mistakes automatically use \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_071",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 72,
    "category": "ai_learning",
    "title": "Similar past-paper question recommendation.",
    "key": "feature_072",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 73,
    "category": "ai_learning",
    "title": "Spaced-repetition scheduling.",
    "key": "feature_073",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 74,
    "category": "ai_learning",
    "title": "Forgotten-topic reminders.",
    "key": "feature_074",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 75,
    "category": "ai_learning",
    "title": "Daily five-question quiz.",
    "key": "feature_075",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 76,
    "category": "ai_learning",
    "title": "Weekly progress quiz.",
    "key": "feature_076",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 77,
    "category": "ai_learning",
    "title": "Lesson completion quiz.",
    "key": "feature_077",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 78,
    "category": "ai_learning",
    "title": "Adaptive question difficulty.",
    "key": "feature_078",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 79,
    "category": "ai_learning",
    "title": "Wrong answer follow-up question.",
    "key": "feature_079",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 80,
    "category": "ai_learning",
    "title": "Correct answer deeper challenge.",
    "key": "feature_080",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 81,
    "category": "ai_learning",
    "title": "Student confidence input.",
    "key": "feature_081",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 82,
    "category": "ai_learning",
    "title": "Guessing detection.",
    "key": "feature_082",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 83,
    "category": "ai_learning",
    "title": "Concept misconception detection.",
    "key": "feature_083",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 84,
    "category": "ai_learning",
    "title": "Formula misuse detection.",
    "key": "feature_084",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 85,
    "category": "ai_learning",
    "title": "Unit-conversion mistake detection.",
    "key": "feature_085",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 86,
    "category": "ai_learning",
    "title": "Calculation-step validation.",
    "key": "feature_086",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 87,
    "category": "ai_learning",
    "title": "Answer structure feedback.",
    "key": "feature_087",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 88,
    "category": "ai_learning",
    "title": "Essay paragraph feedback.",
    "key": "feature_088",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 89,
    "category": "ai_learning",
    "title": "Mark allocation prediction.",
    "key": "feature_089",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 90,
    "category": "ai_learning",
    "title": "Estimated score per response.",
    "key": "feature_090",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 91,
    "category": "ai_learning",
    "title": "PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA exact quiz generation.",
    "key": "feature_091",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 92,
    "category": "ai_learning",
    "title": "Marking scheme grounded quiz evaluation.",
    "key": "feature_092",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 93,
    "category": "ai_learning",
    "title": "MCQ distractor explanations.",
    "key": "feature_093",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 94,
    "category": "ai_learning",
    "title": "Timed MCQ mode.",
    "key": "feature_094",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 95,
    "category": "ai_learning",
    "title": "Structured essay practice mode.",
    "key": "feature_095",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 96,
    "category": "ai_learning",
    "title": "Full-paper simulation.",
    "key": "feature_096",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 97,
    "category": "ai_learning",
    "title": "Automatic paper timer.",
    "key": "feature_097",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 98,
    "category": "ai_learning",
    "title": "Section-specific timer.",
    "key": "feature_098",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 99,
    "category": "ai_learning",
    "title": "Answer submission history.",
    "key": "feature_099",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 100,
    "category": "ai_learning",
    "title": "AI marking rubric.",
    "key": "feature_100",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 101,
    "category": "ai_learning",
    "title": "Partial marks calculation.",
    "key": "feature_101",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 102,
    "category": "ai_learning",
    "title": "Missing marking points display.",
    "key": "feature_102",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 103,
    "category": "ai_learning",
    "title": "Model-answer comparison.",
    "key": "feature_103",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 104,
    "category": "ai_learning",
    "title": "Student answer vs marking scheme diff.",
    "key": "feature_104",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 105,
    "category": "ai_learning",
    "title": "Handwritten answer image marking.",
    "key": "feature_105",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 106,
    "category": "ai_learning",
    "title": "Essay image OCR and evaluation.",
    "key": "feature_106",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 107,
    "category": "ai_learning",
    "title": "Diagram marking.",
    "key": "feature_107",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 108,
    "category": "ai_learning",
    "title": "Graph marking.",
    "key": "feature_108",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 109,
    "category": "ai_learning",
    "title": "Formula validation.",
    "key": "feature_109",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 110,
    "category": "ai_learning",
    "title": "Significant-figure validation.",
    "key": "feature_110",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 111,
    "category": "ai_learning",
    "title": "Units validation.",
    "key": "feature_111",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 112,
    "category": "ai_learning",
    "title": "Sinhala spelling-tolerant marking.",
    "key": "feature_112",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 113,
    "category": "ai_learning",
    "title": "Alternative correct-answer support.",
    "key": "feature_113",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 114,
    "category": "ai_learning",
    "title": "Teacher review override.",
    "key": "feature_114",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 115,
    "category": "ai_learning",
    "title": "Re-mark request feature.",
    "key": "feature_115",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 116,
    "category": "ai_learning",
    "title": "Question bookmark.",
    "key": "feature_116",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 117,
    "category": "ai_learning",
    "title": "Difficult-question collection.",
    "key": "feature_117",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 118,
    "category": "ai_learning",
    "title": "Automatically generated flashcards.",
    "key": "feature_118",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 119,
    "category": "ai_learning",
    "title": "Formula flashcards.",
    "key": "feature_119",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 120,
    "category": "ai_learning",
    "title": "Diagram flashcards.",
    "key": "feature_120",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 121,
    "category": "ai_learning",
    "title": "Lesson summary generation.",
    "key": "feature_121",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 122,
    "category": "ai_learning",
    "title": "One-page revision sheet.",
    "key": "feature_122",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 123,
    "category": "ai_learning",
    "title": "Formula sheet generation.",
    "key": "feature_123",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 124,
    "category": "ai_learning",
    "title": "Last-minute revision mode.",
    "key": "feature_124",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 125,
    "category": "ai_learning",
    "title": "Audio lesson summaries.",
    "key": "feature_125",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 126,
    "category": "ai_learning",
    "title": "Sinhala text-to-speech.",
    "key": "feature_126",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 127,
    "category": "ai_learning",
    "title": "Playback-speed controls.",
    "key": "feature_127",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 128,
    "category": "ai_learning",
    "title": "AI voice question reading.",
    "key": "feature_128",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 129,
    "category": "ai_learning",
    "title": "Speech-to-text questions.",
    "key": "feature_129",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 130,
    "category": "ai_learning",
    "title": "Voice answer practice.",
    "key": "feature_130",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 131,
    "category": "ai_learning",
    "title": "Pronunciation-tolerant Singlish input.",
    "key": "feature_131",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 132,
    "category": "ai_learning",
    "title": "Uploaded image explanation.",
    "key": "feature_132",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 133,
    "category": "ai_learning",
    "title": "Screenshot error diagnosis.",
    "key": "feature_133",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 134,
    "category": "ai_learning",
    "title": "Console-log explanation.",
    "key": "feature_134",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 135,
    "category": "ai_learning",
    "title": "Code-error troubleshooting for ICT.",
    "key": "feature_135",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 136,
    "category": "ai_learning",
    "title": "Circuit image analysis for ET.",
    "key": "feature_136",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 137,
    "category": "ai_learning",
    "title": "Experimental setup image analysis.",
    "key": "feature_137",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 138,
    "category": "ai_learning",
    "title": "Graph image analysis.",
    "key": "feature_138",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 139,
    "category": "ai_learning",
    "title": "Table image analysis.",
    "key": "feature_139",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 140,
    "category": "ai_learning",
    "title": "Chemical/physics symbol recognition.",
    "key": "feature_140",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 141,
    "category": "ai_learning",
    "title": "Interactive formula calculator.",
    "key": "feature_141",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 142,
    "category": "ai_learning",
    "title": "Unit converter.",
    "key": "feature_142",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 143,
    "category": "ai_learning",
    "title": "Scientific notation helper.",
    "key": "feature_143",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 144,
    "category": "ai_learning",
    "title": "Graph plotting tool.",
    "key": "feature_144",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 145,
    "category": "ai_learning",
    "title": "Circuit truth-table generator.",
    "key": "feature_145",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 146,
    "category": "ai_learning",
    "title": "Database query practice tool.",
    "key": "feature_146",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 147,
    "category": "ai_learning",
    "title": "Python code runner sandbox.",
    "key": "feature_147",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 148,
    "category": "ai_learning",
    "title": "Lesson-specific AI tools.",
    "key": "feature_148",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 149,
    "category": "ai_learning",
    "title": "Tool-use result citations.",
    "key": "feature_149",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 150,
    "category": "ai_learning",
    "title": "AI conversation export.",
    "key": "feature_150",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 151,
    "category": "auth_data",
    "title": "Popup login \u0DC0\u0DD9\u0DB1\u0DD4\u0DC0\u0DA7 reliable redirect fallback.",
    "key": "feature_151",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 152,
    "category": "auth_data",
    "title": "Redirect result \u0D91\u0D9A page boot \u0DC0\u0DD9\u0DAF\u0DCA\u0DAF\u0DD3 process \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_152",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 153,
    "category": "auth_data",
    "title": "Anonymous Firebase users disable \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_153",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 154,
    "category": "auth_data",
    "title": "Auth-loading timeout and retry.",
    "key": "feature_154",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 155,
    "category": "auth_data",
    "title": "Offline login-state recovery.",
    "key": "feature_155",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 156,
    "category": "auth_data",
    "title": "Duplicate login requests prevent \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_156",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 157,
    "category": "auth_data",
    "title": "API session creation retry.",
    "key": "feature_157",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 158,
    "category": "auth_data",
    "title": "Expired token automatic refresh.",
    "key": "feature_158",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 159,
    "category": "auth_data",
    "title": "Cross-tab login synchronization.",
    "key": "feature_159",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 160,
    "category": "auth_data",
    "title": "Logout all devices.",
    "key": "feature_160",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 161,
    "category": "auth_data",
    "title": "Session-device list.",
    "key": "feature_161",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 162,
    "category": "auth_data",
    "title": "Suspicious-login alert.",
    "key": "feature_162",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 163,
    "category": "auth_data",
    "title": "Google profile image fallback.",
    "key": "feature_163",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 164,
    "category": "auth_data",
    "title": "Profile image caching.",
    "key": "feature_164",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 165,
    "category": "auth_data",
    "title": "Broken-avatar fallback.",
    "key": "feature_165",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 166,
    "category": "auth_data",
    "title": "Profile data progressive loading.",
    "key": "feature_166",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 167,
    "category": "auth_data",
    "title": "Page-specific data fetching.",
    "key": "feature_167",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 168,
    "category": "auth_data",
    "title": "Duplicate Firestore reads prevent \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_168",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 169,
    "category": "auth_data",
    "title": "SWR/React Query caching.",
    "key": "feature_169",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 170,
    "category": "auth_data",
    "title": "Optimistic profile updates.",
    "key": "feature_170",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 171,
    "category": "auth_data",
    "title": "User-data schema validation.",
    "key": "feature_171",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 172,
    "category": "auth_data",
    "title": "Firestore undefined values sanitize \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_172",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 173,
    "category": "auth_data",
    "title": "Server-side user ownership checks.",
    "key": "feature_173",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 174,
    "category": "auth_data",
    "title": "Email-path \u0DC0\u0DD9\u0DB1\u0DD4\u0DC0\u0DA7 UID-based documents.",
    "key": "feature_174",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 175,
    "category": "auth_data",
    "title": "Old email-based data migration.",
    "key": "feature_175",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 176,
    "category": "auth_data",
    "title": "Admin role via Firebase custom claims.",
    "key": "feature_176",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 177,
    "category": "auth_data",
    "title": "Content-editor role.",
    "key": "feature_177",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 178,
    "category": "auth_data",
    "title": "Account deletion flow.",
    "key": "feature_178",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 179,
    "category": "auth_data",
    "title": "Data export flow.",
    "key": "feature_179",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 180,
    "category": "auth_data",
    "title": "Privacy settings.",
    "key": "feature_180",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 181,
    "category": "performance_reliability",
    "title": "Large route bundles code-split \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_181",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 182,
    "category": "performance_reliability",
    "title": "Chart libraries lazy-load \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_182",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 183,
    "category": "performance_reliability",
    "title": "PDF.js only when needed load \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_183",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 184,
    "category": "performance_reliability",
    "title": "Video player lazy-load \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_184",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 185,
    "category": "performance_reliability",
    "title": "Admin dashboard separate chunk.",
    "key": "feature_185",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 186,
    "category": "performance_reliability",
    "title": "AI page separate chunk.",
    "key": "feature_186",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 187,
    "category": "performance_reliability",
    "title": "Route prefetch on hover.",
    "key": "feature_187",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 188,
    "category": "performance_reliability",
    "title": "Critical CSS optimization.",
    "key": "feature_188",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 189,
    "category": "performance_reliability",
    "title": "Unused CSS removal.",
    "key": "feature_189",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 190,
    "category": "performance_reliability",
    "title": "Image WebP/AVIF conversion.",
    "key": "feature_190",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 191,
    "category": "performance_reliability",
    "title": "Responsive image sizes.",
    "key": "feature_191",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 192,
    "category": "performance_reliability",
    "title": "Long-term asset caching.",
    "key": "feature_192",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 193,
    "category": "performance_reliability",
    "title": "Profile image CDN caching.",
    "key": "feature_193",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 194,
    "category": "performance_reliability",
    "title": "API response compression.",
    "key": "feature_194",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 195,
    "category": "performance_reliability",
    "title": "Firestore query pagination.",
    "key": "feature_195",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 196,
    "category": "performance_reliability",
    "title": "Notifications pagination.",
    "key": "feature_196",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 197,
    "category": "performance_reliability",
    "title": "Chat history pagination.",
    "key": "feature_197",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 198,
    "category": "performance_reliability",
    "title": "Past-paper infinite scrolling.",
    "key": "feature_198",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 199,
    "category": "performance_reliability",
    "title": "Search input debouncing.",
    "key": "feature_199",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 200,
    "category": "performance_reliability",
    "title": "Duplicate API-call cancellation.",
    "key": "feature_200",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 201,
    "category": "performance_reliability",
    "title": "Request timeout handling.",
    "key": "feature_201",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 202,
    "category": "performance_reliability",
    "title": "Exponential retry.",
    "key": "feature_202",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 203,
    "category": "performance_reliability",
    "title": "Retry-After support.",
    "key": "feature_203",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 204,
    "category": "performance_reliability",
    "title": "Circuit breaker for AI providers.",
    "key": "feature_204",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 205,
    "category": "performance_reliability",
    "title": "Gemini/OpenAI provider fallback.",
    "key": "feature_205",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 206,
    "category": "performance_reliability",
    "title": "Model-health cache.",
    "key": "feature_206",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 207,
    "category": "performance_reliability",
    "title": "Server cold-start reduction.",
    "key": "feature_207",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 208,
    "category": "performance_reliability",
    "title": "Heavy imports dynamic-load \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8.",
    "key": "feature_208",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 209,
    "category": "performance_reliability",
    "title": "Background OCR queue.",
    "key": "feature_209",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 210,
    "category": "performance_reliability",
    "title": "Background video-processing queue.",
    "key": "feature_210",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 211,
    "category": "performance_reliability",
    "title": "Resumable upload recovery.",
    "key": "feature_211",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 212,
    "category": "performance_reliability",
    "title": "Upload pause/resume.",
    "key": "feature_212",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 213,
    "category": "performance_reliability",
    "title": "Network reconnect continuation.",
    "key": "feature_213",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 214,
    "category": "performance_reliability",
    "title": "Offline draft saving.",
    "key": "feature_214",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 215,
    "category": "performance_reliability",
    "title": "Service worker update prompt.",
    "key": "feature_215",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 216,
    "category": "performance_reliability",
    "title": "Stale asset-version recovery.",
    "key": "feature_216",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 217,
    "category": "performance_reliability",
    "title": "Dynamic-import failure auto reload.",
    "key": "feature_217",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 218,
    "category": "performance_reliability",
    "title": "Error boundary per route.",
    "key": "feature_218",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 219,
    "category": "performance_reliability",
    "title": "Health dashboard.",
    "key": "feature_219",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 220,
    "category": "performance_reliability",
    "title": "Automated synthetic monitoring.",
    "key": "feature_220",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 221,
    "category": "ui_ux",
    "title": "Single consistent white design system.",
    "key": "feature_221",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 222,
    "category": "ui_ux",
    "title": "Unified color tokens.",
    "key": "feature_222",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 223,
    "category": "ui_ux",
    "title": "Unified spacing scale.",
    "key": "feature_223",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 224,
    "category": "ui_ux",
    "title": "Unified border radius.",
    "key": "feature_224",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 225,
    "category": "ui_ux",
    "title": "Unified shadow system.",
    "key": "feature_225",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 226,
    "category": "ui_ux",
    "title": "Consistent typography hierarchy.",
    "key": "feature_226",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 227,
    "category": "ui_ux",
    "title": "Sinhala-compatible font stack.",
    "key": "feature_227",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 228,
    "category": "ui_ux",
    "title": "Dark navy only for primary actions.",
    "key": "feature_228",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 229,
    "category": "ui_ux",
    "title": "Green only for completed states.",
    "key": "feature_229",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 230,
    "category": "ui_ux",
    "title": "Red only for errors/destructive actions.",
    "key": "feature_230",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 231,
    "category": "ui_ux",
    "title": "Consistent button heights.",
    "key": "feature_231",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 232,
    "category": "ui_ux",
    "title": "Consistent form field heights.",
    "key": "feature_232",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 233,
    "category": "ui_ux",
    "title": "Clear hover states.",
    "key": "feature_233",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 234,
    "category": "ui_ux",
    "title": "Clear keyboard-focus states.",
    "key": "feature_234",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 235,
    "category": "ui_ux",
    "title": "Smooth page transitions.",
    "key": "feature_235",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 236,
    "category": "ui_ux",
    "title": "Route-specific skeletons.",
    "key": "feature_236",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 237,
    "category": "ui_ux",
    "title": "Skeleton dimensions match final content.",
    "key": "feature_237",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 238,
    "category": "ui_ux",
    "title": "Avoid full-page spinner after initial load.",
    "key": "feature_238",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 239,
    "category": "ui_ux",
    "title": "Preserve previous page data during tab switching.",
    "key": "feature_239",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 240,
    "category": "ui_ux",
    "title": "Empty-state illustrations without \u201CAI-generated\u201D appearance.",
    "key": "feature_240",
    "state": "planned",
    "priority": "normal",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 241,
    "category": "ui_ux",
    "title": "Sidebar tooltips when collapsed.",
    "key": "feature_241",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 242,
    "category": "ui_ux",
    "title": "Sidebar active-item indicator.",
    "key": "feature_242",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 243,
    "category": "ui_ux",
    "title": "Mobile bottom navigation.",
    "key": "feature_243",
    "state": "planned",
    "priority": "normal",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 244,
    "category": "ui_ux",
    "title": "Mobile safe-area support.",
    "key": "feature_244",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 245,
    "category": "ui_ux",
    "title": "Keyboard-open viewport handling.",
    "key": "feature_245",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 246,
    "category": "ui_ux",
    "title": "Chat composer attach to keyboard.",
    "key": "feature_246",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 247,
    "category": "ui_ux",
    "title": "Auto-growing textarea with maximum height.",
    "key": "feature_247",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 248,
    "category": "ui_ux",
    "title": "Mobile composer smaller padding.",
    "key": "feature_248",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 249,
    "category": "ui_ux",
    "title": "Scroll-to-latest button.",
    "key": "feature_249",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 250,
    "category": "ui_ux",
    "title": "Restore chat scroll position.",
    "key": "feature_250",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 251,
    "category": "ui_ux",
    "title": "Prevent horizontal mobile overflow.",
    "key": "feature_251",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 252,
    "category": "ui_ux",
    "title": "Modal height use `dvh`.",
    "key": "feature_252",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 253,
    "category": "ui_ux",
    "title": "Modal body independent scrolling.",
    "key": "feature_253",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 254,
    "category": "ui_ux",
    "title": "Sticky modal header.",
    "key": "feature_254",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 255,
    "category": "ui_ux",
    "title": "Sticky modal actions.",
    "key": "feature_255",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 256,
    "category": "ui_ux",
    "title": "Responsive paper cards.",
    "key": "feature_256",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 257,
    "category": "ui_ux",
    "title": "Responsive charts.",
    "key": "feature_257",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 258,
    "category": "ui_ux",
    "title": "Accessible chart summaries.",
    "key": "feature_258",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 259,
    "category": "ui_ux",
    "title": "Reduced-motion setting.",
    "key": "feature_259",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 260,
    "category": "ui_ux",
    "title": "Custom lightweight scrollbar.",
    "key": "feature_260",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 261,
    "category": "files_media",
    "title": "Simple file-row UI without fake previews.",
    "key": "feature_261",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 262,
    "category": "files_media",
    "title": "Clear file-type icon.",
    "key": "feature_262",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 263,
    "category": "files_media",
    "title": "Human-readable file size.",
    "key": "feature_263",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 264,
    "category": "files_media",
    "title": "Open/download actions grouped consistently.",
    "key": "feature_264",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 265,
    "category": "files_media",
    "title": "Upload percentage.",
    "key": "feature_265",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 266,
    "category": "files_media",
    "title": "Uploaded size/full size.",
    "key": "feature_266",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 267,
    "category": "files_media",
    "title": "Remaining size.",
    "key": "feature_267",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 268,
    "category": "files_media",
    "title": "Upload speed.",
    "key": "feature_268",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 269,
    "category": "files_media",
    "title": "ETA.",
    "key": "feature_269",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 270,
    "category": "files_media",
    "title": "Cancel and retry.",
    "key": "feature_270",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 271,
    "category": "files_media",
    "title": "Uploaded video persistent database record.",
    "key": "feature_271",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 272,
    "category": "files_media",
    "title": "Video processing state machine.",
    "key": "feature_272",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 273,
    "category": "files_media",
    "title": "Processing failure reason.",
    "key": "feature_273",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 274,
    "category": "files_media",
    "title": "HLS adaptive-quality generation.",
    "key": "feature_274",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 275,
    "category": "files_media",
    "title": "Quality selector.",
    "key": "feature_275",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 276,
    "category": "files_media",
    "title": "Short-lived playback sessions.",
    "key": "feature_276",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 277,
    "category": "files_media",
    "title": "Signed segment URLs/cookies.",
    "key": "feature_277",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 278,
    "category": "files_media",
    "title": "Per-user visible watermark.",
    "key": "feature_278",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 279,
    "category": "files_media",
    "title": "Disable raw MP4 production fallback.",
    "key": "feature_279",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 280,
    "category": "files_media",
    "title": "Existing videos secure-HLS reprocessing tool.",
    "key": "feature_280",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 281,
    "category": "security_quality",
    "title": "Revoke exposed Firebase service-account key.",
    "key": "feature_281",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 282,
    "category": "security_quality",
    "title": "Use one server credential JSON variable.",
    "key": "feature_282",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 283,
    "category": "security_quality",
    "title": "Secret-format validation without exposing values.",
    "key": "feature_283",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 284,
    "category": "security_quality",
    "title": "Firebase App Check enforcement.",
    "key": "feature_284",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 285,
    "category": "security_quality",
    "title": "Firestore rules automated tests.",
    "key": "feature_285",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 286,
    "category": "security_quality",
    "title": "Storage rules automated tests.",
    "key": "feature_286",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 287,
    "category": "security_quality",
    "title": "Rate limit by UID and IP.",
    "key": "feature_287",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 288,
    "category": "security_quality",
    "title": "Upload MIME/signature validation.",
    "key": "feature_288",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 289,
    "category": "security_quality",
    "title": "Antivirus/malware scanning.",
    "key": "feature_289",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 290,
    "category": "security_quality",
    "title": "CSP and security headers.",
    "key": "feature_290",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 291,
    "category": "security_quality",
    "title": "Dependency vulnerability updates.",
    "key": "feature_291",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 292,
    "category": "security_quality",
    "title": "Automated unit tests on every PR.",
    "key": "feature_292",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 293,
    "category": "security_quality",
    "title": "Authentication E2E tests.",
    "key": "feature_293",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 294,
    "category": "security_quality",
    "title": "PDF-QA E2E tests.",
    "key": "feature_294",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 295,
    "category": "security_quality",
    "title": "Video upload/playback E2E tests.",
    "key": "feature_295",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 296,
    "category": "security_quality",
    "title": "Structured logs with request IDs.",
    "key": "feature_296",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 297,
    "category": "security_quality",
    "title": "Google SEO landing pages by year/subject/lesson.",
    "key": "feature_297",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 298,
    "category": "security_quality",
    "title": "Sinhala/English/Singlish keyword metadata.",
    "key": "feature_298",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 299,
    "category": "security_quality",
    "title": "Sitemap, canonical URL and structured-data generation.",
    "key": "feature_299",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 300,
    "category": "security_quality",
    "title": "Core Web Vitals, error-rate and learning-outcome analytics.",
    "key": "feature_300",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  }
];
function summarizeFeatureCatalog(features = PLATFORM_FEATURES) {
  const byState = { available: 0, foundation: 0, planned: 0 };
  const byCategory = Object.fromEntries(
    Object.keys(FEATURE_CATEGORY_LABELS).map((category) => [category, { total: 0, available: 0, foundation: 0, planned: 0 }])
  );
  for (const feature of features) {
    byState[feature.state] += 1;
    byCategory[feature.category].total += 1;
    byCategory[feature.category][feature.state] += 1;
  }
  return {
    total: features.length,
    byState,
    byCategory,
    productionReadyPercent: Math.round(byState.available / Math.max(features.length, 1) * 100),
    integratedPercent: Math.round((byState.available + byState.foundation) / Math.max(features.length, 1) * 100)
  };
}

// server/platform/routes.ts
var router5 = (0, import_express10.Router)();
function isAdminUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return Boolean(user?.admin || roles.includes("admin") || roles.includes("ops"));
}
router5.get("/capabilities", async (req, res) => {
  try {
    const user = await requireUser(req);
    const category = String(req.query.category || "");
    const state = String(req.query.state || "");
    const query = String(req.query.q || "").trim().toLowerCase();
    const admin = isAdminUser(user);
    let features = PLATFORM_FEATURES;
    if (category && category in FEATURE_CATEGORY_LABELS) features = features.filter((feature) => feature.category === category);
    if (["available", "foundation", "planned"].includes(state)) features = features.filter((feature) => feature.state === state);
    if (query) features = features.filter((feature) => `${feature.id} ${feature.title} ${feature.key}`.toLowerCase().includes(query));
    const visibleFeatures = features.map((feature) => admin ? feature : { ...feature, implementationRefs: [] });
    return res.json({
      ok: true,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      admin,
      categoryLabels: FEATURE_CATEGORY_LABELS,
      summary: summarizeFeatureCatalog(PLATFORM_FEATURES),
      filteredSummary: summarizeFeatureCatalog(features),
      features: visibleFeatures
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "CAPABILITY_CATALOG_FAILED", message: error.message });
  }
});
router5.get("/health", async (req, res) => {
  try {
    const user = await requireUser(req);
    const admin = isAdminUser(user);
    const services = {
      firebaseAdmin: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_CLIENT_EMAIL),
      firebaseAppCheck: process.env.ENABLE_FIREBASE_APP_CHECK === "true",
      cloudVisionOcr: process.env.ENABLE_CLOUD_VISION_OCR === "true",
      geminiPdfOcr: Boolean(process.env.GEMINI_PDF_QA_MODEL || process.env.GEMINI_DEFAULT_MODEL),
      googleSearchGrounding: process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true",
      secureVideoHls: Boolean(process.env.VIDEO_CDN_BASE_URL && process.env.VIDEO_SIGNING_KEY),
      tts: process.env.ENABLE_TTS === "true",
      liveVoice: process.env.ENABLE_GEMINI_LIVE === "true"
    };
    const configured = Object.values(services).filter(Boolean).length;
    return res.json({
      ok: true,
      status: configured >= 4 ? "operational" : "degraded",
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      services,
      catalog: summarizeFeatureCatalog(),
      admin
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "PLATFORM_HEALTH_FAILED", message: error.message });
  }
});
router5.get("/source-review-queue", async (req, res) => {
  try {
    const user = await requireUser(req);
    if (!isAdminUser(user)) return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Admin access is required." });
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const snap = await getAdminDb().collection("rag_sources").orderBy("updatedAt", "desc").limit(250).get();
    const sources = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((source) => source.needsTextReview || source.indexStatus === "needs_ocr" || source.documentQuality?.corruptionRisk !== "low").slice(0, limit).map((source) => ({
      id: source.id,
      title: source.title || source.fileName,
      subject: source.subject || null,
      year: source.year || null,
      indexStatus: source.indexStatus || null,
      needsTextReview: Boolean(source.needsTextReview),
      lowConfidencePages: source.lowConfidencePages || [],
      documentQuality: source.documentQuality || null,
      duplicateOfSourceId: source.duplicateOfSourceId || null,
      updatedAt: source.updatedAt || null
    }));
    return res.json({ ok: true, sources, total: sources.length });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "SOURCE_REVIEW_QUEUE_FAILED", message: error.message });
  }
});
var routes_default = router5;

// server/tts/routes.ts
var import_express11 = require("express");
init_admin();
var import_crypto2 = __toESM(require("crypto"), 1);
var ttsRoutes = (0, import_express11.Router)();
var TTS_MAX_CHARS = parseInt(process.env.TTS_MAX_CHARS || "4500", 10);
var DAILY_TTS_LIMIT_PER_USER = 20;
function createTextHash(text, language, voice) {
  const normalized = text.trim().toLowerCase();
  return import_crypto2.default.createHash("sha256").update(`${normalized}_${language}_${voice}`).digest("hex");
}
ttsRoutes.post("/generate", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { text, languageCode, voice = "auto", format = "mp3" } = req.body;
    if (process.env.ENABLE_TTS === "false") {
      return res.status(403).json({ ok: false, code: "TTS_DISABLED", message: "TTS is disabled" });
    }
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "Text is required" });
    }
    const cleanText = text.replace(/```json[\s\S]*?```/g, "").replace(/\[.*?\]/g, "").trim();
    if (cleanText.length > TTS_MAX_CHARS) {
      return res.status(400).json({ ok: false, code: "TTS_TEXT_TOO_LONG", message: `Text exceeds ${TTS_MAX_CHARS} characters` });
    }
    const lang = languageCode || process.env.TTS_DEFAULT_LANGUAGE || "si-LK";
    const adminDb = getAdminDb();
    const textHash = createTextHash(cleanText, lang, voice);
    const cacheRef = adminDb.collection("tts_cache").doc(textHash);
    if (process.env.ENABLE_TTS_CACHE === "true") {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const data = cacheDoc.data();
        if (data?.storagePath) {
          return res.json({ ok: true, cached: true, storagePath: data.storagePath, provider: data.provider, voice: data.voice });
        }
      }
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const usageRef = adminDb.collection("users").doc(user.uid).collection("usage").doc(`tts_${today}`);
    let dailyUsage = 0;
    if (process.env.ENABLE_TTS_LIMITS === "true") {
      const usageDoc = await usageRef.get();
      dailyUsage = usageDoc.exists ? usageDoc.data()?.count || 0 : 0;
      if (dailyUsage >= DAILY_TTS_LIMIT_PER_USER) {
        return res.status(429).json({ ok: false, code: "TTS_DAILY_LIMIT", message: "Daily TTS limit reached." });
      }
    }
    const { generateGoogleTts: generateGoogleTts2 } = await Promise.resolve().then(() => (init_googleTts(), googleTts_exports));
    const audioData = await generateGoogleTts2({ text: cleanText, languageCode: lang, voice });
    const requestId = import_crypto2.default.randomUUID();
    const storagePath = `users/${user.uid}/tts/${requestId}/voice.mp3`;
    const storageBucket = getAdminBucket();
    const file = storageBucket.file(storagePath);
    await file.save(audioData.buffer, {
      contentType: "audio/mpeg"
    });
    const metadata = {
      id: requestId,
      ownerUid: user.uid,
      ownerEmail: user.email || "",
      textHash,
      language: lang,
      voice: audioData.voiceName || voice,
      provider: "google_cloud",
      storagePath,
      contentType: "audio/mpeg",
      chars: cleanText.length,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await adminDb.collection("tts_outputs").doc(requestId).set(metadata);
    if (process.env.ENABLE_TTS_CACHE === "true") {
      await cacheRef.set({ storagePath, provider: "google_cloud", voice: audioData.voiceName || voice, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (process.env.ENABLE_TTS_LIMITS === "true") {
      await usageRef.set({ count: dailyUsage + 1 }, { merge: true });
    }
    let audioUrl = "";
    try {
      const [signedUrl] = await file.getSignedUrl({ action: "read", expires: Date.now() + 1e3 * 60 * 60 * 24 });
      audioUrl = signedUrl;
    } catch (e) {
    }
    res.json({
      ok: true,
      audioUrl,
      storagePath,
      chars: cleanText.length,
      provider: "google_cloud",
      voice: audioData.voiceName || voice
    });
  } catch (error) {
    console.error("TTS generation error:", error);
    res.status(500).json({
      ok: false,
      code: error.code || "TTS_FAILED",
      message: error.message,
      providerError: error.providerError
    });
  }
});

// server/voice/routes.ts
var import_express12 = require("express");
init_admin();

// server/ai/pdfIntentDetector.ts
function detectPdfIntent(text) {
  const normalized = text.toLowerCase();
  const pdfKeywords = [
    "pdf",
    "paper",
    "\u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA",
    "prashna",
    "question",
    "marking",
    "scheme",
    "answer sheet",
    "page",
    "\u0DB4\u0DD2\u0DA7\u0DD4\u0DC0",
    "upload",
    "\u0DB8\u0DDA file \u0D91\u0D9A",
    "\u0DB8\u0DDA pdf \u0D91\u0D9A",
    "source",
    "q1",
    "q2",
    "mcq",
    "essay",
    "structured"
  ];
  const isPdfIntent = pdfKeywords.some((kw) => normalized.includes(kw));
  let subject = void 0;
  if (normalized.includes("sft") || normalized.includes("science for technology")) subject = "SFT";
  if (normalized.includes("et") || normalized.includes("engineering technology")) subject = "ET";
  if (normalized.includes("ict") || normalized.includes("information technology")) subject = "ICT";
  let questionType = "unknown";
  if (normalized.includes("mcq")) questionType = "mcq";
  else if (normalized.includes("structured")) questionType = "structured";
  else if (normalized.includes("essay")) questionType = "essay";
  const yearMatch = normalized.match(/\b(201\d|202\d)\b/);
  const year = yearMatch ? yearMatch[1] : void 0;
  const qMatch = normalized.match(/(?:q|question|ප්‍රශ්න|prashna)\s*(?:no|number|අංක)?\s*(\d+)/i);
  const questionNo = qMatch ? qMatch[1] : void 0;
  return {
    isPdfIntent,
    questionNo,
    questionType,
    subject,
    year,
    needsSourceSelection: isPdfIntent && !year && !subject
    // If they just say "this pdf" it needs source
  };
}

// server/voice/routes.ts
init_retrieve();
init_modelRouter();
var import_crypto3 = __toESM(require("crypto"), 1);
var voiceRoutes = (0, import_express12.Router)();
voiceRoutes.post("/live-turn", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { transcript, chatId, activeSubject, activeSourceId, recentAttachmentIds, usePdfContext } = req.body;
    if (!transcript) {
      return res.status(400).json({ ok: false, message: "Transcript is required" });
    }
    const intent = detectPdfIntent(transcript);
    let answerText = "";
    let mode = "live_normal_answer";
    let usedSources = [];
    let promptContext = "";
    const db = getAdminDb();
    if (intent.isPdfIntent && usePdfContext) {
      mode = "live_pdf_answer";
      let sourceIdToUse = activeSourceId;
      if (!sourceIdToUse && recentAttachmentIds && recentAttachmentIds.length > 0) {
        sourceIdToUse = recentAttachmentIds[0];
      }
      if (!sourceIdToUse && intent.needsSourceSelection) {
        return res.json({
          ok: true,
          mode: "live_pdf_answer",
          transcript,
          answerText: "\u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0D94\u0DB6\u0DA7 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA PDF \u0D91\u0D9A select \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD upload \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.",
          sources: []
        });
      }
      if (sourceIdToUse) {
        const retrieveResult = await retrieveRelevantKnowledge({
          query: transcript,
          subject: intent.subject || activeSubject || "general"
        });
        const activeChunks = retrieveResult.chunks || [];
        if (activeChunks.length > 0) {
          promptContext = "Here is the PDF context:\n" + activeChunks.map((c) => c.text).join("\n\n");
          usedSources = activeChunks.map((c) => ({
            sourceId: c.sourceId || sourceIdToUse,
            title: c.title || "Uploaded PDF",
            pageNumber: c.metadata?.pageNumber || c.page,
            confidence: c.similarity || 1,
            usedInAnswer: true
          }));
        } else {
          promptContext = "No relevant context found in the active PDF.";
        }
      }
    }
    let systemInstruction = "You are Clora X, a helpful AI tutor for Sri Lankan students. Answer concisely and conversationally in Sinhala.";
    let aiTask = "normal_chat";
    if (mode === "live_pdf_answer") {
      systemInstruction += " Use the provided PDF context to answer the user's question accurately. Do NOT guess if you are unsure based on the provided PDF context. If the evidence is missing, state 'PDF \u0D91\u0D9A\u0DD9\u0DB1\u0DCA verify \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB6\u0DD0\u0DBB\u0DD2 \u0DB1\u0DD2\u0DC3\u0DCF answer guess \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DD9 \u0DB1\u0DD0\u0DC4\u0DD0. PDF \u0D91\u0D9A select \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD reindex \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.'";
      aiTask = "direct_pdf_solve";
    }
    const aiRes = await callGeminiWithFallback(aiTask, {
      model: "gemini-2.5-flash",
      contents: promptContext ? `Context:
${promptContext}

Question: ${transcript}` : transcript,
      config: {
        systemInstruction,
        temperature: 0.3
      }
    });
    answerText = aiRes.result.text || "\u0DB8\u0DA7 \u0DAD\u0DDA\u0DBB\u0DD4\u0DAB\u0DDA \u0DB1\u0DD0\u0DC4\u0DD0. \u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0DB1\u0DD0\u0DC0\u0DAD \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1.";
    const { generateGoogleTts: generateGoogleTts2 } = await Promise.resolve().then(() => (init_googleTts(), googleTts_exports));
    const { getAdminBucket: getAdminBucket2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
    const storageBucket = getAdminBucket2();
    const cleanText = answerText.replace(/```json[\s\S]*?```/g, "").replace(/\[.*?\]/g, "").trim().substring(0, 4500);
    const audioData = await generateGoogleTts2({ text: cleanText, languageCode: "si-LK", voice: "auto" });
    const requestId = import_crypto3.default.randomUUID();
    const storagePath = `users/${user.uid}/tts/${requestId}/voice.mp3`;
    const file = storageBucket.file(storagePath);
    await file.save(audioData.buffer, { contentType: "audio/mpeg" });
    let ttsAudioUrl = "";
    try {
      const [signedUrl] = await file.getSignedUrl({ action: "read", expires: Date.now() + 1e3 * 60 * 60 * 24 });
      ttsAudioUrl = signedUrl;
    } catch (e) {
    }
    res.json({
      ok: true,
      mode,
      transcript,
      answerText,
      ttsStoragePath: storagePath,
      ttsAudioUrl,
      sources: usedSources
    });
  } catch (err) {
    console.error("Live turn error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// server/video/routes.ts
var import_node_crypto4 = __toESM(require("node:crypto"), 1);
var import_express13 = __toESM(require("express"), 1);
init_admin();

// server/video/videoService.ts
var import_node_crypto3 = __toESM(require("node:crypto"), 1);
var import_app_check = require("firebase-admin/app-check");
init_admin();
var QUALITY_LADDER = [
  { key: "144p", width: 256, height: 144, bitrate: 18e4 },
  { key: "240p", width: 426, height: 240, bitrate: 3e5 },
  { key: "360p", width: 640, height: 360, bitrate: 7e5 },
  { key: "480p", width: 854, height: 480, bitrate: 12e5 },
  { key: "720p", width: 1280, height: 720, bitrate: 25e5 },
  { key: "1080p", width: 1920, height: 1080, bitrate: 5e6 },
  { key: "1440p", width: 2560, height: 1440, bitrate: 9e6 },
  { key: "2160p", width: 3840, height: 2160, bitrate: 16e6 }
];
function safeVideoFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 120);
}
async function verifyVideoAppCheck(req) {
  if (!env.VIDEO_REQUIRE_APP_CHECK) return;
  const token = req.header("X-Firebase-AppCheck");
  if (!token) throw new Error("APP_CHECK_REQUIRED");
  const app2 = getAdminApp();
  if (!app2) throw new Error("APP_CHECK_UNAVAILABLE");
  await (0, import_app_check.getAppCheck)(app2).verifyToken(token);
}
async function validateUploadedVideo(video) {
  const bucket = getAdminBucketByName(video.inputBucket);
  const file = bucket.file(video.inputObjectPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("VIDEO_SOURCE_MISSING");
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size || 0);
  const maxBytes = env.VIDEO_UPLOAD_MAX_MB * 1024 * 1024;
  if (size <= 0 || size > maxBytes) throw new Error("VIDEO_SIZE_INVALID");
  const [head] = await file.download({ start: 0, end: 15 });
  const isIsoMedia = head.length >= 12 && head.subarray(4, 8).toString("ascii") === "ftyp";
  const isWebm = head.length >= 4 && head.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  if (!isIsoMedia && !isWebm) throw new Error("VIDEO_CONTAINER_UNSUPPORTED");
  return {
    sizeBytes: size,
    generation: metadata.generation,
    contentType: metadata.contentType || video.mimeType
  };
}
function selectQualityProfiles(video) {
  const height = video.sourceHeight || 720;
  const requested = new Set(video.qualityProfiles?.length ? video.qualityProfiles : ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p"]);
  return QUALITY_LADDER.filter((quality) => {
    if (!requested.has(quality.key)) return false;
    if (quality.height > height) return false;
    if (quality.key === "2160p" && !env.ENABLE_4K) return false;
    return true;
  });
}
async function startTranscode(video) {
  if (!env.ENABLE_VIDEO_TRANSCODING) {
    return { enabled: false, jobName: null };
  }
  const qualities = selectQualityProfiles(video);
  if (qualities.length === 0) throw new Error("VIDEO_NO_VALID_RENDITIONS");
  const audioKey = "audio-main";
  const elementaryStreams = qualities.map((quality) => ({
    key: `video-${quality.key}`,
    videoStream: {
      h264: {
        widthPixels: quality.width,
        heightPixels: quality.height,
        bitrateBps: quality.bitrate,
        frameRate: 30,
        pixelFormat: "yuv420p",
        rateControlMode: "vbr"
      }
    }
  }));
  elementaryStreams.push({
    key: audioKey,
    audioStream: { codec: "aac", bitrateBps: 128e3, channelCount: 2, channelLayout: ["fl", "fr"] }
  });
  const muxStreams = qualities.map((quality) => ({
    key: `hls-${quality.key}`,
    container: "ts",
    elementaryStreams: [`video-${quality.key}`, audioKey],
    segmentSettings: { segmentDuration: "6s" }
  }));
  const project = env.GOOGLE_CLOUD_PROJECT;
  const location = env.VIDEO_TRANSCODER_LOCATION;
  const endpoint = `https://transcoder.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/jobs`;
  const token = await getGoogleAccessToken();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputUri: `gs://${video.inputBucket}/${video.inputObjectPath}`,
      outputUri: `gs://${env.VIDEO_OUTPUT_BUCKET}/${video.hlsPrefix}`,
      config: {
        elementaryStreams,
        muxStreams,
        manifests: [{
          fileName: "master.m3u8",
          type: "HLS",
          muxStreams: muxStreams.map((stream) => stream.key)
        }]
      },
      labels: { video_id: video.id, source_id: video.sourceId, version: String(video.version) }
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.name) {
    throw new Error(payload?.error?.message || `TRANSCODER_CREATE_FAILED_${response.status}`);
  }
  return { enabled: true, jobName: payload.name };
}
async function refreshTranscodeStatus(video) {
  const updatedAtMs = Date.parse(video.updatedAt || video.createdAt || "");
  const failedWithoutUsableJob = video.status === "failed";
  const uploadedWithoutActiveJob = video.status === "uploaded" && !video.transcoderJobName && Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > 3e4;
  if (env.VIDEO_ALLOW_DIRECT_PLAYBACK && (failedWithoutUsableJob || uploadedWithoutActiveJob) && video.inputObjectPath) {
    const updates2 = {
      status: "ready",
      isPublished: true,
      allowPlayback: true,
      playbackMode: "direct",
      transcoderErrorCode: video.status === "failed" ? "TRANSCODER_FAILED_DIRECT_RECOVERY" : void 0,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await getAdminDb().collection("videos").doc(video.id).set({
      ...updates2,
      transcoderErrorCode: updates2.transcoderErrorCode || null
    }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({ processingStatus: updates2.status, lastErrorCode: updates2.transcoderErrorCode || null, updatedAt: updates2.updatedAt }, { merge: true });
    return { ...video, ...updates2 };
  }
  if (!video.transcoderJobName || !["queued", "transcoding"].includes(video.status)) return video;
  const queuedAt = Date.parse(video.updatedAt || video.createdAt || "");
  const fallbackToDirect = async (reason) => {
    const allowDirect = env.VIDEO_ALLOW_DIRECT_PLAYBACK;
    const updates2 = {
      status: allowDirect ? "ready" : "failed",
      isPublished: allowDirect,
      allowPlayback: allowDirect,
      playbackMode: allowDirect ? "direct" : "hls",
      transcoderErrorCode: reason,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await getAdminDb().collection("videos").doc(video.id).set(updates2, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({ processingStatus: updates2.status, lastErrorCode: reason, updatedAt: updates2.updatedAt }, { merge: true });
    return { ...video, ...updates2 };
  };
  if (Number.isFinite(queuedAt) && Date.now() - queuedAt > 30 * 60 * 1e3) {
    return fallbackToDirect("TRANSCODER_TIMEOUT_DIRECT_FALLBACK");
  }
  const token = await getGoogleAccessToken();
  const response = await fetch(`https://transcoder.googleapis.com/v1/${video.transcoderJobName}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    return Number.isFinite(queuedAt) && Date.now() - queuedAt > 5 * 60 * 1e3 ? fallbackToDirect(`TRANSCODER_STATUS_${response.status}`) : video;
  }
  const job = await response.json();
  const state = String(job.state || "").toUpperCase();
  let status = video.status;
  if (state === "RUNNING") status = "transcoding";
  if (state === "SUCCEEDED") status = "ready";
  if (state === "FAILED") return fallbackToDirect("TRANSCODER_FAILED_DIRECT_FALLBACK");
  if (status === video.status) return video;
  const updates = {
    status,
    allowPlayback: status === "ready" ? video.allowPlayback : false,
    transcoderErrorCode: job.error?.code ? String(job.error.code) : void 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await getAdminDb().collection("videos").doc(video.id).set(updates, { merge: true });
  await getAdminDb().collection("sources").doc(video.sourceId).set({
    processingStatus: status === "ready" ? "ready" : status,
    lastErrorCode: updates.transcoderErrorCode || null,
    updatedAt: updates.updatedAt
  }, { merge: true });
  return { ...video, ...updates };
}
function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeSigningKey(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - normalized.length % 4) : "";
  return Buffer.from(normalized + padding, "base64");
}
function createSignedPlaybackCookie(video) {
  if (!env.VIDEO_CDN_BASE_URL || !env.VIDEO_CDN_KEY_NAME || !env.VIDEO_CDN_SIGNING_KEY) {
    throw new Error("VIDEO_CDN_NOT_CONFIGURED");
  }
  const prefix = `${env.VIDEO_CDN_BASE_URL}/videos/${video.id}/versions/${video.version}/hls/`;
  const expires = Math.floor(Date.now() / 1e3) + env.VIDEO_COOKIE_TTL_SECONDS;
  const policy = `URLPrefix=${base64Url(prefix)}:Expires=${expires}:KeyName=${env.VIDEO_CDN_KEY_NAME}`;
  const signature = import_node_crypto3.default.createHmac("sha1", decodeSigningKey(env.VIDEO_CDN_SIGNING_KEY)).update(policy).digest();
  return {
    cookieValue: `${policy}:Signature=${base64Url(signature)}`,
    manifestUrl: `${prefix}master.m3u8`,
    path: `/videos/${video.id}/versions/${video.version}/hls/`,
    expiresAt: new Date(expires * 1e3).toISOString()
  };
}
async function createDirectPlaybackUrl(video) {
  const bucket = getAdminBucketByName(video.inputBucket);
  const expiresAtMs = Date.now() + env.VIDEO_SESSION_TTL_SECONDS * 1e3;
  const [url] = await bucket.file(video.inputObjectPath).getSignedUrl({
    action: "read",
    expires: expiresAtMs,
    responseDisposition: "inline",
    responseType: video.mimeType || "video/mp4"
  });
  return { url, expiresAt: new Date(expiresAtMs).toISOString() };
}
function canUserPlayVideo(video, user) {
  if (user.admin) return true;
  if (!video.isPublished || !video.allowPlayback || video.status !== "ready") return false;
  if (video.allowedUserIds?.includes(user.uid)) return true;
  if (video.allowedRoles?.some((role) => user.roles?.includes(role))) return true;
  if (video.visibility === "public") return true;
  return ["class", "institution"].includes(video.visibility) && !video.allowedUserIds?.length && !video.allowedRoles?.length;
}

// server/video/routes.ts
init_chatSanitizer();
var videoRoutes = import_express13.default.Router();
var VIDEO_MIME_TYPES = /* @__PURE__ */ new Set(["video/mp4", "video/quicktime", "video/webm", "application/octet-stream"]);
function publicVideo(video) {
  const { inputBucket, inputObjectPath, transcoderJobName, ...safe } = video;
  return safe;
}
async function loadVideo(videoId) {
  const snapshot = await getAdminDb().collection("videos").doc(videoId).get();
  if (!snapshot.exists) throw new Error("VIDEO_NOT_FOUND");
  return { id: snapshot.id, ...snapshot.data() };
}
function requireVideoEnabled() {
  if (!env.ENABLE_VIDEO) throw new Error("VIDEO_FEATURE_DISABLED");
}
videoRoutes.use((_req, res, next) => {
  if (!env.ENABLE_VIDEO) return res.status(404).json({ ok: false, code: "VIDEO_FEATURE_DISABLED" });
  next();
});
videoRoutes.post("/admin/videos", async (req, res) => {
  try {
    requireVideoEnabled();
    await verifyVideoAppCheck(req);
    const admin = await requireAdmin(req);
    const {
      title,
      description,
      subject,
      lesson,
      concept,
      visibility = "private",
      originalFileName,
      mimeType,
      sizeBytes,
      width,
      height,
      durationMs,
      qualityProfiles
    } = req.body || {};
    if (!title || !originalFileName || !mimeType || !Number.isFinite(Number(sizeBytes))) {
      return res.status(400).json({ ok: false, code: "VIDEO_METADATA_INVALID", message: "Missing video metadata." });
    }
    if (!VIDEO_MIME_TYPES.has(mimeType)) {
      return res.status(415).json({ ok: false, code: "VIDEO_MIME_UNSUPPORTED", message: "Use MP4, MOV, or WebM video." });
    }
    if (Number(sizeBytes) > env.VIDEO_UPLOAD_MAX_MB * 1024 * 1024) {
      return res.status(413).json({ ok: false, code: "VIDEO_TOO_LARGE", message: `Maximum video size is ${env.VIDEO_UPLOAD_MAX_MB} MB.` });
    }
    const db = getAdminDb();
    const videoRef = db.collection("videos").doc();
    const sourceRef = db.collection("sources").doc();
    const version = 1;
    const inputObjectPath = `videos/${videoRef.id}/versions/${version}/source/${safeVideoFileName(originalFileName)}`;
    const hlsPrefix = `videos/${videoRef.id}/versions/${version}/hls/`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const selectedQualities = Array.isArray(qualityProfiles) && qualityProfiles.length ? qualityProfiles.map(String) : ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p"];
    const video = {
      id: videoRef.id,
      sourceId: sourceRef.id,
      title: String(title).trim().slice(0, 180),
      description: description ? String(description).trim().slice(0, 2e3) : void 0,
      subject: subject ? String(subject).toUpperCase().slice(0, 20) : void 0,
      lesson: lesson ? String(lesson).slice(0, 180) : void 0,
      concept: concept ? String(concept).slice(0, 180) : void 0,
      status: "draft",
      visibility: ["private", "class", "institution", "public"].includes(visibility) ? visibility : "private",
      allowedRoles: [],
      allowedUserIds: [],
      inputBucket: env.VIDEO_INPUT_BUCKET,
      inputObjectPath,
      hlsPrefix,
      masterManifestPath: `${hlsPrefix}master.m3u8`,
      sourceSizeBytes: Number(sizeBytes),
      sourceWidth: Number(width) || void 0,
      sourceHeight: Number(height) || void 0,
      durationMs: Number(durationMs) || void 0,
      mimeType,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
      isPublished: false,
      allowPlayback: false,
      watermarkEnabled: true,
      maxConcurrentSessions: 1,
      qualityProfiles: selectedQualities,
      version
    };
    await db.runTransaction(async (tx) => {
      tx.create(videoRef, removeUndefinedDeep(video));
      tx.create(sourceRef, removeUndefinedDeep({
        sourceId: sourceRef.id,
        ownerUid: admin.uid,
        notebookIds: [],
        visibility: video.visibility,
        displayTitle: video.title,
        originalFileName,
        normalizedName: safeVideoFileName(originalFileName).toLowerCase(),
        normalizedStem: safeVideoFileName(originalFileName).replace(/\.[^.]+$/, "").toLowerCase(),
        aliases: [video.title],
        sha256: "0".repeat(64),
        sourceVersion: version,
        processingVersion: 1,
        mimeType,
        mediaKind: "video",
        resourceRole: "video",
        sizeBytes: Number(sizeBytes),
        durationMs: video.durationMs,
        subject: video.subject,
        storagePath: inputObjectPath,
        hlsPrefix,
        masterManifestPath: video.masterManifestPath,
        processingStatus: "uploaded",
        chunkCount: 0,
        createdAt: now,
        updatedAt: now
      }));
    });
    res.status(201).json({ ok: true, videoId: video.id, sourceId: video.sourceId, version });
  } catch (error) {
    const status = String(error?.message).includes("Forbidden") ? 403 : 500;
    res.status(status).json({ ok: false, code: "VIDEO_CREATE_FAILED", message: error.message });
  }
});
videoRoutes.post("/admin/videos/:videoId/create-upload", async (req, res) => {
  try {
    requireVideoEnabled();
    await verifyVideoAppCheck(req);
    const admin = await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    if (video.createdBy !== admin.uid && !admin.admin) throw new Error("VIDEO_FORBIDDEN");
    if (!["draft", "uploading", "failed"].includes(video.status)) throw new Error("VIDEO_UPLOAD_STATE_INVALID");
    if (String(req.body?.mimeType || video.mimeType) !== video.mimeType || Number(req.body?.sizeBytes) !== video.sourceSizeBytes) {
      throw new Error("VIDEO_UPLOAD_METADATA_MISMATCH");
    }
    const bucket = getAdminBucketByName(video.inputBucket);
    const file = bucket.file(video.inputObjectPath);
    const origin = req.header("origin") || void 0;
    const [uploadUrl] = await file.createResumableUpload({
      origin,
      metadata: {
        contentType: video.mimeType,
        metadata: {
          ownerUid: admin.uid,
          videoId: video.id,
          sourceId: video.sourceId,
          sourceVersion: String(video.version)
        }
      },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
    await getAdminDb().collection("videos").doc(video.id).set({ status: "uploading", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    res.json({
      ok: true,
      uploadUrl,
      storagePath: video.inputObjectPath,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
    });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEO_UPLOAD_SESSION_FAILED", message: error.message });
  }
});
videoRoutes.post("/admin/videos/:videoId/upload-complete", async (req, res) => {
  try {
    requireVideoEnabled();
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    if (["queued", "transcoding", "ready"].includes(video.status)) {
      return res.json({
        ok: true,
        videoId: video.id,
        sourceId: video.sourceId,
        status: video.status,
        transcodeQueued: video.status !== "ready",
        idempotent: true
      });
    }
    if (!["uploading", "uploaded", "failed"].includes(video.status)) throw new Error("VIDEO_FINALIZE_STATE_INVALID");
    const validated = await validateUploadedVideo(video);
    if (validated.sizeBytes !== video.sourceSizeBytes) throw new Error("VIDEO_SIZE_MISMATCH");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await getAdminDb().collection("videos").doc(video.id).set({
      status: "uploaded",
      uploadGeneration: validated.generation,
      sourceSizeBytes: validated.sizeBytes,
      updatedAt: now
    }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({
      processingStatus: "uploaded",
      sizeBytes: validated.sizeBytes,
      updatedAt: now
    }, { merge: true });
    let transcode = { enabled: false, jobName: null };
    try {
      transcode = await startTranscode({ ...video, status: "uploaded", sourceSizeBytes: validated.sizeBytes });
      if (transcode.enabled && transcode.jobName) {
        await getAdminDb().collection("videos").doc(video.id).set({
          status: "queued",
          transcoderJobName: transcode.jobName,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        await getAdminDb().collection("sources").doc(video.sourceId).set({ processingStatus: "queued" }, { merge: true });
      }
    } catch (error) {
      console.warn("Secure video transcoding unavailable.", error?.message || error);
      transcode = { enabled: false, jobName: null };
    }
    const fallbackReady = !transcode.enabled;
    if (fallbackReady) {
      const allowDirect = env.VIDEO_ALLOW_DIRECT_PLAYBACK;
      await getAdminDb().collection("videos").doc(video.id).set({
        status: allowDirect ? "ready" : "failed",
        isPublished: allowDirect,
        allowPlayback: allowDirect,
        playbackMode: allowDirect ? "direct" : "hls",
        transcoderErrorCode: allowDirect ? null : "SECURE_TRANSCODING_REQUIRED",
        publishedAt: allowDirect ? now : null,
        updatedAt: now
      }, { merge: true });
      await getAdminDb().collection("sources").doc(video.sourceId).set({
        processingStatus: allowDirect ? "ready" : "failed",
        lastErrorCode: allowDirect ? null : "SECURE_TRANSCODING_REQUIRED",
        updatedAt: now
      }, { merge: true });
    } else {
      await getAdminDb().collection("videos").doc(video.id).set({
        isPublished: true,
        allowPlayback: true,
        playbackMode: "hls",
        updatedAt: now
      }, { merge: true });
    }
    res.json({
      ok: true,
      videoId: video.id,
      sourceId: video.sourceId,
      status: transcode.enabled ? "queued" : env.VIDEO_ALLOW_DIRECT_PLAYBACK ? "ready" : "failed",
      transcodeQueued: transcode.enabled,
      playbackMode: transcode.enabled ? "hls" : env.VIDEO_ALLOW_DIRECT_PLAYBACK ? "direct" : "hls",
      message: !transcode.enabled && !env.VIDEO_ALLOW_DIRECT_PLAYBACK ? "Upload saved. Secure HLS processing is not configured; the video remains available for admin reprocessing." : void 0
    });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEO_FINALIZE_FAILED", message: error.message });
  }
});
videoRoutes.post("/admin/videos/:videoId/transcode", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    if (!["uploaded", "failed"].includes(video.status)) throw new Error("VIDEO_TRANSCODE_STATE_INVALID");
    const result = await startTranscode(video);
    if (!result.enabled || !result.jobName) throw new Error("VIDEO_TRANSCODING_DISABLED");
    await getAdminDb().collection("videos").doc(video.id).set({ status: "queued", transcoderJobName: result.jobName, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    res.json({ ok: true, status: "queued" });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEO_TRANSCODE_FAILED", message: error.message });
  }
});
videoRoutes.post("/admin/videos/:videoId/reprocess", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const current = await loadVideo(req.params.videoId);
    if (!["ready", "failed", "uploaded", "unpublished"].includes(current.status)) throw new Error("VIDEO_REPROCESS_STATE_INVALID");
    const nextVersion = current.version + 1;
    const video = {
      ...current,
      version: nextVersion,
      hlsPrefix: `videos/${current.id}/versions/${nextVersion}/hls/`,
      masterManifestPath: `videos/${current.id}/versions/${nextVersion}/hls/master.m3u8`
    };
    const result = await startTranscode(video);
    if (!result.enabled || !result.jobName) throw new Error("VIDEO_TRANSCODING_DISABLED");
    await getAdminDb().collection("videos").doc(video.id).set({
      version: nextVersion,
      hlsPrefix: video.hlsPrefix,
      masterManifestPath: video.masterManifestPath,
      status: "queued",
      isPublished: false,
      allowPlayback: false,
      transcoderJobName: result.jobName,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({
      sourceVersion: nextVersion,
      processingVersion: Number(current.processingVersion || 1) + 1,
      processingStatus: "queued",
      hlsPrefix: video.hlsPrefix,
      masterManifestPath: video.masterManifestPath,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    res.json({ ok: true, status: "queued", version: nextVersion });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEO_REPROCESS_FAILED", message: error.message });
  }
});
videoRoutes.patch("/admin/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const allowed = ["title", "description", "subject", "lesson", "concept", "visibility", "allowedRoles", "allowedUserIds", "watermarkEnabled", "maxConcurrentSessions", "qualityProfiles"];
    const updates = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    for (const key of allowed) if (req.body?.[key] !== void 0) updates[key] = req.body[key];
    await getAdminDb().collection("videos").doc(req.params.videoId).set(updates, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEO_UPDATE_FAILED", message: error.message });
  }
});
for (const action of ["publish", "unpublish"]) {
  videoRoutes.post(`/admin/videos/:videoId/${action}`, async (req, res) => {
    try {
      await verifyVideoAppCheck(req);
      await requireAdmin(req);
      const video = await loadVideo(req.params.videoId);
      if (action === "publish" && video.status !== "ready") throw new Error("VIDEO_NOT_READY");
      await getAdminDb().collection("videos").doc(video.id).set({
        isPublished: action === "publish",
        allowPlayback: action === "publish",
        status: action === "unpublish" ? "unpublished" : "ready",
        publishedAt: action === "publish" ? (/* @__PURE__ */ new Date()).toISOString() : null,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
      res.json({ ok: true, published: action === "publish" });
    } catch (error) {
      res.status(400).json({ ok: false, code: `VIDEO_${action.toUpperCase()}_FAILED`, message: error.message });
    }
  });
}
videoRoutes.delete("/admin/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    await getAdminDb().collection("videos").doc(video.id).set({ status: "archived", isPublished: false, allowPlayback: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({ processingStatus: "deleted", deletedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    res.json({ ok: true, archived: true });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEO_DELETE_FAILED", message: error.message });
  }
});
videoRoutes.get("/admin/videos", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const snapshot = await getAdminDb().collection("videos").orderBy("createdAt", "desc").limit(100).get();
    const videos = await Promise.all(snapshot.docs.map(async (doc) => {
      const video = { id: doc.id, ...doc.data() };
      return publicVideo(await refreshTranscodeStatus(video));
    }));
    res.json({ ok: true, videos });
  } catch (error) {
    res.status(400).json({ ok: false, code: "VIDEOS_LIST_FAILED", message: error.message });
  }
});
videoRoutes.get("/admin/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await refreshTranscodeStatus(await loadVideo(req.params.videoId));
    res.json({ ok: true, video: publicVideo(video) });
  } catch (error) {
    res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: error.message });
  }
});
videoRoutes.get("/videos", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const snapshot = await getAdminDb().collection("videos").orderBy("createdAt", "desc").limit(100).get();
    const refreshed = await Promise.all(snapshot.docs.map(
      (doc) => refreshTranscodeStatus({ id: doc.id, ...doc.data() })
    ));
    const videos = refreshed.filter((video) => video.status !== "archived" && video.isPublished === true).filter((video) => canUserPlayVideo(video, user)).map(publicVideo);
    res.json({ ok: true, videos });
  } catch (error) {
    res.status(401).json({ ok: false, code: "VIDEOS_ACCESS_FAILED", message: error.message });
  }
});
videoRoutes.get("/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const video = await refreshTranscodeStatus(await loadVideo(req.params.videoId));
    if (!canUserPlayVideo(video, user)) return res.status(403).json({ ok: false, code: "VIDEO_FORBIDDEN" });
    res.json({ ok: true, video: publicVideo(video) });
  } catch (error) {
    res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: error.message });
  }
});
videoRoutes.post("/videos/:videoId/playback-session", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const video = await refreshTranscodeStatus(await loadVideo(req.params.videoId));
    if (!canUserPlayVideo(video, user)) return res.status(403).json({ ok: false, code: "VIDEO_FORBIDDEN" });
    const db = getAdminDb();
    const active = await db.collection("videoPlaybackSessions").where("userId", "==", user.uid).where("status", "==", "active").limit(Math.max(1, video.maxConcurrentSessions)).get();
    const now = Date.now();
    const liveSessions = active.docs.filter((doc) => Number(doc.data().expiresAtMs || 0) > now);
    if (liveSessions.length >= video.maxConcurrentSessions) {
      return res.status(409).json({ ok: false, code: "PLAYBACK_SESSION_LIMIT", message: "This account already has an active playback session." });
    }
    const directPlayback = env.VIDEO_ALLOW_DIRECT_PLAYBACK && (!video.transcoderJobName || video.playbackMode === "direct");
    if (!directPlayback && (video.playbackMode === "direct" || !video.transcoderJobName)) {
      return res.status(409).json({
        ok: false,
        code: "VIDEO_SECURE_STREAM_NOT_READY",
        message: "Secure HLS processing is not complete. Ask an admin to reprocess this video."
      });
    }
    const signed = directPlayback ? null : createSignedPlaybackCookie(video);
    const sessionRef = db.collection("videoPlaybackSessions").doc();
    const expiresAtMs = now + env.VIDEO_SESSION_TTL_SECONDS * 1e3;
    await sessionRef.set({
      sessionId: sessionRef.id,
      userId: user.uid,
      videoId: video.id,
      deviceId: String(req.header("X-Device-ID") || "unknown").slice(0, 160),
      userAgentHash: import_node_crypto4.default.createHash("sha256").update(String(req.header("user-agent") || "unknown")).digest("hex"),
      createdAt: new Date(now).toISOString(),
      lastHeartbeatAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      status: "active"
    });
    if (signed) {
      res.cookie("Cloud-CDN-Cookie", signed.cookieValue, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        domain: env.VIDEO_COOKIE_DOMAIN || void 0,
        path: signed.path,
        maxAge: env.VIDEO_COOKIE_TTL_SECONDS * 1e3
      });
    }
    const direct = directPlayback ? await createDirectPlaybackUrl(video) : null;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      sessionId: sessionRef.id,
      playbackMode: direct ? "direct" : "hls",
      directUrl: direct?.url,
      manifestUrl: signed?.manifestUrl,
      expiresAt: direct?.expiresAt || signed?.expiresAt,
      watermark: { userId: user.uid, label: user.email || user.uid }
    });
  } catch (error) {
    res.status(400).json({ ok: false, code: "PLAYBACK_SESSION_FAILED", message: error.message });
  }
});
videoRoutes.post("/video-sessions/:sessionId/heartbeat", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const ref = getAdminDb().collection("videoPlaybackSessions").doc(req.params.sessionId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== user.uid || snapshot.data()?.status !== "active") {
      return res.status(403).json({ ok: false, code: "SESSION_REVOKED" });
    }
    const expiresAtMs = Date.now() + env.VIDEO_SESSION_TTL_SECONDS * 1e3;
    await ref.set({ lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString(), expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs }, { merge: true });
    res.json({ ok: true, expiresAt: new Date(expiresAtMs).toISOString() });
  } catch (error) {
    res.status(400).json({ ok: false, code: "SESSION_HEARTBEAT_FAILED", message: error.message });
  }
});
videoRoutes.post("/video-sessions/:sessionId/end", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const ref = getAdminDb().collection("videoPlaybackSessions").doc(req.params.sessionId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== user.uid) return res.status(403).json({ ok: false, code: "SESSION_FORBIDDEN" });
    await ref.set({ status: "revoked", endedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, code: "SESSION_END_FAILED", message: error.message });
  }
});

// server/utils/rateLimiter.ts
var store = /* @__PURE__ */ new Map();
function buildRateLimiter(options) {
  return (req, res, next) => {
    const now = Date.now();
    const user = req.user;
    const isAuth = !!user;
    const isAnonymous = user?.isAnonymous === true;
    const roles = user?.roles || [];
    const isAdmin = user?.admin === true || roles.includes("admin") || roles.includes("ops");
    let max = options.defaultMax;
    if (options.limitByRole) {
      if (!isAuth || isAnonymous) {
        max = options.limitByRole.anonymous;
      } else if (isAdmin) {
        max = options.limitByRole.admin;
      } else {
        max = options.limitByRole.student;
      }
    }
    let key = "";
    if (isAuth && user.uid) {
      key = `uid:${options.keyPrefix}:${user.uid}`;
    } else {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "unknown-ip";
      const clientIp = Array.isArray(ip) ? ip[0] : typeof ip === "string" ? ip.split(",")[0].trim() : "unknown-ip";
      key = `ip:${options.keyPrefix}:${clientIp}`;
    }
    const record = store.get(key);
    if (!record || record.resetTime <= now) {
      store.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      });
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + options.windowMs) / 1e3));
      return next();
    }
    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1e3);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1e3));
      return res.status(429).json({
        ok: false,
        code: "RATE_LIMITED",
        retryAfterSeconds,
        message: `Too many requests. Please retry after ${retryAfterSeconds} seconds.`
      });
    }
    record.count++;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", max - record.count);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1e3));
    next();
  };
}
var globalLimiter = buildRateLimiter({
  windowMs: 60 * 1e3,
  keyPrefix: "global",
  defaultMax: 100,
  limitByRole: {
    anonymous: 40,
    student: 120,
    admin: 300
  }
});
var aiLimiter = buildRateLimiter({
  windowMs: 60 * 1e3,
  keyPrefix: "ai",
  defaultMax: 20,
  limitByRole: {
    anonymous: 5,
    student: 30,
    admin: 100
  }
});
var adminLimiter = buildRateLimiter({
  windowMs: 60 * 1e3,
  keyPrefix: "admin",
  defaultMax: 10,
  limitByRole: {
    anonymous: 1,
    student: 2,
    admin: 60
  }
});

// server/utils/requestContext.ts
var import_node_crypto5 = __toESM(require("node:crypto"), 1);

// server/utils/logger.ts
function redactString(str) {
  if (!str) return str;
  let redacted = str;
  redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/ig, "Bearer [REDACTED]");
  redacted = redacted.replace(/[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");
  redacted = redacted.replace(/AIzaSy[a-zA-Z0-9_\-]{33}/g, "AIzaSy[REDACTED]");
  return redacted;
}
function redactObject(obj) {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return redactString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item));
  }
  if (typeof obj === "object") {
    const result = {};
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = [
        "authorization",
        "cookie",
        "token",
        "key",
        "secret",
        "password",
        "private",
        "email",
        "prompt",
        "text",
        "body",
        "ocr",
        "payload",
        "credential",
        "cert",
        "url",
        "signedurl",
        "private_key"
      ].some((k) => lowerKey.includes(k));
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
var logger = {
  info(message, meta) {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(redactObject(meta)) : "");
  },
  warn(message, meta) {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(redactObject(meta)) : "");
  },
  error(message, error, meta) {
    const redactedMeta = meta ? redactObject(meta) : {};
    let errorMsg = error;
    if (error instanceof Error) {
      errorMsg = {
        message: redactString(error.message),
        name: error.name,
        stack: error.stack ? redactString(error.stack).split("\n").slice(0, 3).join("\n") : void 0
      };
    } else {
      errorMsg = redactObject(error);
    }
    console.error(`[ERROR] ${message}`, { error: errorMsg, ...redactedMeta });
  }
};

// server/utils/requestContext.ts
function requestContextMiddleware(req, res, next) {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  const requestId = /^[A-Za-z0-9._:-]{8,120}$/.test(incoming) ? incoming : import_node_crypto5.default.randomUUID();
  const startedAt = Date.now();
  req.requestId = requestId;
  req.requestStartedAt = startedAt;
  res.setHeader("X-Request-ID", requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    if (res.statusCode >= 400 || process.env.DEBUG_API === "true") {
      logger.info("request_completed", {
        requestId,
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        durationMs
      });
    }
  });
  next();
}

// server.ts
init_admin();
init_sourceInventoryService();

// server/utils/authGuards.ts
init_admin();
function sendUnauthenticated(res, message = "Authentication is required.") {
  return res.status(401).json({
    ok: false,
    code: "UNAUTHENTICATED",
    message,
    requestId: res.getHeader("x-request-id") || Math.random().toString(36).substring(7)
  });
}
function sendForbidden(res, message = "You do not have permission to perform this action.") {
  return res.status(403).json({
    ok: false,
    code: "FORBIDDEN",
    message,
    requestId: res.getHeader("x-request-id") || Math.random().toString(36).substring(7)
  });
}
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const user = await verifyAndExtractUser(req);
      if (!user) {
        return sendUnauthenticated(res);
      }
      req.user = user;
      req.authContext = user.authContext;
      if (!req.authContext) {
        return sendUnauthenticated(res);
      }
      const hasRole = req.authContext.roles.some((r) => allowedRoles.includes(r));
      if (!hasRole) {
        await createAuditEvent({
          actorUid: req.authContext.uid,
          actorRoles: req.authContext.roles,
          operation: "unauthorized_role_attempt",
          targetType: "role_guard",
          targetId: allowedRoles.join(","),
          reason: `Requires one of: ${allowedRoles.join(",")}`,
          result: "failure"
        });
        return sendForbidden(res);
      }
      next();
    } catch (err) {
      return sendUnauthenticated(res, err.message);
    }
  };
}

// server/ocr/ocrWorker.ts
init_admin();
function startOcrWorker(intervalMs = 6e4) {
  if (process.env.NODE_ENV === "test" || !env.OCR_ENABLED) return;
  const timer = setInterval(async () => {
    try {
      const db = getAdminDb();
      const snapshot = await db.collection("ocr_jobs").where("status", "==", "running").limit(10).get();
      if (snapshot.empty) return;
      for (const doc of snapshot.docs) {
        const sourceId = doc.id;
        try {
          const job = await checkOcrJobStatus(sourceId);
          if (job.status === "ready" && job.result) {
            console.log(`[OCR Worker] Background OCR job became ready. Running finalization for ${sourceId}`);
            const srcSnap = await db.collection("rag_sources").doc(sourceId).get();
            if (!srcSnap.exists) continue;
            const src = srcSnap.data();
            await finalizePipelineProcessing({
              uid: src.ownerUid,
              sourceId,
              storagePath: src.storagePath,
              fileName: src.fileName,
              title: src.title,
              subject: src.subject,
              year: src.year,
              resourceType: src.resourceType || "uploaded_pdf",
              sourceScope: src.sourceScope || "personal",
              pages: job.result.pages.map((p) => ({
                pageNumber: p.pageNumber,
                text: p.text,
                rawText: p.text,
                textEncoding: "unicode_sinhala",
                conversionApplied: false,
                conversionConfidence: 1
              })),
              extractionMethod: "cloud_vision_ocr",
              textEncoding: "unicode_sinhala",
              ocrConfidence: job.result.confidence,
              needsOcr: false,
              needsLegacyConversion: false
            });
            console.log(`[OCR Worker] Successfully finalized OCR for ${sourceId}`);
          } else if (job.status === "failed") {
            console.warn(`[OCR Worker] Job ${sourceId} failed.`);
          }
        } catch (err) {
          console.error(`[OCR Worker] Error processing job ${sourceId}:`, err);
        }
      }
    } catch (err) {
      console.error("[OCR Worker] Error in worker loop:", err);
    }
  }, intervalMs);
  timer.unref?.();
}

// server/ai-core/routes.ts
var import_express14 = require("express");

// server/ai-core/study/mockForecast.ts
init_admin();
async function updateStudentForecast(uid) {
  const db = getAdminDb();
  const mockResultsSnap = await db.collection("users").doc(uid).collection("mock_results").orderBy("date", "desc").limit(10).get();
  const mocks = mockResultsSnap.docs.map((d) => d.data());
  const mistakesSnap = await db.collection("users").doc(uid).collection("mistake_notebook").where("mastered", "==", false).get();
  const unmasteredMistakes = mistakesSnap.docs.map((d) => d.data());
  let sftLatest = mocks.find((m) => m.subject === "SFT")?.totalMarks || 0;
  let etLatest = mocks.find((m) => m.subject === "ET")?.totalMarks || 0;
  let ictLatest = mocks.find((m) => m.subject === "ICT")?.totalMarks || 0;
  const currentMarkEstimate = {
    sft: sftLatest,
    et: etLatest,
    ict: ictLatest
  };
  const forecast7Day = {
    sft: Math.min(100, sftLatest + 3),
    et: Math.min(100, etLatest + 3),
    ict: Math.min(100, ictLatest + 3)
  };
  const forecast30Day = {
    sft: Math.min(100, sftLatest + 15),
    et: Math.min(100, etLatest + 15),
    ict: Math.min(100, ictLatest + 15)
  };
  const average = (sftLatest + etLatest + ictLatest) / 3;
  let a3Chance = "Low";
  let riskLevel = "High";
  if (average >= 75) {
    a3Chance = "High";
    riskLevel = "Low";
  } else if (average >= 60) {
    a3Chance = "Medium";
    riskLevel = "Medium";
  }
  const mustFix = unmasteredMistakes.slice(0, 5).map((m) => m.lesson);
  const forecast = {
    currentMarkEstimate,
    forecast7Day,
    forecast30Day,
    a3Chance,
    riskLevel,
    mustFix: Array.from(new Set(mustFix)),
    warnings: riskLevel === "High" ? ["Target A3 is currently at risk. Need intensive daily MCQ drills."] : [],
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.collection("users").doc(uid).collection("student_forecasts").add(forecast);
  return forecast;
}

// server/ai-core/study/mistakeNotebook.ts
init_admin();
async function addMistake(uid, mistakeData) {
  const db = getAdminDb();
  const mistakeId = `${mistakeData.subject}_${Date.now()}`;
  const record = {
    ...mistakeData,
    retryDate: getNextRetryDate(0),
    repeatCount: 0,
    mastered: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.collection("users").doc(uid).collection("mistake_notebook").doc(mistakeId).set(record);
  return { id: mistakeId, ...record };
}
async function getTodayRetries(uid) {
  const db = getAdminDb();
  const today = (/* @__PURE__ */ new Date()).toISOString();
  const snap = await db.collection("users").doc(uid).collection("mistake_notebook").where("mastered", "==", false).where("retryDate", "<=", today).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
function getNextRetryDate(repeatCount) {
  const date = /* @__PURE__ */ new Date();
  switch (repeatCount) {
    case 0:
      date.setDate(date.getDate() + 1);
      break;
    // 1 day
    case 1:
      date.setDate(date.getDate() + 3);
      break;
    // 3 days
    case 2:
      date.setDate(date.getDate() + 7);
      break;
    // 7 days
    default:
      date.setDate(date.getDate() + 14);
      break;
  }
  return date.toISOString();
}

// server/ai-core/exam-intel/patternAnalyzer.ts
var import_genai10 = require("@google/genai");
init_admin();
init_client();
var ai7 = getAIClient();
async function buildPatternReport(subject) {
  const db = getAdminDb();
  const questionsSnap = await db.collection("exam_question_index").where("subject", "==", subject).get();
  const questions = questionsSnap.docs.map((d) => d.data());
  const prompt = `
    Analyze the following exam questions for subject ${subject} to build a pattern report.
    
    Questions: ${JSON.stringify(questions.map((q) => ({
    year: q.year,
    questionType: q.questionType,
    lesson: q.lesson,
    subtopic: q.subtopic,
    marks: q.marks,
    concept: q.concept
  })))}
    
    Identify:
    - Lesson frequency
    - Marks by lesson
    - MCQ/Structured/Essay frequency
    - Repeated concepts
    - Rare concepts
    - Not asked recently
    - Trend changes in the last 5 years
    - High probability topics
    - Low probability topics
  `;
  const response = await ai7.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert A/L exam pattern analyst. Format your report as JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai10.Type.OBJECT,
        properties: {
          subject: { type: import_genai10.Type.STRING },
          yearsAnalyzed: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.INTEGER } },
          lessonFrequencyTable: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.OBJECT } },
          marksByLesson: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.OBJECT } },
          mcqFrequency: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.OBJECT } },
          structuredFrequency: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.OBJECT } },
          essayFrequency: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.OBJECT } },
          repeatedConcepts: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.STRING } },
          rareConcepts: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.STRING } },
          notAskedRecently: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.STRING } },
          trendChangesLastFiveYears: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.STRING } },
          highProbabilityTopics: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.STRING } },
          lowProbabilityTopics: { type: import_genai10.Type.ARRAY, items: { type: import_genai10.Type.STRING } },
          confidence: { type: import_genai10.Type.NUMBER }
        },
        required: ["subject"]
      }
    }
  });
  const report = JSON.parse(response.text || "{}");
  report.generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  report.version = "1.0";
  await db.collection("exam_pattern_reports").doc(`${subject}_${report.version}`).set(report);
  return report;
}

// server/ai-core/reports/studentWeeklyReport.ts
var import_genai11 = require("@google/genai");
init_admin();
init_client();
var ai8 = getAIClient();
async function generateStudentWeeklyReport(uid) {
  const db = getAdminDb();
  const profileSnap = await db.collection("users").doc(uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  const progressSnap = await db.collection("users").doc(uid).collection("progress").doc("data").get();
  const progress = progressSnap.exists ? progressSnap.data()?.data : {};
  const mockResultsSnap = await db.collection("users").doc(uid).collection("mock_results").orderBy("date", "desc").limit(10).get();
  const mocks = mockResultsSnap.docs.map((d) => d.data());
  const mistakesSnap = await db.collection("users").doc(uid).collection("mistake_notebook").orderBy("createdAt", "desc").limit(50).get();
  const mistakes = mistakesSnap.docs.map((d) => d.data());
  const prompt = `
    Generate a weekly progress report for an A/L Technology student.
    
    Student Profile: ${JSON.stringify(profile)}
    Progress Data: ${JSON.stringify(progress)}
    Recent Mock Results: ${JSON.stringify(mocks)}
    Recent Mistakes: ${JSON.stringify(mistakes)}
    
    The report should include:
    - Progress summary
    - Weak lessons
    - Next week's plan
    - High probability exam topics
    - Mock score trend
    - Mistake trend
    - Risk warning
    - A parent-friendly summary
  `;
  const response = await ai8.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert A/L education analyst generating a weekly report. Format output as JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai11.Type.OBJECT,
        properties: {
          progressSummary: { type: import_genai11.Type.STRING },
          weakLessons: { type: import_genai11.Type.ARRAY, items: { type: import_genai11.Type.STRING } },
          nextWeekPlan: { type: import_genai11.Type.ARRAY, items: { type: import_genai11.Type.STRING } },
          highProbabilityTopics: { type: import_genai11.Type.ARRAY, items: { type: import_genai11.Type.STRING } },
          mockScoreTrend: { type: import_genai11.Type.STRING },
          mistakeTrend: { type: import_genai11.Type.STRING },
          riskWarning: { type: import_genai11.Type.STRING },
          parentFriendlySummary: { type: import_genai11.Type.STRING }
        },
        required: [
          "progressSummary",
          "weakLessons",
          "nextWeekPlan",
          "highProbabilityTopics",
          "mockScoreTrend",
          "mistakeTrend",
          "riskWarning",
          "parentFriendlySummary"
        ]
      }
    }
  });
  const report = JSON.parse(response.text || "{}");
  await db.collection("users").doc(uid).collection("weekly_reports").add({
    ...report,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return report;
}

// server/ai-core/routes.ts
init_admin();
var router6 = (0, import_express14.Router)();
router6.get("/student/diagnosis", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Missing subject" });
    const result = await diagnoseStudent(user.uid, String(subject));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/study/war-plan", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await generateWarPlan({ ...req.body, uid: user.uid });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/study/mock-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await updateStudentForecast(user.uid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/mistakes", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await getTodayRetries(user.uid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/mistakes", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await addMistake(user.uid, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/exam-intel/build-index", async (req, res) => {
  try {
    const result = await buildExamIndex();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/exam-intel/report", async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await buildPatternReport(String(subject));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/exam-intel/probability", async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await rankTopicProbability(String(subject));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/exam-intel/unasked", async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await detectUnaskedTopics(String(subject));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/exam-intel/predicted-paper", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await generatePredictedPaper({ ...req.body, uid: user.uid });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/reports/student-weekly", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await generateStudentWeeklyReport(user.uid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.post("/admin/repair-data", requireFirebaseUser, requireRole("admin"), async (req, res) => {
  try {
    const { getAdminDb: getAdminDb2 } = await Promise.resolve().then(() => (init_admin(), admin_exports));
    const db = getAdminDb2();
    const snapshot = await db.collection("exam_question_index").get();
    let deletedCount = 0;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.questionText && !data.sourceId) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });
    if (deletedCount > 0) {
      await batch.commit();
    }
    res.json({ message: `Repair finished. Deleted ${deletedCount} invalid documents.`, ok: true });
  } catch (err) {
    console.error("Repair error:", err);
    res.status(500).json({ error: err.message });
  }
});
var routes_default2 = router6;

// server/realtime/routes.ts
var import_express15 = require("express");
init_config();
var requireUser2 = async (req) => {
  const user = await verifyAndExtractUser(req);
  if (!user) throw new Error("Unauthorized");
  return user;
};
var router7 = (0, import_express15.Router)();
router7.get("/status", (req, res) => {
  const cfg = getRealtimeConfig();
  res.json({
    ok: true,
    enabled: cfg.enabled,
    provider: cfg.provider,
    available: cfg.available,
    model: cfg.model,
    project: cfg.project,
    location: cfg.location,
    authMode: cfg.authMode,
    missing: cfg.missing
  });
});
router7.get("/self-test", async (req, res) => {
  try {
    const cfg = getRealtimeConfig();
    if (!cfg.enabled) {
      return res.json({ ok: false, code: "REALTIME_DISABLED" });
    }
    if (cfg.provider === "gemini_live") {
      return res.json({
        ok: false,
        code: "GEMINI_LIVE_BRIDGE_NOT_IMPLEMENTED",
        message: "Gemini Live backend bridge is not implemented yet."
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, code: "TEST_FAILED", message: err.message });
  }
});
router7.post("/session", async (req, res) => {
  try {
    await requireUser2(req);
    const cfg = getRealtimeConfig();
    if (!cfg.enabled) {
      return res.json({
        ok: false,
        code: "REALTIME_DISABLED",
        message: "Realtime voice is disabled."
      });
    }
    if (cfg.provider === "gemini_live") {
      return res.status(501).json({
        ok: false,
        code: "GEMINI_LIVE_BRIDGE_NOT_IMPLEMENTED",
        provider: "gemini_live",
        message: "Gemini Live backend bridge is not implemented yet. OpenAI key is not required."
      });
    }
    const { activeSubject, activeSourceId } = req.body;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(400).json({ ok: false, error: "Missing OPENAI_API_KEY on server.", message: "OpenAI API key is missing. For Gemini Live, please configure provider to gemini_live." });
    }
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17",
        voice: process.env.OPENAI_REALTIME_VOICE || "alloy",
        instructions: `You are Clora X, a Sinhala-first A/L Technology live tutor for SFT, ET, ICT.
- Speak naturally like a teacher in a live call.
- Sinhala-first, simple, short chunks.
- Do not read long essays unless user asks.
- Ask follow-up questions when unclear.
- Allow user to interrupt.
- When explaining calculations, speak step by step.
- For official paper answers, use evidence only.
- If evidence missing, say you cannot verify from PDF and ask user to select/upload source.
- For non-syllabus/general questions, answer normally and do not attach fake PDF sources.
- Do not mention internal model/tool names.
If user mentions PDF, paper, question, Q1, MCQ, essay, structured, marking scheme, page, uploaded file, "\u0DB8\u0DDA PDF \u0D91\u0D9A", "pdf eke", "prashne" then call pdf_answer_tool before answering.`,
        tools: [
          {
            type: "function",
            name: "pdf_answer_tool",
            description: "Answers a question based on PDF evidence.",
            parameters: {
              type: "object",
              properties: {
                transcript: { type: "string" },
                questionNo: { type: "string" },
                questionType: { type: "string" },
                year: { type: "string" }
              },
              required: ["transcript"]
            }
          },
          {
            type: "function",
            name: "source_search_tool",
            description: "Searches for sources if not found in PDF.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" },
                subject: { type: "string" }
              },
              required: ["query"]
            }
          },
          {
            type: "function",
            name: "web_search_tool",
            description: "Searches the web for general knowledge.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" }
              },
              required: ["query"]
            }
          },
          {
            type: "function",
            name: "student_context_tool",
            description: "Gets user progress context.",
            parameters: {
              type: "object",
              properties: {
                intent: { type: "string" }
              },
              required: ["intent"]
            }
          }
        ]
      })
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI Realtime session error: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    res.json({
      ok: true,
      clientSecret: data.client_secret.value,
      sessionId: data.id,
      expiresAt: data.client_secret.expires_at
    });
  } catch (error) {
    console.error("Error creating realtime session:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
var routes_default3 = router7;
router7.post("/tool-result", async (req, res) => {
  try {
    const user = await requireUser2(req);
    const { toolName, arguments: args, chatId, activeSubject, activeSourceId, recentAttachmentIds } = req.body;
    if (toolName === "pdf_answer_tool") {
      const { answerFromPdfEvidence: answerFromPdfEvidence2 } = await Promise.resolve().then(() => (init_pdfAnswerService(), pdfAnswerService_exports));
      const result = await answerFromPdfEvidence2({
        uid: user.uid,
        chatId,
        transcriptOrPrompt: args.transcript,
        activeSubject,
        activeSourceId,
        recentAttachmentIds,
        questionNo: args.questionNo,
        questionType: args.questionType,
        year: args.year,
        mode: "live_voice"
      });
      return res.json({ ok: true, output: result });
    }
    return res.json({ ok: true, output: { message: "Tool not fully implemented yet." } });
  } catch (error) {
    console.error("Error executing tool:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// server.ts
init_client();

// server/utils/errorHandler.ts
var import_node_crypto6 = __toESM(require("node:crypto"), 1);
function globalErrorHandler(err, req, res, next) {
  const requestId = import_node_crypto6.default.randomUUID?.() || Math.random().toString(36).substring(2, 15);
  console.error(`[ERROR] RequestId: ${requestId} | Path: ${req.path} | Error:`, err);
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An internal server error occurred. Please try again later.";
  let retryable = false;
  if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
    status = 400;
    code = "QUERY_TOKEN_NOT_ALLOWED";
    message = err.message;
  } else if (err.code === "LIMIT_FILE_SIZE") {
    status = 413;
    code = "FILE_TOO_LARGE";
    message = "The uploaded file exceeds the maximum allowed size.";
  } else if (err.code === "LIMIT_FILE_COUNT") {
    status = 400;
    code = "TOO_MANY_FILES";
    message = "Too many files were uploaded. Only 1 file is allowed.";
  } else if (err.code === "LIMIT_FIELD_COUNT") {
    status = 400;
    code = "TOO_MANY_FIELDS";
    message = "The request contains too many fields.";
  } else if (err.type === "entity.too.large" || err.status === 413) {
    status = 413;
    code = "BODY_TOO_LARGE";
    message = "The request payload size exceeds the maximum limit.";
  } else if (err.status === 401 || err.message?.includes("Unauthorized") || err.message?.includes("LOGIN_REQUIRED")) {
    status = 401;
    code = "UNAUTHENTICATED";
    message = "Authentication is required to perform this action.";
  } else if (err.status === 403 || err.message?.includes("Forbidden") || err.message?.includes("Access denied")) {
    status = 403;
    code = "FORBIDDEN";
    message = "You do not have permission to perform this action.";
  } else if (err.code === "RATE_LIMITED" || err.status === 429) {
    status = 429;
    code = "RATE_LIMITED";
    message = err.message || "Too many requests. Please try again later.";
    retryable = true;
  } else if (err.code === "FEATURE_NOT_AVAILABLE") {
    status = 501;
    code = "FEATURE_NOT_AVAILABLE";
    message = err.message || "This feature is not available.";
  } else if (err.name === "ValidationError" || err.code === "VALIDATION_FAILED") {
    status = 400;
    code = "VALIDATION_FAILED";
    message = err.message || "Validation failed.";
  } else if (err.code === "DEPENDENCY_UNAVAILABLE") {
    status = 503;
    code = "DEPENDENCY_UNAVAILABLE";
    message = "A required dependency service is temporarily unavailable.";
  } else if (err.code === "QUOTA_EXCEEDED") {
    status = 429;
    code = "QUOTA_EXCEEDED";
    message = "API request quota has been exceeded.";
  } else if (err.code === "REQUEST_TIMEOUT" || err.status === 408) {
    status = 408;
    code = "REQUEST_TIMEOUT";
    message = "The request timed out.";
  } else {
    if (err.isPublic) {
      code = err.code || "BAD_REQUEST";
      message = err.message;
      status = err.status || 400;
    }
  }
  const responsePayload = {
    ok: false,
    code,
    message,
    requestId,
    retryable
  };
  res.status(status).json(responsePayload);
}

// server.ts
logEnvConfig();
prepareGoogleCredentials();
getAdminApp();
var app = (0, import_express16.default)();
app.use(requestContextMiddleware);
var PORT2 = env.PORT;
var videoCdnOrigin = (() => {
  try {
    return env.VIDEO_CDN_BASE_URL ? new URL(env.VIDEO_CDN_BASE_URL).origin : "";
  } catch {
    return "";
  }
})();
app.use((req, res, next) => {
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://api.dicebear.com https://*.firebaseapp.com https://*.firebasestorage.app",
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseapp.com https://*.run.app wss://*.run.app ${videoCdnOrigin}`.trim(),
    `media-src 'self' blob: ${videoCdnOrigin}`.trim(),
    "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://accounts.google.com",
    "object-src 'none'",
    "frame-ancestors 'self' https://ai.studio https://*.google.com"
  ].join("; ");
  res.setHeader("Content-Security-Policy", cspHeader);
  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), autoplay=(self), clipboard-write=(self), fullscreen=(self)");
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
  next();
});
var vercelRuntimeOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map((host) => `https://${String(host).replace(/^https?:\/\//, "")}`);
var allowedOrigins = [.../* @__PURE__ */ new Set([...env.ALLOWED_ORIGINS.length > 0 ? env.ALLOWED_ORIGINS : [
  "https://tecal.vercel.app",
  "https://a-l-tech-blueprint-807408268472.us-west1.run.app",
  "http://localhost:5173",
  "http://localhost:3000"
], ...vercelRuntimeOrigins])];
app.use((0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.trim().toLowerCase();
    const isAllowed = allowedOrigins.some((allowed) => allowed.trim().toLowerCase() === cleanOrigin);
    const isDevPreview = env.NODE_ENV !== "production" && cleanOrigin.endsWith(".run.app");
    if (isAllowed || isDevPreview) {
      callback(null, true);
    } else {
      callback(new Error("CORS_BLOCKED: Origin not allowed by security policy."));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Firebase-AppCheck", "X-Device-ID"]
}));
app.use(import_express16.default.json({ limit: `${env.MAX_BODY_LIMIT_MB}mb` }));
app.use("/api", globalLimiter);
app.get("/api/firebase/init", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.json({
    apiKey: process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: "tecal.vercel.app",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.VITE_FIREBASE_APP_ID || ""
  });
});
app.use("/api/rag", ragRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/exam-intel", examIntelRoutes_default);
app.use("/api/student", studentRoutes_default);
app.use("/api/reports", reportRoutes_default);
app.use("/api/learning", learningRoutes_default);
app.use("/api/platform", routes_default);
app.use("/api/tts", ttsRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api", videoRoutes);
app.get("/api/sources/inventory", async (req, res) => {
  try {
    const user = await requireUser(req);
    const uid = user.uid;
    const userEmail = (user.email || "").toLowerCase();
    const isAdmin = !!(user.admin || user.roles && user.roles.includes("admin"));
    const subjectQuery = req.query.subject ? String(req.query.subject).toUpperCase() : void 0;
    const yearQuery = req.query.year ? String(req.query.year) : void 0;
    const typeQuery = req.query.resourceType ? String(req.query.resourceType).toLowerCase() : void 0;
    const inventory = await getSourceInventory({
      uid,
      subject: subjectQuery,
      year: yearQuery,
      resourceType: typeQuery,
      isAdmin
    });
    res.json({
      ok: true,
      groups: inventory.groups,
      total: inventory.total
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get("/api/notifications", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    const snap = await db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").orderBy("timestamp", "desc").limit(50).get();
    const notifications = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ ok: true, notifications });
  } catch (error) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_FETCH_FAILED", message: error.message });
  }
});
app.post("/api/notifications/trigger", requireFirebaseUser, adminLimiter, async (req, res) => {
  try {
    const user = req.user;
    const { notification } = req.body;
    if (!notification || !notification.title || !notification.message) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing title or message" });
    }
    const db = getAdminDb();
    const id = notification.id || db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").doc().id;
    const newNotif = {
      id,
      title: notification.title,
      message: notification.message,
      type: notification.type || "announcement",
      senderEmail: notification.senderEmail || user.email || "system@alblueprint.com",
      senderName: notification.senderName || user.name || "System Admin",
      read: false,
      timestamp: notification.timestamp || (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").doc(id).set(newNotif, { merge: true });
    res.json({ ok: true, success: true, notification: newNotif });
  } catch (error) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_TRIGGER_FAILED", message: error.message });
  }
});
app.post("/api/notifications/read", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const { notificationId, readAll } = req.body;
    const db = getAdminDb();
    const coll = db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications");
    if (readAll) {
      const snap = await coll.where("read", "==", false).get();
      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
    } else if (notificationId) {
      await coll.doc(notificationId).update({ read: true });
    } else {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing notificationId or readAll flag" });
    }
    res.json({ ok: true, success: true });
  } catch (error) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_READ_FAILED", message: error.message });
  }
});
app.post("/api/notifications/delete", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const { notificationId } = req.body;
    if (!notificationId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing notificationId" });
    }
    const db = getAdminDb();
    await db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").doc(notificationId).delete();
    res.json({ ok: true, success: true });
  } catch (error) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_DELETE_FAILED", message: error.message });
  }
});
app.get("/api/profile", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const uidDoc = await db.collection("users").doc(user.uid).get();
    let profileData = uidDoc.exists ? uidDoc.data() : {};
    if (user.email) {
      const emailDoc = await db.collection("users").doc(user.email.toLowerCase()).get();
      if (emailDoc.exists) {
        profileData = { ...emailDoc.data(), ...profileData };
      }
    }
    res.json({ ok: true, profile: profileData });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
});
app.post("/api/profile", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const profileData = req.body.profile || req.body;
    const batch = db.batch();
    batch.set(db.collection("users").doc(user.uid), profileData, { merge: true });
    if (user.email) {
      batch.set(db.collection("users").doc(user.email.toLowerCase()), profileData, { merge: true });
    }
    await batch.commit();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get("/api/data", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    let appData = null;
    const uidRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    const uidSnap = await uidRef.get();
    if (uidSnap.exists) {
      appData = uidSnap.data()?.data || uidSnap.data();
    }
    if (!appData) {
      const rootUidSnap = await db.collection("users").doc(user.uid).get();
      if (rootUidSnap.exists) {
        appData = rootUidSnap.data()?.appData || rootUidSnap.data()?.data;
      }
    }
    if (!appData && user.email) {
      const legacyEmail = user.email.toLowerCase();
      const emailRef = db.collection("users").doc(legacyEmail).collection("progress").doc("data");
      const emailSnap = await emailRef.get();
      if (emailSnap.exists) {
        appData = emailSnap.data()?.data || emailSnap.data();
      }
      if (!appData) {
        const rootEmailSnap = await db.collection("users").doc(legacyEmail).get();
        if (rootEmailSnap.exists) {
          appData = rootEmailSnap.data()?.appData || rootEmailSnap.data()?.data;
        }
      }
      if (appData) {
        console.log(`[DATA MIGRATION] Migrating data for user ${user.uid} from legacy email ${legacyEmail}`);
        const batch = db.batch();
        const payload = {
          email: legacyEmail,
          data: appData,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        batch.set(uidRef, payload, { merge: true });
        batch.set(db.collection("users").doc(user.uid), { appData }, { merge: true });
        await batch.commit();
      }
    }
    res.json({ ok: true, data: appData || null });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
});
app.post("/api/data", requireFirebaseUser, async (req, res) => {
  try {
    const user = req.user;
    const { data } = req.body;
    if (data && (data.role || data.roles || data.admin || data.uid)) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Modifying security-related fields is strictly prohibited."
      });
    }
    const db = getAdminDb();
    const batch = db.batch();
    const payload = {
      email: user.email?.toLowerCase() || "",
      data: data || {},
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const uidDocRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    batch.set(uidDocRef, payload, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { appData: data || {} }, { merge: true });
    await batch.commit();
    res.json({ success: true, ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.post("/api/admin/support/data", requireFirebaseUser, requireRole("admin"), adminLimiter, async (req, res) => {
  try {
    const adminUser = req.user;
    const { targetUid, operation, reason, data } = req.body;
    if (!targetUid || !operation || !reason) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Missing targetUid, operation, or reason for administrative action."
      });
    }
    const db = getAdminDb();
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ ok: false, error: "Target user profile not found." });
    }
    let previousStateSummary = {};
    if (targetSnap.exists) {
      previousStateSummary = { appData: targetSnap.data()?.appData || {} };
    }
    if (operation === "view") {
      let targetData = null;
      const progRef = targetRef.collection("progress").doc("data");
      const progSnap = await progRef.get();
      if (progSnap.exists) {
        targetData = progSnap.data()?.data || progSnap.data();
      } else {
        targetData = targetSnap.data()?.appData || targetSnap.data()?.data;
      }
      await createAuditEvent({
        actorUid: adminUser.uid,
        actorRoles: adminUser.roles || ["admin"],
        operation: "admin_view_user_data",
        targetType: "user_data",
        targetId: targetUid,
        previousState: previousStateSummary,
        newState: { action: "viewed" },
        reason,
        result: "success"
      });
      return res.json({ ok: true, data: targetData });
    } else if (operation === "edit") {
      if (!data) {
        return res.status(400).json({ ok: false, error: "Missing data payload for edit operation." });
      }
      const batch = db.batch();
      const payload = {
        data,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      batch.set(targetRef.collection("progress").doc("data"), payload, { merge: true });
      batch.set(targetRef, { appData: data }, { merge: true });
      await batch.commit();
      await createAuditEvent({
        actorUid: adminUser.uid,
        actorRoles: adminUser.roles || ["admin"],
        operation: "admin_edit_user_data",
        targetType: "user_data",
        targetId: targetUid,
        previousState: previousStateSummary,
        newState: { appData: data },
        reason,
        result: "success"
      });
      return res.json({ ok: true, message: "User data updated successfully by admin." });
    } else {
      return res.status(400).json({ ok: false, error: `Unsupported administrative operation: ${operation}` });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get("/api/quota", async (req, res) => {
  res.json({ ok: true, rpmUsed: 0, rpmLimit: 60, rpdUsed: 0, rpdLimit: 1500 });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, status: "ok" });
});
app.post("/api/send-email", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});
app.post("/api/quiz", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});
app.post("/api/lesson-optimizer", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});
app.get("/api/past-papers/local/:id", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});
app.get("/api/cookies", (req, res) => res.json({}));
app.use("/api/auth", authRoutes);
startOcrWorker();
app.use("/api", routes_default2);
app.use(["/api/ai", "/api"], aiRoutes);
app.use("/api/realtime", routes_default3);
app.post("/api/profile/target-zscore", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { targetZScore } = req.body;
    if (targetZScore === void 0 || typeof targetZScore !== "number" || targetZScore < 0 || targetZScore > 4) {
      return res.status(400).json({ ok: false, error: "Invalid targetZScore" });
    }
    const db = getAdminDb();
    const batch = db.batch();
    const uidRef = db.collection("users").doc(user.uid).collection("profile").doc("main");
    batch.set(uidRef, { targetZScore, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { targetZScore, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    const progRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    batch.set(progRef, { targetZScore, data: { targetZ: targetZScore }, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    if (user.email) {
      const emailRef = db.collection("users").doc(user.email.toLowerCase()).collection("profile").doc("main");
      batch.set(emailRef, { targetZScore, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
      batch.set(db.collection("users").doc(user.email.toLowerCase()), { targetZScore, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    }
    await batch.commit();
    const { loadUserAIContext: loadUserAIContext2 } = await Promise.resolve().then(() => (init_userContext(), userContext_exports));
    const ctx = await loadUserAIContext2(user.uid, user.email);
    res.json({ ok: true, targetZScore, zScoreContext: ctx?.zScoreContext });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post("/api/ai/model-test", requireFirebaseUser, adminLimiter, async (req, res, next) => {
  try {
    const user = req.user;
    const isAdmin = !!(user.admin || user.roles && user.roles.includes("admin"));
    if (!isAdmin) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Admin access required" });
    }
    if (!env.ENABLE_MODEL_TEST_ROUTE || env.NODE_ENV === "production") {
      return res.status(501).json({ ok: false, code: "FEATURE_NOT_AVAILABLE", message: "This feature is not available in production." });
    }
    const ai9 = getAIClient();
    const testModel = async (modelName) => {
      try {
        const result = await ai9.models.generateContent({
          model: modelName,
          contents: "Return only the word OK"
        });
        return { model: modelName, ok: true, response: result.text };
      } catch (e) {
        return { model: modelName, ok: false, error: e.message };
      }
    };
    const results = await Promise.all([
      testModel(AI_MODELS.pro),
      testModel(AI_MODELS.default),
      testModel(AI_MODELS.urlContext)
    ]);
    res.json({ ok: true, results });
  } catch (e) {
    next(e);
  }
});
function getPublicOrDistFile(fileName) {
  const distFile = import_path2.default.join(process.cwd(), "dist", fileName);
  if (import_fs3.default.existsSync(distFile)) return distFile;
  const publicFile = import_path2.default.join(process.cwd(), "public", fileName);
  if (import_fs3.default.existsSync(publicFile)) return publicFile;
  return null;
}
app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
  const file = getPublicOrDistFile("manifest.webmanifest");
  if (file) {
    res.type("application/manifest+json");
    return res.sendFile(file);
  }
  res.status(404).json({ error: "manifest not found" });
});
app.get(["/pdf.worker.min.mjs", "/pdf.worker.mjs", "/pdf.worker.min.js"], (req, res) => {
  const file = getPublicOrDistFile(req.path.substring(1));
  if (file) {
    res.type("text/javascript");
    return res.sendFile(file);
  }
  res.status(404).send("worker not found");
});
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, code: "API_NOT_FOUND", message: "API endpoint not found" });
});
if (process.env.NODE_ENV !== "production") {
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    }).then((vite) => {
      app.use(vite.middlewares);
      if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
        app.listen(PORT2, "0.0.0.0", () => {
          console.log(`Server running on port ${PORT2}`);
        });
      }
    });
  });
} else {
  const distPath = import_path2.default.join(process.cwd(), "dist");
  app.use(import_express16.default.static(distPath));
  app.get("/assets/*", (req, res) => {
    res.status(404).type("text/plain").send("Static asset not found");
  });
  app.get("*", (req, res) => {
    res.sendFile(import_path2.default.join(distPath, "index.html"));
  });
  if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
    app.listen(PORT2, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT2}`);
    });
  }
}
app.use(globalErrorHandler);
var server_default = app;
//# sourceMappingURL=server.cjs.map
