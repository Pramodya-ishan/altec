import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let isInitialized = false;

export function getFirebaseAdminAuth() {
  if (!isInitialized) {
    if (getApps().length === 0) {
      try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (projectId && clientEmail && privateKey) {
          privateKey = privateKey.replace(/\\n/g, "\n");
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
          console.log("Firebase Admin initialized via Environment Variables.");
        } else {
          // Fallback to minimal initialization or JSON file
          let localProjectId = 'al-ai-chat';
          try {
            const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
            if (fs.existsSync(configPath)) {
              const configOptions = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              if (configOptions.projectId) {
                localProjectId = configOptions.projectId;
              }
            }
          } catch (e) {
            console.warn("Firebase applet config read warning:", e);
          }
          initializeApp({ projectId: localProjectId });
          console.log("Firebase Admin initialized with local config/fallback.");
        }
      } catch (err) {
        console.error('Firebase Admin lazy initialization error:', err);
      }
    }
    isInitialized = true;
  }
  return getAuth();
}
