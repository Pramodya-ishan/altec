import { Request, Response, NextFunction } from "express";
import { getAdminAuth, getAdminDb } from "./admin";
import { AuthContext, AppRole } from "../utils/authContext";
import { applyConfiguredAdminRoles } from "../utils/configuredRoles";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous: boolean;
    name?: string;
    admin?: boolean;
    roles?: string[];
  };
  authContext?: AuthContext;
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return "";
}

function getAuthErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "UNKNOWN_AUTH_ERROR";
  const candidate = error as { code?: unknown; errorInfo?: { code?: unknown } };
  return String(candidate.code || candidate.errorInfo?.code || "UNKNOWN_AUTH_ERROR");
}

function isInvalidCredentialError(code: string) {
  return [
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/session-cookie-expired",
    "auth/session-cookie-revoked",
    "auth/invalid-session-cookie",
    "auth/user-disabled",
  ].includes(code);
}

function authServiceUnavailable(error: unknown) {
  const wrapped = new Error("Firebase authentication verification is temporarily unavailable.");
  (wrapped as any).code = "AUTH_SERVICE_UNAVAILABLE";
  (wrapped as any).status = 503;
  (wrapped as any).cause = error;
  return wrapped;
}

async function decodeFirebaseCredential(token: string, sessionCookie: string) {
  const auth = getAdminAuth();
  let bearerError: unknown = null;

  if (token) {
    try {
      // Normal API authentication only needs cryptographic token validation.
      // checkRevoked=true performs an additional privileged Identity Toolkit
      // lookup and caused every request to fail when the service account lacked
      // that optional permission. Sensitive account operations still revoke
      // refresh tokens explicitly where required.
      return await auth.verifyIdToken(token, false);
    } catch (error) {
      bearerError = error;
      const code = getAuthErrorCode(error);
      if (!isInvalidCredentialError(code)) {
        throw authServiceUnavailable(error);
      }
    }
  }

  if (sessionCookie) {
    try {
      return await auth.verifySessionCookie(sessionCookie, false);
    } catch (error) {
      const code = getAuthErrorCode(error);
      if (!isInvalidCredentialError(code)) {
        throw authServiceUnavailable(error);
      }
    }
  }

  if (bearerError && process.env.NODE_ENV !== "production") {
    console.warn("Firebase credential was rejected", { code: getAuthErrorCode(bearerError) });
  }
  return null;
}

export async function verifyAndExtractUser(req: Request): Promise<any> {
  if (req.query && (req.query.token || req.query.auth || req.query.access_token)) {
    const err = new Error("Authentication tokens must be sent in the Authorization header.");
    (err as any).code = "QUERY_TOKEN_NOT_ALLOWED";
    throw err;
  }

  const authHeader = req.headers.authorization;
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    const devUser = {
      uid: "dev-user-id",
      email: "dev@example.com",
      emailVerified: true,
      isAnonymous: false,
      name: "Dev User",
      admin: true,
      roles: ["admin"],
    };
    const authContext: AuthContext = {
      uid: devUser.uid,
      email: devUser.email,
      roles: ["admin"],
      isAnonymous: false,
    };
    return { ...devUser, authContext };
  }

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  }
  const sessionCookie = readCookie(req, "__session");

  if (!token && !sessionCookie) return null;

  const decodedToken = await decodeFirebaseCredential(token, sessionCookie);
  if (!decodedToken) return null;

  const isAnonymous = decodedToken.firebase?.sign_in_provider === "anonymous";
  let admin = decodedToken.admin || false;
  let roles: string[] = ["student"];
  if (admin) roles.push("admin", "reviewer", "ops");
  if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
    roles = [...new Set([...roles, ...decodedToken.roles.map(String)])];
  }
  if (decodedToken.role && typeof decodedToken.role === "string") roles.push(decodedToken.role);

  // Role metadata is supplemental. A temporary Firestore problem must never
  // invalidate an otherwise valid Firebase identity token.
  try {
    const db = getAdminDb();
    const roleDoc = await db.collection("user_roles").doc(decodedToken.uid).get();
    if (roleDoc.exists) {
      const data = roleDoc.data();
      if (data?.roles && Array.isArray(data.roles)) {
        roles = [...new Set([...roles, ...data.roles.map(String)])];
      }
      if (data?.role && typeof data.role === "string") roles.push(data.role);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Role metadata lookup skipped", { code: getAuthErrorCode(error) });
    }
  }

  roles = applyConfiguredAdminRoles(decodedToken.email, decodedToken.email_verified === true, roles);
  if (roles.includes("admin")) admin = true;

  const rolesTyped = [...new Set(roles)]
    .filter((role) => ["student", "teacher", "content_editor", "reviewer", "ops", "admin"].includes(role)) as AppRole[];
  const authContext: AuthContext = {
    uid: decodedToken.uid,
    email: decodedToken.email,
    roles: rolesTyped.length > 0 ? rolesTyped : ["student"],
    isAnonymous,
    classIds: Array.isArray((decodedToken as any).classIds) ? (decodedToken as any).classIds.map(String) : [],
    institutionIds: Array.isArray((decodedToken as any).institutionIds) ? (decodedToken as any).institutionIds.map(String) : [],
    tokenIssuedAt: decodedToken.iat,
    authTime: decodedToken.auth_time,
  };

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified || false,
    isAnonymous,
    name: decodedToken.name || decodedToken.email?.split("@")[0] || "User",
    admin,
    roles: [...new Set(roles)],
    authContext,
  };
}

function sendAuthFailure(res: Response, error: any, anonymousNotAllowed = false) {
  if (error?.code === "QUERY_TOKEN_NOT_ALLOWED") {
    return res.status(400).json({
      ok: false,
      code: "QUERY_TOKEN_NOT_ALLOWED",
      message: "The operation failed. Please try again.",
    });
  }
  if (error?.code === "AUTH_SERVICE_UNAVAILABLE") {
    return res.status(503).json({
      ok: false,
      code: "AUTH_SERVICE_UNAVAILABLE",
      message: "Authentication is temporarily unavailable. The app will retry automatically.",
      retryable: true,
    });
  }
  return res.status(401).json({
    ok: false,
    code: anonymousNotAllowed ? "AUTHENTICATED_USER_REQUIRED" : "LOGIN_REQUIRED",
    message: anonymousNotAllowed
      ? "මෙම ක්‍රියාව සිදු කිරීම සඳහා කරුණාකර ඔබගේ ගිණුමට ලොග් වන්න. (Sign-in required)"
      : "This operation requires a logged-in session.",
  });
}

export async function requireFirebaseUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await verifyAndExtractUser(req);
    if (!user) return sendAuthFailure(res, null);
    req.user = user;
    req.authContext = user.authContext;
    next();
  } catch (error: any) {
    return sendAuthFailure(res, error);
  }
}

export async function optionalFirebaseUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await verifyAndExtractUser(req);
    if (user) {
      req.user = user;
      req.authContext = user.authContext;
    }
    next();
  } catch (error: any) {
    if (error?.code === "QUERY_TOKEN_NOT_ALLOWED") return sendAuthFailure(res, error);
    // Optional authentication must not turn a public endpoint into a failure
    // when the auth provider is temporarily unavailable.
    next();
  }
}

export async function requireNonAnonymousUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await verifyAndExtractUser(req);
    if (!user || user.isAnonymous) return sendAuthFailure(res, null, true);
    req.user = user;
    req.authContext = user.authContext;
    next();
  } catch (error: any) {
    return sendAuthFailure(res, error, true);
  }
}
