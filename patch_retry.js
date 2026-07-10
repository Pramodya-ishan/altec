import fs from 'fs';
let content = fs.readFileSync('server/utils/retry.ts', 'utf8');

const regex = /if \(\!retryable \|\| i === delays\.length\) break;/;

const newBlock = `if (msg.includes("Premature close") || msg.includes("Invalid response body while trying to fetch oauth2 token") || msg.includes("GOOGLE_AUTH_TOKEN_FETCH_FAILED") || msg.includes("UPLOAD_STORAGE_FAILED")) {
        console.warn(\`[Retry helper] Fast-failing \${name} due to known Admin Storage degradation: \`, msg);
        throw Object.assign(new Error("Admin Storage degraded"), {
           ok: false,
           code: "ADMIN_STORAGE_DEGRADED_USE_CLIENT_HANDOFF",
           recommendedMode: "client_firebase_storage",
           message: "Use client Firebase Storage handoff instead of backend Admin Storage download."
        });
      }
      if (!retryable || i === delays.length) break;`;

content = content.replace(regex, newBlock);

fs.writeFileSync('server/utils/retry.ts', content);
