import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let isInitialized = false;

export function getFirebaseAdminAuth() {
  if (!isInitialized) {
    if (getApps().length === 0) {
      try {
        let projectId = 'al-ai-chat';
        try {
          const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(configPath)) {
            const configOptions = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (configOptions.projectId) {
              projectId = configOptions.projectId;
            }
          }
        } catch (e) {
          console.warn("Firebase applet config read warning:", e);
        }
        initializeApp({ projectId });
      } catch (err) {
        console.error('Firebase Admin lazy initialization error:', err);
      }
    }
    isInitialized = true;
  }
  return getAuth();
}
