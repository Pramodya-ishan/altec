import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let dbInstance: any = null;

export function getAdminDb() {
  if (dbInstance) return dbInstance;

  let databaseId = process.env.FIRESTORE_DATABASE_ID;

  if (!databaseId) {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        databaseId = config.firestoreDatabaseId;
      }
    } catch (e) {
      console.warn("Failed to load firestoreDatabaseId from firebase-applet-config.json:", e);
    }
  }

  if (!databaseId) {
    // Fall back to the known custom database ID for this applet
    databaseId = "ai-studio-c097068e-a4a9-4ea3-9b00-0b3195093c42";
    console.info(`INFO: FIRESTORE_DATABASE_ID falling back to "${databaseId}".`);
  }

  try {
    dbInstance = getFirestore(undefined as any, databaseId);
  } catch (err: any) {
    console.error("Failed to initialize getFirestore with databaseId:", databaseId, err);
    // Safe fallback to default
    dbInstance = getFirestore();
  }

  return dbInstance;
}

export async function verifyFirebaseToken(authHeader: string | undefined) {
  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return { uid: 'dev-user-id', email: 'dev@example.com', name: 'Dev User' };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      admin: decodedToken.admin || false
    };
  } catch (error) {
    throw new Error('Unauthorized: Invalid token');
  }
}

export async function requireUser(req: any) {
  return await verifyFirebaseToken(req.headers.authorization);
}

export async function requireAdmin(req: any) {
  const user = await requireUser(req);
  if (!user.admin && process.env.DEV_BYPASS_AUTH !== 'true') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}
