import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

const DB_DIR = process.env.VERCEL ? "/tmp/data_users" : path.join(process.cwd(), "data_users");
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || "al-tech-blueprint-development-secret";
// AES-256 requires exactly 32 bytes. Hashing avoids runtime crashes when the
// configured secret is shorter, longer, or contains multi-byte characters.
const ENCRYPTION_KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const SOURCE_DIR = path.join(process.cwd(), "data_users");
if (process.env.VERCEL && fs.existsSync(SOURCE_DIR)) {
  try {
    const files = fs.readdirSync(SOURCE_DIR);
    for (const file of files) {
      if (file.endsWith(".json.gz")) {
        const srcPath = path.join(SOURCE_DIR, file);
        const destPath = path.join(DB_DIR, file);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    console.log("Successfully seeded pre-existing user data on Vercel.");
  } catch (err) {
    console.error("Failed to seed pre-existing user data:", err);
  }
}

// REST API Configuration for serverless Firestore sync
let projectId = "al-ai-chat";
let databaseId = "ai-studio-c097068e-a4a9-4ea3-9b00-0b3195093c42";
let apiKey = "";

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    projectId = firebaseConfig.projectId || projectId;
    databaseId = firebaseConfig.firestoreDatabaseId || databaseId;
    apiKey = firebaseConfig.apiKey || "";
  }
} catch (e) {
  console.warn("Failed to load firebase-applet-config.json for REST client:", e);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function syncUserFromFirestore(email: string) {
  if (!email || !email.includes("@") || !apiKey) return;
  const cleanEmail = email.trim().toLowerCase();
  const file = getUserFile(cleanEmail);
  if (fs.existsSync(file)) return; // Already exists locally

  try {
    // We use the 'backups' collection, which has public read/write permission (encrypted data)
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/backups/${encodeURIComponent(cleanEmail)}?key=${apiKey}`;
    const res = await fetchWithTimeout(url);
    if (res.status === 200) {
      const data: any = await res.json();
      const userDataEncrypted = data?.fields?.userData?.stringValue;
      if (userDataEncrypted) {
        const zipped = zlib.gzipSync(userDataEncrypted);
        fs.writeFileSync(file, zipped);
        console.log(`Successfully restored user ${cleanEmail} from Firestore REST backup to local disk.`);
      }
    }
  } catch (err) {
    console.error(`Failed to restore user ${cleanEmail} from Firestore REST:`, err);
  }
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}

export function getUserFile(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const hash = crypto.createHash("md5").update(cleanEmail).digest("hex");
  return path.join(DB_DIR, `${hash}.json.gz`);
}

export function readUser(email: string) {
  const file = getUserFile(email);
  if (!fs.existsSync(file)) {
    return { data: null, history: [], cookies: null, profile: null, notifications: [] };
  }
  try {
    const raw = fs.readFileSync(file);
    const unzipped = zlib.gunzipSync(raw).toString("utf-8");
    let jsonStr = unzipped;
    if (!jsonStr.startsWith("{")) {
      jsonStr = decrypt(jsonStr);
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    return { data: null, history: [], cookies: null, profile: null, notifications: [] };
  }
}

export async function writeUser(email: string, userData: any) {
  const file = getUserFile(email);
  const jsonStr = JSON.stringify(userData);
  const encrypted = encrypt(jsonStr);
  const zipped = zlib.gzipSync(encrypted);
  fs.writeFileSync(file, zipped);

  // Background backup to Firestore REST API
  if (email && email.includes("@") && apiKey) {
    const cleanEmail = email.trim().toLowerCase();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/backups/${encodeURIComponent(cleanEmail)}?updateMask.fieldPaths=userData&updateMask.fieldPaths=updatedAt&key=${apiKey}`;
    const payload = {
      fields: {
        userData: { stringValue: encrypted },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    };
    
    try {
      const response = await fetchWithTimeout(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        console.error(`Failed to backup user data to Firestore REST API (${response.status}):`, details);
      }
    } catch (err) {
      console.error("Failed to backup user data to Firestore REST API:", err);
    }
  }
}
