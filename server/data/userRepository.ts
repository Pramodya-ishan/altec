import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV || process.env.VERCEL_URL;
const DB_DIR = isVercel ? "/tmp/data_users" : path.join(process.cwd(), "data_users");
let rawKey = process.env.ENCRYPTION_KEY || "default_encryption_key_32_chars!";
if (rawKey.length > 32) rawKey = rawKey.substring(0, 32);
if (rawKey.length < 32) rawKey = rawKey.padEnd(32, '0');
const ENCRYPTION_KEY = rawKey;

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const SOURCE_DIR = path.join(process.cwd(), "data_users");
if (isVercel && fs.existsSync(SOURCE_DIR)) {
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

export async function syncUserFromFirestore(email: string) {
  if (!email || !email.includes("@") || !apiKey) return;
  const cleanEmail = email.trim().toLowerCase();
  const file = getUserFile(cleanEmail);
  if (fs.existsSync(file)) return; // Already exists locally

  try {
    // We use the 'backups' collection, which has public read/write permission (encrypted data)
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/backups/${encodeURIComponent(cleanEmail)}?key=${apiKey}`;
    const res = await fetch(url);
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
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string) {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
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

export function writeUser(email: string, userData: any) {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
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
    
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.error("Failed to backup user data to Firestore REST API:", err);
    });
  }
}
