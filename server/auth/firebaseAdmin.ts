import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import {
  getGoogleServiceAccountFromEnvironment,
  toFirebaseAdminServiceAccount,
} from '../utils/googleCredentials';

let isInitialized = false;

export function getFirebaseAdminAuth() {
  if (!isInitialized) {
    if (getApps().length === 0) {
      try {
        const serviceAccount = getGoogleServiceAccountFromEnvironment();

        if (serviceAccount) {
          initializeApp({
            credential: cert(toFirebaseAdminServiceAccount(serviceAccount))
          });
          console.log("Firebase Admin initialized via validated service-account credentials.");
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
