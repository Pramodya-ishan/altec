import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [apiClient, authMiddleware, authRoutes, appContext] = await Promise.all([
  readFile("src/lib/api.ts", "utf8"),
  readFile("server/firebase/authMiddleware.ts", "utf8"),
  readFile("server/auth/routes.ts", "utf8"),
  readFile("src/context/AppContext.tsx", "utf8"),
]);

assert.match(apiClient, /credentials:\s*options\.credentials\s*\|\|\s*['"]include['"]/);
assert.match(apiClient, /getAuthToken\(true\)/);
assert.match(apiClient, /authRecoveryPromise/);
assert.match(apiClient, /establishOptionalServerSession/);
assert.match(apiClient, /AUTH_RECOVERY_CODES/);

assert.match(authMiddleware, /verifyIdToken\(token, false\)/);
assert.match(authMiddleware, /verifySessionCookie\(sessionCookie, false\)/);
assert.doesNotMatch(authMiddleware, /verifyIdToken\(token, true\)/);
assert.match(authMiddleware, /AUTH_SERVICE_UNAVAILABLE/);

assert.match(authRoutes, /verifyIdToken\(idToken, false\)/);
assert.match(authRoutes, /Cookie creation skipped; bearer authentication remains active/);
assert.match(authRoutes, /sessionCreated/);
assert.match(authRoutes, /profileSynced/);
assert.doesNotMatch(authRoutes, /verifyIdToken\(idToken, true\)/);

assert.match(appContext, /sessionBootstrap/);
assert.match(appContext, /Promise\.allSettled\(\[/);
assert.match(appContext, /status === 401 \|\| status === 403/);
assert.match(appContext, /lastSuccessfulLoadAtRef/);

console.log("Firebase auth recovery regression tests passed");
