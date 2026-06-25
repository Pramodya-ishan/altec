import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

const DB_DIR = process.env.VERCEL ? "/tmp/data_users" : path.join(process.cwd(), "data_users");
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || "al-tech-blueprint-development-secret";
// AES-256 always needs exactly 32 bytes. Hashing the configured secret prevents
// Vercel runtime crashes when ENCRYPTION_KEY is shorter or longer than 32 chars.
const ENCRYPTION_KEY = crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

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

export function writeUser(email: string, userData: any) {
  const file = getUserFile(email);
  const jsonStr = JSON.stringify(userData);
  const encrypted = encrypt(jsonStr);
  const zipped = zlib.gzipSync(encrypted);
  fs.writeFileSync(file, zipped);
}
