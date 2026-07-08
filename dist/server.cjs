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

// server/firebase/admin.ts
function getAdminDb() {
  if (dbInstance) return dbInstance;
  let databaseId2 = process.env.FIRESTORE_DATABASE_ID;
  if (!databaseId2) {
    try {
      const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs.default.existsSync(configPath)) {
        const config = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
        databaseId2 = config.firestoreDatabaseId;
      }
    } catch (e) {
      console.warn("Failed to load firestoreDatabaseId from firebase-applet-config.json:", e);
    }
  }
  if (!databaseId2) {
    databaseId2 = "ai-studio-c097068e-a4a9-4ea3-9b00-0b3195093c42";
    console.info(`INFO: FIRESTORE_DATABASE_ID falling back to "${databaseId2}".`);
  }
  try {
    dbInstance = (0, import_firestore.getFirestore)(void 0, databaseId2);
  } catch (err) {
    console.error("Failed to initialize getFirestore with databaseId:", databaseId2, err);
    dbInstance = (0, import_firestore.getFirestore)();
  }
  return dbInstance;
}
async function verifyFirebaseToken(authHeader) {
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    return { uid: "dev-user-id", email: "dev@example.com", name: "Dev User" };
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or invalid Authorization header");
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await (0, import_auth.getAuth)().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      admin: decodedToken.admin || false
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
  if (!user.admin && process.env.DEV_BYPASS_AUTH !== "true") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
var import_auth, import_firestore, import_fs, import_path, dbInstance;
var init_admin = __esm({
  "server/firebase/admin.ts"() {
    "use strict";
    import_auth = require("firebase-admin/auth");
    import_firestore = require("firebase-admin/firestore");
    import_fs = __toESM(require("fs"), 1);
    import_path = __toESM(require("path"), 1);
    dbInstance = null;
  }
});

// server/ai/client.ts
function prepareGoogleCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = "/tmp/google-credentials.json";
    try {
      let credStr = raw.trim();
      if (!credStr.startsWith("{")) credStr = "{" + credStr;
      if (!credStr.endsWith("}")) credStr = credStr + "}";
      JSON.parse(credStr);
      import_fs2.default.writeFileSync(filePath, credStr, { mode: 384 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
    } catch (e) {
      console.error("Failed to parse and write GOOGLE_APPLICATION_CREDENTIALS_JSON", e);
    }
  }
}
function getAIClient() {
  if (cachedClient) return cachedClient;
  prepareGoogleCredentials();
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  cachedClient = new import_genai.GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || "al-ai-chat",
    location
  });
  return cachedClient;
}
function mapModel(model, defaultFallback) {
  if (!model) return defaultFallback;
  return model;
}
function getModelFallbackChain(requestedModel) {
  const chain = [];
  if (requestedModel) {
    chain.push(requestedModel);
  }
  chain.push(AI_MODELS.fast);
  chain.push(AI_MODELS.default);
  chain.push(AI_MODELS.pro);
  return Array.from(new Set(chain));
}
var import_fs2, import_genai, cachedClient, AI_MODELS;
var init_client = __esm({
  "server/ai/client.ts"() {
    "use strict";
    import_fs2 = __toESM(require("fs"), 1);
    import_genai = require("@google/genai");
    cachedClient = null;
    AI_MODELS = {
      default: mapModel(process.env.GEMINI_DEFAULT_MODEL || "", "gemini-2.5-flash"),
      pro: mapModel(process.env.GEMINI_PRO_MODEL || "", "gemini-2.5-pro"),
      fast: mapModel(process.env.GEMINI_FAST_MODEL || "", "gemini-2.0-flash"),
      image: mapModel(process.env.GEMINI_IMAGE_MODEL || process.env.NANO_BANANA_MODEL || "", "imagen-3.0-generate-001"),
      imagePro: mapModel(process.env.GEMINI_IMAGE_PRO_MODEL || process.env.NANO_BANANA_PRO_MODEL || "", "imagen-3.0-generate-001")
    };
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

// server/data/userRepository.ts
function encrypt(text) {
  const iv = import_crypto.default.randomBytes(16);
  const cipher = import_crypto.default.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
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
  return import_path2.default.join(DB_DIR, `${hash}.json.gz`);
}
function readUser(email) {
  const file = getUserFile(email);
  if (!import_fs3.default.existsSync(file)) {
    return { data: null, history: [], cookies: null, profile: null, notifications: [] };
  }
  try {
    const raw = import_fs3.default.readFileSync(file);
    let jsonStr;
    try {
      jsonStr = import_zlib.default.gunzipSync(raw).toString("utf-8");
    } catch {
      jsonStr = raw.toString("utf-8");
    }
    if (!jsonStr.startsWith("{")) {
      jsonStr = decrypt(jsonStr);
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return { data: null, history: [], cookies: null, profile: null, notifications: [] };
  }
}
function writeUser(email, userData) {
  if (!import_fs3.default.existsSync(DB_DIR)) import_fs3.default.mkdirSync(DB_DIR, { recursive: true });
  const file = getUserFile(email);
  const jsonStr = JSON.stringify(userData);
  const encrypted = encrypt(jsonStr);
  const zipped = import_zlib.default.gzipSync(encrypted);
  import_fs3.default.writeFileSync(file, zipped);
  if (email && email.includes("@") && apiKey) {
    const cleanEmail = email.trim().toLowerCase();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/backups/${encodeURIComponent(cleanEmail)}?updateMask.fieldPaths=userData&updateMask.fieldPaths=updatedAt&key=${apiKey}`;
    const payload = {
      fields: {
        userData: { stringValue: encrypted },
        updatedAt: { stringValue: (/* @__PURE__ */ new Date()).toISOString() }
      }
    };
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch((err) => {
      console.error("Failed to backup user data to Firestore REST API:", err);
    });
  }
}
var import_fs3, import_path2, import_crypto, import_zlib, isVercel, DB_DIR, rawKey, ENCRYPTION_KEY, SOURCE_DIR, projectId, databaseId, apiKey;
var init_userRepository = __esm({
  "server/data/userRepository.ts"() {
    "use strict";
    import_fs3 = __toESM(require("fs"), 1);
    import_path2 = __toESM(require("path"), 1);
    import_crypto = __toESM(require("crypto"), 1);
    import_zlib = __toESM(require("zlib"), 1);
    isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV || process.env.VERCEL_URL;
    DB_DIR = isVercel ? "/tmp/data_users" : import_path2.default.join(process.cwd(), "data_users");
    rawKey = process.env.ENCRYPTION_KEY || "default_encryption_key_32_chars!";
    if (rawKey.length > 32) rawKey = rawKey.substring(0, 32);
    if (rawKey.length < 32) rawKey = rawKey.padEnd(32, "0");
    ENCRYPTION_KEY = rawKey;
    try {
      if (!import_fs3.default.existsSync(DB_DIR)) import_fs3.default.mkdirSync(DB_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create DB_DIR, using /tmp fallback", e);
      DB_DIR = "/tmp/data_users";
      if (!import_fs3.default.existsSync(DB_DIR)) import_fs3.default.mkdirSync(DB_DIR, { recursive: true });
    }
    SOURCE_DIR = import_path2.default.join(process.cwd(), "data_users");
    if (isVercel && import_fs3.default.existsSync(SOURCE_DIR)) {
      try {
        const files = import_fs3.default.readdirSync(SOURCE_DIR);
        for (const file of files) {
          if (file.endsWith(".json.gz")) {
            const srcPath = import_path2.default.join(SOURCE_DIR, file);
            const destPath = import_path2.default.join(DB_DIR, file);
            if (!import_fs3.default.existsSync(destPath)) {
              import_fs3.default.copyFileSync(srcPath, destPath);
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
      const configPath = import_path2.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs3.default.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(import_fs3.default.readFileSync(configPath, "utf-8"));
        projectId = firebaseConfig.projectId || projectId;
        databaseId = firebaseConfig.firestoreDatabaseId || databaseId;
        apiKey = firebaseConfig.apiKey || "";
      }
    } catch (e) {
      console.warn("Failed to load firebase-applet-config.json for REST client:", e);
    }
  }
});

// server/firebase/userContext.ts
var userContext_exports = {};
__export(userContext_exports, {
  loadUserAIContext: () => loadUserAIContext
});
function unwrapProgressDoc(value) {
  if (!value) return null;
  return value.data || value.appData || value;
}
function mergeDefined(...items) {
  return items.reduce((acc, item) => {
    if (item && typeof item === "object") {
      Object.assign(acc, item);
    }
    return acc;
  }, {});
}
function collectSyllabusTopics(subject) {
  const def = SYLLABUS[subject];
  const topics = /* @__PURE__ */ new Map();
  const add = (title, count = 1, ref = "") => {
    if (!title) return;
    const existing = topics.get(title) || { count: 0, refs: [] };
    existing.count += count || 1;
    if (ref) existing.refs.push(ref);
    topics.set(title, existing);
  };
  def?.mcqItems?.forEach((item) => add(item.title, item.count || 1, `MCQ ${item.q}`));
  def?.partAItems?.forEach((item) => {
    const weight = item.max || 1;
    (item.topics || [item.title]).forEach((topic) => add(topic, weight, `Part A ${item.q}`));
  });
  def?.partBCDItems?.forEach((item) => {
    const weight = item.max || 1;
    (item.topics || [item.title]).forEach((topic) => add(topic, weight, item.q));
  });
  def?.bcdGroups?.forEach((group) => {
    group.items?.forEach((item) => {
      const weight = item.max || 1;
      (item.topics || [item.title]).forEach((topic) => add(topic, weight, `${group.label} ${item.q}`));
    });
  });
  return topics;
}
function scoreFromQuestionMark(mark) {
  const values = [mark?.total, mark?.mcqRaw, mark?.partARaw, mark?.partBcdRaw, mark?.mcqPer, mark?.partAPer, mark?.partBcdPer].filter((value) => typeof value === "number");
  if (typeof mark?.total === "number") return mark.total;
  if (values.length) return values.reduce((sum, value) => sum + value, 0);
  return 0;
}
function buildProgressFromAppData(appData) {
  const weakMap = /* @__PURE__ */ new Map();
  const recentProgress = [];
  const latestMarks = [];
  const paperMarks = [];
  const questionMarks = [];
  const lessonHistory = [];
  for (const subject of SUBJECTS) {
    const subjectData = appData?.[subject] || {};
    const topics = subjectData.topics || {};
    const syllabusTopics = collectSyllabusTopics(subject);
    const allTopicNames = /* @__PURE__ */ new Set([...Object.keys(topics), ...syllabusTopics.keys()]);
    const completedTopics = [...allTopicNames].filter((topic) => topics[topic]?.checked);
    recentProgress.push({
      subject,
      totalTopics: allTopicNames.size,
      completedTopics: completedTopics.length,
      coveragePercent: allTopicNames.size > 0 ? Math.round(completedTopics.length / allTopicNames.size * 100) : 0
    });
    (subjectData.lessonHistory || []).forEach((item) => {
      lessonHistory.push({ ...item, subject });
    });
    (subjectData.paperMarks || []).forEach((mark) => {
      const normalized = { ...mark, subject };
      paperMarks.push(normalized);
      latestMarks.push(normalized);
    });
    Object.entries(subjectData.questionMarks || {}).forEach(([topic, marks]) => {
      (Array.isArray(marks) ? marks : []).forEach((mark) => {
        const normalized = { ...mark, subject, topic };
        questionMarks.push(normalized);
        const score = scoreFromQuestionMark(mark);
        if (score > 0 && score < 45) {
          const key = `${subject}:${topic}`;
          weakMap.set(key, {
            subject,
            topic,
            lesson: topic,
            reason: `Low question score (${score})${mark?.title ? ` on ${mark.title}` : ""}`,
            priorityWeight: Math.max(syllabusTopics.get(topic)?.count || 1, 1),
            marksWeakness: true,
            lastDoneStatus: topics[topic]?.checked ? "completed" : "incomplete"
          });
        }
      });
    });
    allTopicNames.forEach((topic) => {
      const topicInfo = topics[topic] || {};
      const syllabus = syllabusTopics.get(topic);
      const key = `${subject}:${topic}`;
      const notes = String(topicInfo.notes || "");
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
        "patali"
      ];
      const weakNote = weakKeywords.find((kw) => notes.toLowerCase().includes(kw));
      if (weakNote) {
        weakMap.set(key, {
          ...weakMap.get(key) || {},
          subject,
          topic,
          lesson: topic,
          reason: `User note indicates weakness: ${notes.slice(0, 160)}`,
          notes,
          priorityWeight: Math.max(syllabus?.count || 1, 1),
          lastDoneStatus: topicInfo.checked ? "completed" : "incomplete"
        });
      }
      if (!topicInfo.checked && syllabus && syllabus.count >= 2) {
        weakMap.set(key, {
          ...weakMap.get(key) || {},
          subject,
          topic,
          lesson: topic,
          reason: weakMap.get(key)?.reason || "Incomplete high-weight syllabus topic",
          priorityWeight: Math.max(syllabus.count, 1),
          lastDoneStatus: "incomplete",
          syllabusRefs: syllabus.refs.slice(0, 5)
        });
      }
    });
  }
  const zHistory = Array.isArray(appData?.zScoreHistory) ? appData.zScoreHistory : [];
  const latestZEntry = zHistory[zHistory.length - 1] || null;
  return {
    weakLessons: [...weakMap.values()].sort((a, b) => (b.priorityWeight || 0) - (a.priorityWeight || 0)).slice(0, 25),
    recentProgress,
    latestMarks: latestMarks.slice(-15),
    paperMarks,
    questionMarks,
    lessonHistory,
    latestZ: latestZEntry?.zScore ?? appData?.latestZScore ?? appData?.currentZScore ?? null,
    subjectZScores: latestZEntry?.subjectZScores || appData?.subjectZScores || null
  };
}
async function loadUserAIContext(uid, email) {
  const normalizedEmail = email?.toLowerCase();
  const cacheKey = `${uid}_${normalizedEmail || ""}`;
  const now = Date.now();
  const cached = contextCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const diagnostics = {
    uid,
    email: normalizedEmail || null,
    oldPathFound: false,
    newPathFound: false,
    localExportFound: false,
    migratedLegacyProgress: false,
    progressRecordsChecked: 0,
    lessonHistoryCount: 0,
    paperMarksCount: 0,
    questionMarksCount: 0
  };
  try {
    const db = getAdminDb();
    const uidRef = db.collection("users").doc(uid);
    const emailRef = normalizedEmail ? db.collection("users").doc(normalizedEmail) : null;
    const [
      uidRoot,
      emailRoot,
      uidProfile,
      emailProfile,
      uidProgress,
      emailProgress,
      uidSettings,
      emailSettings
    ] = await Promise.all([
      uidRef.get().catch(() => null),
      emailRef ? emailRef.get().catch(() => null) : null,
      uidRef.collection("profile").doc("main").get().catch(() => null),
      emailRef ? emailRef.collection("profile").doc("info").get().catch(() => null) : null,
      uidRef.collection("progress").doc("data").get().catch(() => null),
      emailRef ? emailRef.collection("progress").doc("data").get().catch(() => null) : null,
      uidRef.collection("settings").doc("main").get().catch(() => null),
      emailRef ? emailRef.collection("settings").doc("main").get().catch(() => null) : null
    ]);
    diagnostics.newPathFound = Boolean(uidRoot?.exists || uidProfile?.exists || uidProgress?.exists);
    diagnostics.oldPathFound = Boolean(emailRoot?.exists || emailProfile?.exists || emailProgress?.exists);
    const uidProgressData = uidProgress?.exists ? unwrapProgressDoc(uidProgress.data()) : null;
    const emailProgressData = emailProgress?.exists ? unwrapProgressDoc(emailProgress.data()) : null;
    const uidRootData = uidRoot?.exists ? uidRoot.data() : null;
    const emailRootData = emailRoot?.exists ? emailRoot.data() : null;
    let appData = uidProgressData || emailProgressData || uidRootData?.appData || uidRootData?.data || emailRootData?.appData || emailRootData?.data;
    if (!appData && normalizedEmail) {
      const localUser = readUser(normalizedEmail);
      appData = localUser?.data || localUser?.appData || null;
      diagnostics.localExportFound = Boolean(appData);
    }
    if (!uidProgressData && emailProgressData) {
      await uidRef.collection("progress").doc("data").set({
        data: emailProgressData,
        migratedFromEmail: normalizedEmail,
        migratedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true }).catch(() => null);
      diagnostics.migratedLegacyProgress = true;
    }
    const profileData = mergeDefined(
      emailRootData,
      emailProfile?.exists ? emailProfile.data() : null,
      uidRootData,
      uidProfile?.exists ? uidProfile.data() : null
    );
    if (normalizedEmail && uidProfile && !uidProfile.exists && (emailProfile?.exists || profileData.email || profileData.username)) {
      await uidRef.collection("profile").doc("main").set({
        ...profileData,
        email: normalizedEmail,
        migratedFromEmail: normalizedEmail,
        migratedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true }).catch(() => null);
    }
    const parsed = buildProgressFromAppData(appData);
    diagnostics.progressRecordsChecked = parsed.recentProgress.length;
    diagnostics.lessonHistoryCount = parsed.lessonHistory.length;
    diagnostics.paperMarksCount = parsed.paperMarks.length;
    diagnostics.questionMarksCount = parsed.questionMarks.length;
    const [memoryUid, memoryEmail, chatUid, chatEmail] = await Promise.all([
      uidRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })),
      emailRef ? emailRef.collection("ai_memory").limit(20).get().catch(() => ({ docs: [] })) : { docs: [] },
      uidRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })),
      emailRef ? emailRef.collection("chat_history").orderBy("createdAt", "desc").limit(15).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);
    const memoryDocs = [...memoryUid.docs, ...memoryEmail.docs];
    const chatDocs = [...chatUid.docs, ...chatEmail.docs];
    const contextData = {
      profile: {
        uid,
        name: profileData?.name || profileData?.username || profileData?.displayName || (normalizedEmail ? normalizedEmail.split("@")[0] : "Student"),
        email: normalizedEmail || profileData?.email,
        stream: profileData?.stream || "G.C.E. A/L Technology",
        district: profileData?.district || "Unknown"
      },
      preferences: mergeDefined(emailSettings?.exists ? emailSettings.data() : null, uidSettings?.exists ? uidSettings.data() : null, profileData?.preferences),
      appData,
      latestMarks: parsed.latestMarks,
      paperMarks: parsed.paperMarks,
      questionMarks: parsed.questionMarks,
      lessonHistory: parsed.lessonHistory.slice(-30),
      weakLessons: parsed.weakLessons,
      recentProgress: parsed.recentProgress,
      latestZ: parsed.latestZ,
      subjectZScores: parsed.subjectZScores,
      aiMemory: Array.from(new Map(memoryDocs.map((doc) => [doc.id, doc.data()])).values()),
      chatHistoryLast10: Array.from(new Map(chatDocs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }])).values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-10),
      examDates: profileData?.examDates || {},
      targetZ: appData?.targetZScore ?? appData?.targetZ ?? profileData?.targetZScore ?? profileData?.targetZ ?? null,
      currentTimeAsiaColombo: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: process.env.APP_TIME_ZONE || "Asia/Colombo" }),
      diagnostics
    };
    contextCache.set(cacheKey, { data: contextData, timestamp: now });
    return contextData;
  } catch (e) {
    console.error("loadUserAIContext error", e);
    return {
      profile: { uid, name: "Student", email: normalizedEmail },
      preferences: {},
      appData: null,
      latestMarks: [],
      paperMarks: [],
      questionMarks: [],
      lessonHistory: [],
      weakLessons: [],
      recentProgress: [],
      latestZ: null,
      subjectZScores: null,
      aiMemory: [],
      chatHistoryLast10: [],
      examDates: {},
      currentTimeAsiaColombo: (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Colombo" }),
      diagnostics
    };
  }
}
var contextCache, CACHE_TTL, SUBJECTS;
var init_userContext = __esm({
  "server/firebase/userContext.ts"() {
    "use strict";
    init_syllabus();
    init_userRepository();
    init_admin();
    contextCache = /* @__PURE__ */ new Map();
    CACHE_TTL = 1e4;
    SUBJECTS = ["sft", "et", "ict"];
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

// server/image/generate.ts
var generate_exports = {};
__export(generate_exports, {
  generateEducationalImage: () => generateEducationalImage
});
async function generateEducationalImage(req) {
  try {
    const { prompt, subject, lesson, style, mode } = req.body;
    const uid = req.user.uid;
    if (!prompt) throw new Error("Prompt is required");
    const finalPrompt = `Create a clean Sinhala G.C.E. A/L Technology exam-focused diagram. Clear labels. Minimal clutter. Accurate educational layout. No watermark. Sinhala labels where useful. Subject: ${subject || "Technology"}. Lesson: ${lesson || "General"}. User request: ${prompt}`;
    const configuredModel = process.env.GEMINI_IMAGE_MODEL || process.env.NANO_BANANA_MODEL || "imagen-3.0-generate-001";
    const fallbackModel = process.env.GEMINI_IMAGE_PRO_MODEL || process.env.NANO_BANANA_PRO_MODEL || "imagen-3.0-generate-001";
    const modelsToTry = [configuredModel, fallbackModel, "imagen-3.0-generate-001"];
    const uniqueModels = Array.from(new Set(modelsToTry));
    let imageBase64;
    let modelUsed = "";
    let lastError = null;
    const ai = getAIClient();
    for (const modelName of uniqueModels) {
      try {
        modelUsed = modelName;
        if (modelName.toLowerCase().startsWith("imagen")) {
          const response = await ai.models.generateImages({
            model: modelName,
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
              aspectRatio: "1:1"
            }
          });
          if (response && response.generatedImages && response.generatedImages.length > 0) {
            imageBase64 = response.generatedImages[0].image?.imageBytes;
          }
        } else if (modelName.toLowerCase().includes("gemini") && modelName.toLowerCase().includes("image")) {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: finalPrompt,
            config: {
              responseModalities: ["TEXT", "IMAGE"]
            }
          });
          const parts = response.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              imageBase64 = part.inlineData.data;
              break;
            }
          }
        }
        if (imageBase64) {
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Image generation with model ${modelName} failed, trying fallback:`, err.message || err);
      }
    }
    if (!imageBase64) {
      console.error("All image generation models failed. Last error:", lastError);
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
      const bucket = (0, import_storage.getStorage)().bucket();
      const path4 = `generated_images/${uid}/${imageId}.jpg`;
      const file = bucket.file(path4);
      await file.save(Buffer.from(imageBase64, "base64"), {
        metadata: {
          contentType: "image/jpeg"
        }
      });
      try {
        await file.makePublic();
      } catch (e) {
      }
      imageUrl = `https://storage.googleapis.com/${bucket.name}/${path4}`;
      storagePath = path4;
    } catch (storageErr) {
      console.warn("Firebase Storage upload failed, falling back to data URL:", storageErr);
    }
    try {
      const db = getAdminDb();
      const imageRef = db.collection("users").doc(uid).collection("generated_images").doc(imageId);
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
var import_storage;
var init_generate = __esm({
  "server/image/generate.ts"() {
    "use strict";
    init_client();
    init_admin();
    import_storage = require("firebase-admin/storage");
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
        const paperYear = pExam.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || yearMatch || "unknown";
        sourceCards.push({
          source: "Local Database",
          title: `${pExam} - ${pSubjectFull} MCQ Answer Key`,
          url: `/api/past-papers/local/${pSubject.toLowerCase()}/${paperYear}`,
          type: "Answer Sheet",
          snippet: `Official MCQ answer sheet keys for ${pExam} ${pSubjectFull} (${p.metadata.medium || "Sinhala"} medium). Contains ${p.answers.length} verified MCQ answers.`
        });
      }
    });
    try {
      let fRef = db.collection("past_papers");
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
    if (process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true") try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
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
      sourceCards: uniqueSourceCards,
      message: uniqueSourceCards.length ? "Verified source cards found." : "No verified PDF or local paper was found. Upload a paper/source file to index it."
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

// server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default,
  startServer: () => startServer
});
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express3 = __toESM(require("express"), 1);
var import_fs4 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_app = require("firebase-admin/app");
var import_storage2 = require("firebase-admin/storage");

// server/ai/routes.ts
var import_express = __toESM(require("express"), 1);
init_admin();

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

// server/ai/prompts.ts
function getCloraSystemPrompt(contextData, mode) {
  const weakLessons = (contextData?.weakLessons || []).map((w) => ({
    subject: w.subject,
    topic: w.topic || w.lesson,
    reason: w.reason,
    priorityWeight: w.priorityWeight,
    lastDoneStatus: w.lastDoneStatus
  }));
  const diagnostics = contextData?.diagnostics || {};
  return `
You are Clora X, a Sinhala-first personal AI tutor for Sri Lankan G.C.E. A/L Engineering Technology stream.

You are not a generic assistant. You are the user's personal study partner.

You must answer using:
1. logged-in user's Firebase profile,
2. actual user progress,
3. actual marks,
4. actual weak lessons,
5. actual wrong questions,
6. AI memory,
7. recent chat history,
8. retrieved syllabus / NotebookLM mirrored source chunks,
9. verified Google Search results only when search is enabled.

User Context:
Name: ${contextData?.profile?.name || "Unknown"}
Stream: ${contextData?.profile?.stream || "Unknown"}
Current Time (Colombo): ${contextData?.currentTimeAsiaColombo || ""}
Target Z-Score: ${contextData?.targetZ || "Not set"}
Latest Z-Score: ${contextData?.latestZ ?? "Not available"}
Subject Z-Scores: ${JSON.stringify(contextData?.subjectZScores || null)}
Progress Records Checked: ${diagnostics.progressRecordsChecked || 0}
Lesson History Count: ${diagnostics.lessonHistoryCount || 0}
Paper Marks Count: ${diagnostics.paperMarksCount || 0}
Question Marks Count: ${diagnostics.questionMarksCount || 0}
Weak Lessons: ${JSON.stringify(weakLessons)}
Recent Progress: ${JSON.stringify(contextData?.recentProgress || [])}
Recent Lesson History: ${JSON.stringify(contextData?.lessonHistory?.slice(-10) || [])}
Latest Marks: ${JSON.stringify(contextData?.latestMarks?.slice(-8) || [])}
AI Memory: ${JSON.stringify(contextData?.aiMemory || [])}

Never invent:
- user marks
- progress
- Z-score
- district rank
- island rank
- past-paper links
- NotebookLM content
- syllabus facts
- sources

If data is missing, say it is missing and continue with a safe answer.

PERSONAL CONNECTION RULES:
- Make the user feel understood from previous data.
- Use the user's name naturally, not every message.
- Refer to actual goal, weak lessons, recent progress, and marks only when available.
- Keep continuity across conversations.
- Remember stable preferences only.
- Do not sound robotic.
- Do not overdo emotional language.
- Be direct, calm, and exam-focused.
- The user prefers Sinhala, fast answers, exact schedules, target marks, and weak-area repair.
- The user studies A/L Technology: SFT, ET, ICT.
- If user says "\u0D85\u0DAF \u0DB8\u0DDC\u0DB1\u0DC0\u0DAF?", use current Sri Lanka time and show only remaining hours.
- If user asks for two subjects per day, output exactly two subjects.
- If user asks short, answer short.
- If user asks deep, explain deeply.

STYLE:
Sinhala first. English only for technical terms. Clean markdown. Minimal emojis. No fake motivation paragraphs. No long intro. Answer directly first.

FOR STUDY PLANS:
- exactly two subjects per day unless user overrides
- weak lessons first
- high Z-impact topics first
- lesson-wise past papers
- active recall
- wrong-answer repair
- spaced repetition
- target after the session

FOR EXPLANATIONS:
- direct answer first
- step-by-step explanation
- formula only when relevant
- exam tip
- 1-3 practice questions max

FOR PAST PAPER / PREDICTION:
- never claim exact paper prediction
- use evidence, frequency, recency, syllabus weighting, mark distribution
- show confidence level

FOR WEB/LINKS:
- never fabricate links
- use Google Search only when needed

Do not reveal hidden reasoning.
You may show only a safe reasoning summary.
Current Mode: ${mode}
`;
}

// server/ai/respond.ts
init_userContext();

// server/knowledge/retrieve.ts
init_syllabus();
init_pastPapersData();
init_admin();
function tokens(value) {
  return new Set(
    String(value || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2)
  );
}
function scoreText(promptTokens, text, subject, activeSubject) {
  const lower = String(text || "").toLowerCase();
  let score = 0;
  promptTokens.forEach((token) => {
    if (lower.includes(token)) score += token.length > 3 ? 2 : 1;
  });
  if (activeSubject && subject && subject.toLowerCase() === activeSubject.toLowerCase()) score += 4;
  return score;
}
function addLocalSyllabusChunks(chunks, promptTokens, activeSubject) {
  Object.entries(SYLLABUS).forEach(([subject, def]) => {
    if (activeSubject && subject !== activeSubject) return;
    def.mcqItems?.forEach((item) => {
      const text = `Subject ${subject.toUpperCase()} MCQ syllabus ${item.q}: ${item.title}. Expected MCQ count: ${item.count || 1}.`;
      chunks.push({
        title: `${subject.toUpperCase()} ${item.q} ${item.title}`,
        subject,
        topic: item.title,
        type: "syllabus",
        text,
        score: scoreText(promptTokens, text, subject, activeSubject)
      });
    });
    const essayItems = [
      ...(def.partAItems || []).map((item) => ({ ...item, section: "Part A" })),
      ...(def.partBCDItems || []).map((item) => ({ ...item, section: "Essay" })),
      ...(def.bcdGroups || []).flatMap((group) => (group.items || []).map((item) => ({ ...item, section: group.label })))
    ];
    essayItems.forEach((item) => {
      const topics = (item.topics || [item.title]).join(", ");
      const text = `Subject ${subject.toUpperCase()} ${item.section} ${item.q}: ${item.subTitle || item.title}. Topics: ${topics}. Max marks: ${item.max || "not set"}.`;
      chunks.push({
        title: `${subject.toUpperCase()} ${item.section} ${item.q}`,
        subject,
        topic: topics,
        type: "syllabus",
        text,
        score: scoreText(promptTokens, text, subject, activeSubject)
      });
    });
  });
}
function addUserContextChunks(chunks, promptTokens, context, activeSubject) {
  context?.recentProgress?.forEach((item) => {
    const text = `${item.subject?.toUpperCase()} progress: ${item.completedTopics}/${item.totalTopics} lessons completed (${item.coveragePercent}%).`;
    chunks.push({
      title: `${item.subject?.toUpperCase()} progress summary`,
      subject: item.subject,
      type: "firebase_progress",
      text,
      score: scoreText(promptTokens, text, item.subject, activeSubject) + 3
    });
  });
  context?.weakLessons?.slice(0, 20).forEach((lesson) => {
    const text = `${lesson.subject?.toUpperCase()} weak/incomplete lesson: ${lesson.topic || lesson.lesson}. Reason: ${lesson.reason || "not recorded"}. Priority weight: ${lesson.priorityWeight || 1}. Last status: ${lesson.lastDoneStatus || "unknown"}.`;
    chunks.push({
      title: `${lesson.subject?.toUpperCase()} weak lesson ${lesson.topic || lesson.lesson}`,
      subject: lesson.subject,
      topic: lesson.topic || lesson.lesson,
      type: "firebase_progress",
      text,
      score: scoreText(promptTokens, text, lesson.subject, activeSubject) + (lesson.priorityWeight || 1)
    });
  });
  context?.paperMarks?.slice(-20).forEach((mark) => {
    const text = `${mark.subject?.toUpperCase()} paper mark: ${mark.title || "untitled"} total ${mark.total ?? "unknown"}, MCQ ${mark.mcq ?? mark.mcqRaw ?? "unknown"}, essay ${mark.essay ?? "unknown"}, grade ${mark.grade || "unknown"}.`;
    chunks.push({
      title: `${mark.subject?.toUpperCase()} mark ${mark.title || ""}`.trim(),
      subject: mark.subject,
      type: "firebase_progress",
      text,
      score: scoreText(promptTokens, text, mark.subject, activeSubject) + 2
    });
  });
  const appData = context?.appData;
  if (!appData) return;
  ["sft", "et", "ict"].forEach((subject) => {
    if (activeSubject && activeSubject !== subject) return;
    const topics = appData[subject]?.topics || {};
    Object.entries(topics).forEach(([topic, data]) => {
      const notes = String(data?.notes || "").trim();
      if (!notes) return;
      const text = `${subject.toUpperCase()} user note for ${topic}: ${notes.slice(0, 1200)}`;
      chunks.push({
        title: `${subject.toUpperCase()} note ${topic}`,
        subject,
        topic,
        type: "note",
        text,
        score: scoreText(promptTokens, text, subject, activeSubject) + 5
      });
    });
  });
}
function addPastPaperChunks(chunks, promptTokens, activeSubject) {
  (pastPapersData.papers || []).forEach((paper) => {
    const subject = paper.metadata?.subjectKey || "";
    if (activeSubject && subject !== activeSubject) return;
    const answers = (paper.answers || []).slice(0, 50).map((item) => `Q${item.question}:${item.answer}`).join(", ");
    const text = `${paper.metadata?.exam} ${paper.metadata?.subject} ${paper.metadata?.medium || ""} MCQ answer key. Answers: ${answers}`;
    chunks.push({
      title: `${paper.metadata?.exam} ${paper.metadata?.subject} answer key`,
      subject,
      type: "past_paper",
      url: `/api/past-papers/local/${subject}/${String(paper.metadata?.exam || "").match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "unknown"}`,
      text,
      score: scoreText(promptTokens, text, subject, activeSubject)
    });
  });
}
async function addFirestoreChunks(chunks, params, promptTokens) {
  const db = getAdminDb();
  const activeSubject = params.activeSubject;
  try {
    let query = db.collection("knowledge_chunks");
    if (activeSubject) query = query.where("subject", "==", activeSubject);
    const snap = await query.limit(60).get();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const text = String(data.text || data.content || data.summary || "");
      if (!text) return;
      chunks.push({
        title: data.title || data.sourceTitle || `Knowledge ${doc.id}`,
        subject: data.subject,
        topic: data.topic,
        type: data.type || "syllabus",
        url: data.url || data.sourceUrl,
        text: text.slice(0, 1800),
        score: scoreText(promptTokens, `${data.title || ""} ${data.topic || ""} ${text}`, data.subject, activeSubject) + (data.score || 0)
      });
    });
  } catch (e) {
    console.warn("knowledge_chunks retrieval failed:", e);
  }
  if (!params.uid) return;
  const refs = [
    db.collection("users").doc(params.uid),
    params.email ? db.collection("users").doc(params.email.toLowerCase()) : null
  ].filter(Boolean);
  for (const ref of refs) {
    try {
      const notesSnap = await ref.collection("notes").limit(30).get();
      notesSnap.docs.forEach((doc) => {
        const data = doc.data();
        const text = String(data.text || data.content || data.notes || "");
        if (!text) return;
        chunks.push({
          title: data.title || `Saved note ${doc.id}`,
          subject: data.subject,
          topic: data.topic,
          type: "note",
          url: data.url,
          text: text.slice(0, 1200),
          score: scoreText(promptTokens, `${data.title || ""} ${data.topic || ""} ${text}`, data.subject, activeSubject) + 4
        });
      });
    } catch (e) {
      console.warn("user notes retrieval failed:", e);
    }
    try {
      const filesSnap = await ref.collection("files").limit(30).get();
      filesSnap.docs.forEach((doc) => {
        const data = doc.data();
        const text = String(data.extractedText || data.summary || data.title || "");
        if (!text && !data.url) return;
        chunks.push({
          title: data.title || data.name || `Uploaded source ${doc.id}`,
          subject: data.subject,
          topic: data.topic,
          type: data.notebookLmUrl ? "notebooklm" : "web",
          url: data.notebookLmUrl || data.url || data.downloadURL,
          text: (text || "Uploaded file metadata; text was not extracted yet.").slice(0, 1200),
          score: scoreText(promptTokens, `${data.title || ""} ${data.topic || ""} ${text}`, data.subject, activeSubject) + 2
        });
      });
    } catch (e) {
      console.warn("user files retrieval failed:", e);
    }
  }
}
async function retrieveRelevantKnowledge(params) {
  const limit = Math.max(1, Math.min(params.limit || 8, 20));
  const promptTokens = tokens(`${params.prompt || ""} ${params.activeSubject || ""} ${params.mode || ""}`);
  const chunks = [];
  addLocalSyllabusChunks(chunks, promptTokens, params.activeSubject);
  addPastPaperChunks(chunks, promptTokens, params.activeSubject);
  addUserContextChunks(chunks, promptTokens, params.userContext, params.activeSubject);
  await addFirestoreChunks(chunks, params, promptTokens);
  const deduped = Array.from(new Map(chunks.map((chunk) => [`${chunk.type}:${chunk.title}:${chunk.url || ""}:${chunk.text.slice(0, 80)}`, chunk])).values());
  return deduped.map((chunk) => ({ ...chunk, score: chunk.score || 0 })).sort((a, b) => b.score - a.score).slice(0, limit);
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
    const knowledgeChunks = await retrieveRelevantKnowledge({
      prompt,
      activeSubject,
      mode,
      uid,
      email: req.user?.email,
      userContext: contextData
    });
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
    const ai = getAIClient();
    let response = null;
    let modelUsed = "";
    let lastError = null;
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
        const chat = ai.chats.create({
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
        lastError = err;
        console.warn(`Model ${m} failed/unavailable, trying fallback if possible. Error:`, err.message || err);
        continue;
      }
    }
    if (!response) {
      throw lastError || new Error("All model options in the fallback chain failed.");
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
      content: prompt,
      mode,
      subject: subject || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const aiMsgRef = historyRef.doc();
    batch.set(aiMsgRef, {
      role: "assistant",
      text: response,
      content: response,
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
init_pastPapersData();

// server/ai/respondStream.ts
init_client();
init_userContext();
init_admin();

// server/ai/workflow.ts
var AI_WORKFLOW_STAGES = {
  thinking: "Thinking",
  auth: "Verifying account",
  profile: "Reading your profile",
  progress: "Checking your progress",
  memory: "Loading study memory",
  sources: "Checking lesson sources",
  search: "Searching web",
  planning: "Planning answer",
  generating: "Writing answer",
  saving: "Saving memory",
  done: "Thought",
  error: "Stopped"
};
function sendSSE(res, event, data) {
  try {
    res.write(`event: ${event}
`);
    res.write(`data: ${JSON.stringify(data)}

`);
    if (res.flush) res.flush();
  } catch (e) {
  }
}

// server/ai/memoryExtractor.ts
init_client();
init_admin();
async function extractStableMemoryIfUseful(params) {
  try {
    const ai = getAIClient();
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
    const response = await ai.models.generateContent({
      model: AI_MODELS.default,
      contents: extractionPrompt,
      config: { temperature: 0.1 }
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
    console.warn("Memory extraction failed", e);
  }
  return [];
}

// server/ai/respondStream.ts
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
    case "past_paper_analysis":
      return 0.25;
    case "zscore_prediction":
      return 0.2;
    default:
      return 0.4;
  }
}
function getMaxTokens(mode) {
  switch (mode) {
    case "tutor_explanation":
      return 2500;
    case "study_plan":
      return 3500;
    case "past_paper_analysis":
    case "zscore_prediction":
    case "mark_analysis":
      return 4500;
    default:
      return 1200;
  }
}
function chooseModel(mode) {
  switch (mode) {
    case "study_plan":
      return AI_MODELS.default;
    // or pro for deep
    case "past_paper_analysis":
    case "zscore_prediction":
    case "mark_analysis":
      return AI_MODELS.pro;
    case "image_generation":
      return AI_MODELS.image;
    default:
      return AI_MODELS.default;
  }
}
async function saveFinalChat(params) {
  try {
    const db = getAdminDb();
    const batch = db.batch();
    const historyRef = db.collection("users").doc(params.uid).collection("chat_history");
    batch.set(historyRef.doc(), {
      role: "user",
      text: params.userText,
      content: params.userText,
      mode: params.mode,
      subject: params.subject || null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    batch.set(historyRef.doc(), {
      role: "assistant",
      text: params.assistantText,
      content: params.assistantText,
      mode: params.mode,
      subject: params.subject || null,
      sources: params.sources || [],
      model: params.model || null,
      safeSummary: params.safeSummary || [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await batch.commit();
  } catch (e) {
    console.warn("saveFinalChat error", e);
  }
}
async function aiRespondStream(req, res) {
  const startedAt = Date.now();
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  try {
    const { prompt, activeSubject, mode = "auto", history = [] } = req.body;
    const user = req.user;
    sendSSE(res, "status", { stage: "thinking", label: AI_WORKFLOW_STAGES.thinking, startedAt, timestamp: Date.now() });
    sendSSE(res, "status", { stage: "profile", label: AI_WORKFLOW_STAGES.profile, startedAt, timestamp: Date.now() });
    const userContext = await loadUserAIContext(user.uid, user.email);
    sendSSE(res, "status", { stage: "progress", label: AI_WORKFLOW_STAGES.progress, startedAt, timestamp: Date.now() });
    const selectedMode = classifyMode(prompt, mode);
    if (selectedMode === "image_generation") {
      sendSSE(res, "status", { stage: "generating", label: "Generating Educational Diagram...", startedAt, timestamp: Date.now() });
      const { generateEducationalImage: generateEducationalImage2 } = await Promise.resolve().then(() => (init_generate(), generate_exports));
      const imgResult = await generateEducationalImage2(req);
      if (imgResult.ok && imgResult.imageUrl) {
        const imageMarkdown = `

![Generated Educational Diagram](${imgResult.imageUrl})

*(Model used: ${imgResult.model})*

`;
        sendSSE(res, "chunk", { text: imageMarkdown });
        await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: imageMarkdown, mode: selectedMode, subject: activeSubject, model: imgResult.model });
        sendSSE(res, "done", {
          ok: true,
          totalSeconds: Math.round((Date.now() - startedAt) / 1e3),
          totalMs: Date.now() - startedAt
        });
        return;
      } else {
        throw new Error(imgResult.error || "Failed to generate diagram.");
      }
    }
    if (selectedMode === "past_paper_search") {
      sendSSE(res, "status", { stage: "search", label: "Searching past papers database...", startedAt, timestamp: Date.now() });
      const { searchPastPapers: searchPastPapers2 } = await Promise.resolve().then(() => (init_search(), search_exports));
      let searchResult = null;
      const mockRes = {
        status: () => mockRes,
        json: (val) => {
          searchResult = val;
        }
      };
      let yearMatch = "";
      const yearMatches = prompt.match(/\b(201\d|202\d)\b/);
      if (yearMatches) yearMatch = yearMatches[1];
      let subjectMatch = activeSubject || "";
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes("sft") || lowerPrompt.includes("technology")) subjectMatch = "sft";
      else if (lowerPrompt.includes("et") || lowerPrompt.includes("engineering")) subjectMatch = "et";
      else if (lowerPrompt.includes("ict")) subjectMatch = "ict";
      await searchPastPapers2({
        body: { query: prompt, yearMatch, subjectMatch }
      }, mockRes);
      if (searchResult && searchResult.ok && searchResult.sourceCards && searchResult.sourceCards.length > 0) {
        let responseMarkdown = `### \u{1F4DA} Found Verified Past Papers & Resources

`;
        responseMarkdown += `\u0DB8\u0DD9\u0DB1\u0DCA\u0DB1 \u0D94\u0DB6 \u0DC3\u0DD9\u0DC0\u0DD6 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB \u0DC3\u0DC4 \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB4\u0DAD\u0DCA\u200D\u0DBB \u0DC3\u0DB6\u0DD0\u0DB3\u0DD2 (Direct Download Links):

`;
        searchResult.sourceCards.forEach((card) => {
          responseMarkdown += `#### \u{1F4CE} **${card.title}**
`;
          responseMarkdown += `- **\u0DB4\u0DCA\u200D\u0DBB\u0DB7\u0DC0\u0DBA (Source):** ${card.source} | **\u0DC0\u0DBB\u0DCA\u0D9C\u0DBA (Type):** ${card.type}
`;
          if (card.snippet) {
            responseMarkdown += `- **\u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA (Description):** *${card.snippet}*
`;
          }
          responseMarkdown += `- \u{1F4E5} **Download Link:** [\u0DB8\u0DAD \u0D9A\u0DCA\u0DBD\u0DD2\u0D9A\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 (${card.type})](${card.url})

`;
        });
        sendSSE(res, "chunk", { text: responseMarkdown });
        await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: responseMarkdown, mode: selectedMode, subject: activeSubject, sources: searchResult.sourceCards || [] });
        sendSSE(res, "done", {
          ok: true,
          totalSeconds: Math.round((Date.now() - startedAt) / 1e3),
          totalMs: Date.now() - startedAt
        });
        return;
      } else {
        const fallbackMsg = `\u26A0\uFE0F \u0DC3\u0DB8\u0DCF\u0DC0\u0DB1\u0DCA\u0DB1, \u0D94\u0DB6 \u0DC3\u0DD9\u0DC0\u0DD6 **"${prompt}"** \u0DC3\u0DB3\u0DC4\u0DCF \u0DC3\u0DD8\u0DA2\u0DD4 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0DB4\u0DAD\u0DCA\u200D\u0DBB \u0DC3\u0DB6\u0DD0\u0DB3\u0DD2\u0DBA\u0D9A\u0DCA \u0D85\u0DB4\u0D9C\u0DDA \u0DB4\u0DAF\u0DCA\u0DB0\u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DCA \u0DC3\u0DDC\u0DBA\u0DCF\u0D9C\u0DAD \u0DB1\u0DDC\u0DC4\u0DD0\u0D9A\u0DD2 \u0DC0\u0DD2\u0DBA.

\u0D9A\u0DBB\u0DD4\u0DAB\u0DCF\u0D9A\u0DBB \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DC0\u0DBB\u0DCA\u0DC2\u0DBA \u0DC3\u0DC4 \u0DC0\u0DD2\u0DC2\u0DBA (\u0D8B\u0DAF\u0DCF: SFT 2024 past paper) \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB \u0DB1\u0DD0\u0DC0\u0DAD \u0D8B\u0DAD\u0DCA\u0DC3\u0DCF\u0DC4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.`;
        sendSSE(res, "chunk", { text: fallbackMsg });
        await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: fallbackMsg, mode: selectedMode, subject: activeSubject });
        sendSSE(res, "done", {
          ok: true,
          totalSeconds: Math.round((Date.now() - startedAt) / 1e3),
          totalMs: Date.now() - startedAt
        });
        return;
      }
    }
    sendSSE(res, "status", { stage: "sources", label: AI_WORKFLOW_STAGES.sources, startedAt, timestamp: Date.now() });
    const chunks = await retrieveRelevantKnowledge({
      prompt,
      activeSubject,
      mode: selectedMode,
      limit: 8,
      uid: user.uid,
      email: user.email,
      userContext
    });
    const searchEnabled = requiresGoogleSearch(selectedMode, prompt);
    if (searchEnabled) {
      sendSSE(res, "status", { stage: "search", label: AI_WORKFLOW_STAGES.search, startedAt, timestamp: Date.now() });
    }
    const modelChain = getModelFallbackChain(chooseModel(selectedMode));
    sendSSE(res, "status", { stage: "planning", label: AI_WORKFLOW_STAGES.planning, startedAt, timestamp: Date.now() });
    const finalPrompt = getCloraSystemPrompt(userContext, selectedMode) + (chunks?.length ? `

Reference Sources:
${JSON.stringify(chunks)}` : "") + (history?.length ? `

Previous Chat History:
${JSON.stringify(history)}` : "") + `

Current User Request:
${prompt}`;
    sendSSE(res, "status", { stage: "generating", label: AI_WORKFLOW_STAGES.generating, startedAt, timestamp: Date.now() });
    const ai = getAIClient();
    let stream = null;
    let modelUsed = "";
    let lastError = null;
    for (const m of modelChain) {
      try {
        modelUsed = m;
        stream = await ai.models.generateContentStream({
          model: m,
          contents: finalPrompt,
          config: {
            temperature: getTemperature(selectedMode),
            maxOutputTokens: getMaxTokens(selectedMode),
            tools: searchEnabled ? [{ googleSearch: {} }] : void 0
          }
        });
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Streaming with model ${m} failed/unavailable, trying fallback. Error:`, err.message || err);
        continue;
      }
    }
    if (!stream) {
      throw lastError || new Error("All model streaming options failed.");
    }
    let fullText = "";
    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        fullText += text;
        sendSSE(res, "chunk", { text });
      }
    }
    sendSSE(res, "status", { stage: "saving", label: AI_WORKFLOW_STAGES.saving, startedAt, timestamp: Date.now() });
    const safeSummary = [
      "Profile loaded",
      `${userContext?.recentProgress?.length || 0} progress records checked`,
      `${chunks?.length || 0} lesson source chunks retrieved`,
      `Google Search used: ${searchEnabled ? "yes" : "no"}`,
      `Model: ${modelUsed}`
    ];
    await saveFinalChat({ uid: user.uid, userText: prompt, assistantText: fullText, mode: selectedMode, subject: activeSubject, sources: chunks, model: modelUsed, safeSummary });
    await extractStableMemoryIfUseful({ uid: user.uid, prompt, answer: fullText, userContext });
    sendSSE(res, "safe_summary", { items: safeSummary });
    sendSSE(res, "done", { ok: true, totalMs: Date.now() - startedAt, totalSeconds: Math.round((Date.now() - startedAt) / 1e3) });
    res.end();
  } catch (error) {
    console.error("Stream Error", error);
    const classified = classifyAIError(error);
    sendSSE(res, "error", { ok: false, error: classified.error, hint: classified.hint, code: classified.code });
    sendSSE(res, "done", { ok: false, totalMs: Date.now() - startedAt, totalSeconds: Math.round((Date.now() - startedAt) / 1e3) });
    res.end();
  }
}

// server/ai/routes.ts
var aiRoutes = import_express.default.Router();
aiRoutes.get("/self-test", async (req, res) => {
  const result = {
    ok: true,
    authPath: "vertex-ai-adc",
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    models: {
      fast: AI_MODELS.fast,
      default: AI_MODELS.default,
      pro: AI_MODELS.pro,
      image: AI_MODELS.image
    },
    searchGroundingEnabled: process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true",
    textModelOk: false,
    imageModelConfigured: Boolean(AI_MODELS.image),
    firestoreContextOk: false,
    knowledgeRetrievalOk: false
  };
  try {
    prepareGoogleCredentials();
    const ai = getAIClient();
    let text = "";
    for (const model of getModelFallbackChain(AI_MODELS.fast)) {
      try {
        const response = await ai.models.generateContent({ model, contents: "Reply only: OK" });
        text = response.text || "";
        result.textModelOk = true;
        result.textModelUsed = model;
        result.text = text;
        break;
      } catch (error) {
        result.lastTextModelError = error.message;
      }
    }
    try {
      await getAdminDb().listCollections();
      result.firestoreContextOk = true;
    } catch (error) {
      result.firestoreError = error.message;
    }
    const chunks = await retrieveRelevantKnowledge({
      prompt: "SFT ET ICT syllabus progress",
      activeSubject: "sft",
      mode: "self-test",
      limit: 3
    });
    result.knowledgeRetrievalOk = chunks.length > 0;
    result.knowledgeChunksRetrieved = chunks.length;
    if (!result.textModelOk) result.ok = false;
    res.status(result.ok ? 200 : 500).json(result);
  } catch (error) {
    result.ok = false;
    result.error = error.message;
    res.status(500).json(result);
  }
});
aiRoutes.post("/debug-context", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { loadUserAIContext: loadUserAIContext2 } = await Promise.resolve().then(() => (init_userContext(), userContext_exports));
    const context = await loadUserAIContext2(user.uid, user.email);
    const knowledgeChunks = await retrieveRelevantKnowledge({
      prompt: req.body?.prompt || "progress weak lessons syllabus",
      activeSubject: req.body?.activeSubject,
      mode: req.body?.mode || "debug",
      uid: user.uid,
      email: user.email,
      userContext: context,
      limit: 8
    });
    res.json({
      ok: true,
      uid: user.uid,
      email: user.email || null,
      emailMasked: (user.email || "").replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      oldPathFound: context.diagnostics?.oldPathFound || false,
      newPathFound: context.diagnostics?.newPathFound || false,
      migratedLegacyProgress: context.diagnostics?.migratedLegacyProgress || false,
      loadedProfileFields: Object.keys(context.profile || {}),
      progressRecordsChecked: context.diagnostics?.progressRecordsChecked || 0,
      lessonHistoryCount: context.diagnostics?.lessonHistoryCount || 0,
      paperMarksCount: context.diagnostics?.paperMarksCount || 0,
      questionMarksCount: context.diagnostics?.questionMarksCount || 0,
      knowledgeChunksRetrieved: knowledgeChunks.length,
      weakLessons: context.weakLessons || [],
      latestZ: context.latestZ,
      subjectZScores: context.subjectZScores,
      selectedMode: req.body.mode || "auto"
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/respond-stream", async (req, res) => {
  try {
    const user = await requireUser(req);
    req.user = user;
    await aiRespondStream(req, res);
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
    res.status(500).json({ ok: false, error: error.message });
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
      content: text,
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
    const uidSnap = await db.collection("users").doc(user.uid).collection("chat_history").get().catch(() => ({ docs: [] }));
    uidSnap.docs.forEach((doc) => batch.delete(doc.ref));
    if (user.email) {
      const emailSnap = await db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").get().catch(() => ({ docs: [] }));
      emailSnap.docs.forEach((doc) => batch.delete(doc.ref));
    }
    await batch.commit();
    res.json({ ok: true });
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
function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try {
      return JSON.parse(fenced.trim());
    } catch {
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
    }
  }
  return null;
}
function normalizeQuizQuestion(question, index, subject, topic) {
  const options = Array.isArray(question.options) && question.options.length >= 2 ? question.options.map((option) => String(option)) : ["Correct", "Incorrect", "Needs revision", "Not enough data"];
  const answerText = String(question.answer ?? options[0]);
  let correctIndex = options.findIndex((option) => option.trim().toLowerCase() === answerText.trim().toLowerCase());
  if (typeof question.correctIndex === "number") correctIndex = question.correctIndex;
  if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
  return {
    type: question.type || "mcq",
    question: String(question.question || `${subject.toUpperCase()} ${topic} revision question ${index + 1}`),
    options,
    answer: options[correctIndex],
    correctIndex,
    explanation: String(question.explanation || "Review the referenced syllabus chunk and retry the question."),
    marks: Number(question.marks || 1),
    sourceRefs: Array.isArray(question.sourceRefs) ? question.sourceRefs : []
  };
}
function buildFallbackQuiz(subject, topic, chunks) {
  const seed = chunks.length ? chunks : [{ title: topic || subject, text: `${subject.toUpperCase()} ${topic || "syllabus"} revision` }];
  return seed.slice(0, 5).map((chunk, index) => normalizeQuizQuestion({
    question: `${chunk.subject?.toUpperCase() || subject.toUpperCase()} ${topic || chunk.topic || "lesson"}: which statement best matches the source?`,
    options: [
      String(chunk.title || chunk.topic || "This topic is included in the syllabus/source set."),
      "This topic is not related to A/L Technology.",
      "This topic should be ignored for revision.",
      "No source is available for this topic."
    ],
    answer: String(chunk.title || chunk.topic || "This topic is included in the syllabus/source set."),
    explanation: String(chunk.text || "").slice(0, 260) || "Generated from local syllabus/source metadata.",
    marks: 1,
    sourceRefs: [chunk.title].filter(Boolean)
  }, index, subject, topic));
}
aiRoutes.post("/quiz", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = String(req.body.subject || req.body.activeSubject || "sft").toLowerCase();
    const topic = String(req.body.topic || req.body.prompt || "revision").trim();
    if (!topic) {
      return res.status(400).json({ ok: false, error: "Topic is required" });
    }
    const { loadUserAIContext: loadUserAIContext2 } = await Promise.resolve().then(() => (init_userContext(), userContext_exports));
    const userContext = await loadUserAIContext2(user.uid, user.email);
    const chunks = await retrieveRelevantKnowledge({
      prompt: `${subject} ${topic} quiz`,
      activeSubject: subject,
      mode: "quiz_generation",
      uid: user.uid,
      email: user.email,
      userContext,
      limit: 8
    });
    let quizObject = null;
    const prompt = `Return only strict JSON for a Sinhala-first G.C.E. A/L Technology quiz. Schema: {"title":string,"subject":string,"topic":string,"questions":[{"type":"mcq","question":string,"options":string[],"answer":string,"explanation":string,"marks":number,"sourceRefs":string[]}]} Subject: ${subject}. Topic: ${topic}. Use these sources: ${JSON.stringify(chunks.slice(0, 6))}`;
    for (const model of getModelFallbackChain(AI_MODELS.default)) {
      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { temperature: 0.25, responseMimeType: "application/json" }
        });
        quizObject = extractJsonObject(response.text || "");
        if (quizObject?.questions?.length) break;
      } catch (e) {
        console.warn(`Quiz model ${model} failed:`, e);
      }
    }
    const questions = Array.isArray(quizObject?.questions) ? quizObject.questions.slice(0, 8).map((q, i) => normalizeQuizQuestion(q, i, subject, topic)) : buildFallbackQuiz(subject, topic, chunks);
    const normalized = {
      title: quizObject?.title || `${subject.toUpperCase()} ${topic} quiz`,
      subject,
      topic,
      questions
    };
    res.json({ ok: true, quizObject: normalized, quiz: questions, sources: chunks });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Quiz generation failed" });
  }
});
aiRoutes.get("/quota", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const [files, images] = await Promise.all([
      db.collection("users").doc(user.uid).collection("files").limit(200).get().catch(() => ({ docs: [] })),
      db.collection("users").doc(user.uid).collection("generated_images").limit(200).get().catch(() => ({ docs: [] }))
    ]);
    const usedBytes = [...files.docs, ...images.docs].reduce((sum, doc) => {
      const data = doc.data();
      return sum + Number(data.size || data.bytes || 0);
    }, 0);
    res.json({ ok: true, used: usedBytes, quota: Number(process.env.USER_STORAGE_QUOTA_BYTES || 250 * 1024 * 1024) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
aiRoutes.post("/lesson-optimizer", async (req, res) => {
  const send = (event, data) => res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  try {
    const user = await requireUser(req);
    req.user = user;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    send("status", { message: "Loading progress and weak lessons..." });
    const prompt = `${req.body.prompt || "Create the next best study plan."}

Use provided app data and actual weak lessons. Keep Sinhala-first. App data snapshot: ${JSON.stringify(req.body.data || {}).slice(0, 12e3)}`;
    const result = await processAIRequest({
      ...req,
      body: {
        prompt,
        activeSubject: req.body.activeSubject,
        explicitMode: "study_plan",
        history: req.body.history || []
      },
      user
    });
    if (result.ok) {
      send("chunk", { text: result.text || result.response });
      send("done", { ok: true });
    } else {
      send("error", { message: result.error || "Lesson optimizer failed" });
      send("done", { ok: false });
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/event-stream; charset=utf-8" });
    }
    send("error", { message: error.message || "Lesson optimizer failed" });
    send("done", { ok: false });
    res.end();
  }
});
aiRoutes.get("/past-papers/local/:subject/:year", async (req, res) => {
  const subject = String(req.params.subject || "").toLowerCase();
  const year = String(req.params.year || "");
  const paper = (pastPapersData.papers || []).find((item) => {
    const itemSubject = String(item.metadata?.subjectKey || "").toLowerCase();
    const itemYear = String(item.metadata?.exam || "").match(/\b(20\d{2}|19\d{2})\b/)?.[1];
    return itemSubject === subject && itemYear === year;
  });
  if (!paper) {
    return res.status(404).json({ ok: false, error: "No verified local paper found for the requested subject/year" });
  }
  res.json({ ok: true, paper });
});

// server/auth/routes.ts
var import_express2 = __toESM(require("express"), 1);
init_userRepository();
var import_auth2 = require("firebase-admin/auth");
init_admin();
var authRoutes = import_express2.default.Router();
var pendingCodes = /* @__PURE__ */ new Map();
function buildLocalSession(email, profile) {
  return {
    email: email.toLowerCase(),
    name: profile?.username || profile?.name || email.split("@")[0],
    picture: profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
    emailVerified: true,
    uid: `email_${Buffer.from(email.toLowerCase()).toString("base64url")}`
  };
}
authRoutes.post("/email-login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !email.includes("@") || !password) {
      return res.status(400).json({ error: "Valid email and password are required" });
    }
    const userData = readUser(email);
    if (!userData.profile) {
      userData.profile = {
        email,
        username: email.split("@")[0],
        picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
        bio: "A/L Technology learner",
        isVerified: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      writeUser(email, userData);
    }
    const user = buildLocalSession(email, userData.profile);
    res.json({ success: true, user, profile: userData.profile });
  } catch (error) {
    res.status(500).json({ error: error.message || "Email login failed" });
  }
});
authRoutes.post("/register-start", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    const code = String(Math.floor(1e5 + Math.random() * 9e5));
    const profile = {
      email,
      username: req.body.username || req.body.name || email.split("@")[0],
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      nic: req.body.nic || "",
      mobileNumber: req.body.mobileNumber || "",
      bday: req.body.bday || "",
      gender: req.body.gender || "",
      isVerified: process.env.NODE_ENV !== "production",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      bio: "Success-driven Technology Stream Learner"
    };
    pendingCodes.set(email, { code, profile, expiresAt: Date.now() + 10 * 60 * 1e3 });
    if (process.env.NODE_ENV !== "production") {
      const userData = readUser(email);
      userData.profile = profile;
      writeUser(email, userData);
      return res.json({ success: true, user: buildLocalSession(email, profile), profile, debugCode: code });
    }
    res.json({ success: true, requiresVerification: true, email });
  } catch (error) {
    res.status(500).json({ error: error.message || "Registration failed" });
  }
});
authRoutes.post("/verify-code", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const pending = pendingCodes.get(email);
    if (!pending || pending.expiresAt < Date.now()) {
      return res.status(400).json({ error: "Verification code expired" });
    }
    if (pending.code !== code && process.env.NODE_ENV === "production") {
      return res.status(400).json({ error: "Invalid verification code" });
    }
    const profile = { ...pending.profile, isVerified: true, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const userData = readUser(email);
    userData.profile = profile;
    writeUser(email, userData);
    pendingCodes.delete(email);
    res.json({ success: true, user: buildLocalSession(email, profile), profile });
  } catch (error) {
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});
authRoutes.post("/force-reset-password", async (req, res) => {
  try {
    await requireAdmin(req);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and new password are required" });
    }
    const userRecord = await (0, import_auth2.getAuth)().getUserByEmail(email);
    await (0, import_auth2.getAuth)().updateUser(userRecord.uid, { password });
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
    const decodedToken = await (0, import_auth2.getAuth)().verifyIdToken(idToken);
    const email = decodedToken.email;
    if (!email) {
      return res.status(400).json({ error: "Email missing from token" });
    }
    let userData = readUser(email);
    if (!userData.profile) {
      userData.profile = {
        email: email.toLowerCase(),
        username: profileData?.username || decodedToken.name || email.split("@")[0],
        picture: decodedToken.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
        nic: profileData?.nic || "",
        mobileNumber: profileData?.mobileNumber || "",
        bday: profileData?.bday || "",
        gender: profileData?.gender || "",
        isVerified: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        bio: "Success-driven Technology Stream Learner"
      };
      writeUser(email, userData);
    }
    const userSession = {
      email: userData.profile.email,
      name: userData.profile.username,
      picture: userData.profile.picture,
      emailVerified: true,
      uid: decodedToken.uid
    };
    res.json({ success: true, user: userSession, profile: userData.profile });
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired login" });
  }
});

// server.ts
init_client();
init_admin();
if (!(0, import_app.getApps)().length) {
  (0, import_app.initializeApp)({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "al-ai-chat",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET
  });
}
prepareGoogleCredentials();
var app = (0, import_express3.default)();
var PORT = Number(process.env.PORT || 3e3);
function cleanStoragePath(input) {
  const raw = String(input || `files/${Date.now()}_upload.bin`);
  return raw.replace(/\\/g, "/").split("/").filter(Boolean).map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "_")).join("/").slice(0, 240);
}
app.post("/api/upload-proxy", import_express3.default.raw({ type: "*/*", limit: "25mb" }), async (req, res) => {
  try {
    if (!req.headers.authorization && req.headers["x-firebase-auth"]) {
      req.headers.authorization = `Bearer ${req.headers["x-firebase-auth"]}`;
    }
    const user = await requireUser(req);
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (!body.length) {
      return res.status(400).json({ ok: false, error: "Upload body is empty" });
    }
    if (body.length > 25 * 1024 * 1024) {
      return res.status(413).json({ ok: false, error: "File is too large. Maximum size is 25MB." });
    }
    const contentType = String(req.headers["content-type"] || "application/octet-stream");
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "application/octet-stream"
    ];
    if (!allowed.some((type) => contentType.includes(type))) {
      return res.status(415).json({ ok: false, error: "Only PDF, image, or text uploads are allowed." });
    }
    const storagePath = cleanStoragePath(req.query.name);
    const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
    const bucket = bucketName ? (0, import_storage2.getStorage)().bucket(bucketName) : (0, import_storage2.getStorage)().bucket();
    const file = bucket.file(storagePath);
    await file.save(body, { metadata: { contentType } });
    let url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    try {
      await file.makePublic();
    } catch {
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1e3 * 60 * 60 * 24 * 30
      });
      url = signedUrl;
    }
    await getAdminDb().collection("users").doc(user.uid).collection("files").doc().set({
      path: storagePath,
      url,
      contentType,
      size: body.length,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }).catch(() => null);
    res.json({ ok: true, url, path: storagePath, size: body.length });
  } catch (error) {
    res.status(error.message?.startsWith("Unauthorized") ? 401 : 500).json({
      ok: false,
      error: error.message || "Upload failed"
    });
  }
});
app.use(import_express3.default.json({ limit: "50mb" }));
app.get("/api/notifications", (_req, res) => res.json({ notifications: [] }));
app.post("/api/notifications/trigger", (_req, res) => res.json({ success: true }));
app.post("/api/notifications/read", (_req, res) => res.json({ success: true }));
app.post("/api/notifications/delete", (_req, res) => res.json({ success: true }));
app.get("/api/profile", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const email = user.email?.toLowerCase();
    const [uidRoot, uidProfile, emailRoot, emailProfile] = await Promise.all([
      db.collection("users").doc(user.uid).get().catch(() => null),
      db.collection("users").doc(user.uid).collection("profile").doc("main").get().catch(() => null),
      email ? db.collection("users").doc(email).get().catch(() => null) : null,
      email ? db.collection("users").doc(email).collection("profile").doc("info").get().catch(() => null) : null
    ]);
    const profile = {
      ...emailRoot?.exists ? emailRoot.data() : {},
      ...emailProfile?.exists ? emailProfile.data() : {},
      ...uidRoot?.exists ? uidRoot.data() : {},
      ...uidProfile?.exists ? uidProfile.data() : {}
    };
    res.json({ ok: true, profile });
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
    batch.set(db.collection("users").doc(user.uid).collection("profile").doc("main"), profileData, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { email: user.email || profileData.email || null, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
    if (user.email) {
      batch.set(db.collection("users").doc(user.email.toLowerCase()).collection("profile").doc("info"), profileData, { merge: true });
    }
    await batch.commit();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get("/api/data", async (req, res) => {
  try {
    const user = await requireUser(req);
    const email = (req.query.email || user.email || "").toLowerCase();
    const db = getAdminDb();
    const [uidProgress, emailProgress, uidRoot, emailRoot] = await Promise.all([
      db.collection("users").doc(user.uid).collection("progress").doc("data").get().catch(() => null),
      email ? db.collection("users").doc(email).collection("progress").doc("data").get().catch(() => null) : null,
      db.collection("users").doc(user.uid).get().catch(() => null),
      email ? db.collection("users").doc(email).get().catch(() => null) : null
    ]);
    const uidProgressData = uidProgress?.exists ? uidProgress.data()?.data || uidProgress.data() : null;
    const emailProgressData = emailProgress?.exists ? emailProgress.data()?.data || emailProgress.data() : null;
    const appData = uidProgressData || emailProgressData || uidRoot?.data()?.appData || uidRoot?.data()?.data || emailRoot?.data()?.appData || emailRoot?.data()?.data || null;
    if (!uidProgressData && emailProgressData) {
      await db.collection("users").doc(user.uid).collection("progress").doc("data").set({
        data: emailProgressData,
        migratedFromEmail: email,
        migratedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true }).catch(() => null);
    }
    res.json({ ok: true, data: appData });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
});
app.post("/api/data", async (req, res) => {
  try {
    const user = await requireUser(req);
    const email = (req.body.email || user.email || "").toLowerCase();
    const db = getAdminDb();
    const payload = {
      email,
      data: req.body.data || {},
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const batch = db.batch();
    batch.set(db.collection("users").doc(user.uid).collection("progress").doc("data"), payload, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { appData: payload.data, email }, { merge: true });
    if (email) {
      batch.set(db.collection("users").doc(email).collection("progress").doc("data"), payload, { merge: true });
      batch.set(db.collection("users").doc(email), { appData: payload.data, migratedToUid: user.uid }, { merge: true });
    }
    await batch.commit();
    res.json({ success: true, ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
app.get("/api/cookies", async (req, res) => {
  try {
    const user = await requireUser(req);
    const snap = await getAdminDb().collection("users").doc(user.uid).collection("bypass").doc("config").get();
    res.json({ ok: true, cookies: snap.exists ? snap.data()?.cookies || "" : "" });
  } catch {
    res.json({ ok: true, cookies: "" });
  }
});
app.post("/api/cookies", async (req, res) => {
  try {
    const user = await requireUser(req);
    const cookies = String(req.body.cookies || "");
    await getAdminDb().collection("users").doc(user.uid).collection("bypass").doc("config").set({
      cookies,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
});
app.post("/api/send-email", async (req, res) => {
  try {
    await requireUser(req);
    const { to, subject, html, text } = req.body || {};
    if (!to || !subject || !html && !text) {
      return res.status(400).json({ ok: false, error: "to, subject, and html/text are required" });
    }
    if (!process.env.SEND_EMAIL_WEBHOOK_URL) {
      return res.status(501).json({
        ok: false,
        code: "EMAIL_NOT_CONFIGURED",
        error: "Email sending is not configured on this server."
      });
    }
    const response = await fetch(process.env.SEND_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, text })
    });
    res.status(response.ok ? 200 : 502).json({ ok: response.ok });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
});
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", aiRoutes);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
async function startServer() {
  const distPath = import_path3.default.join(process.cwd(), "dist");
  const serveBuiltClient = process.env.NODE_ENV === "production" || import_fs4.default.existsSync(import_path3.default.join(distPath, "index.html"));
  if (!serveBuiltClient) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(import_express3.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app,
  startServer
});
//# sourceMappingURL=server.cjs.map
