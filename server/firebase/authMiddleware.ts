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

export async function verifyAndExtractUser(req: Request): Promise<any> {
  if (req.query && (req.query.token || req.query.auth || req.query.access_token)) {
    const err = new Error("Authentication tokens must be sent in the Authorization header.");
    (err as any).code = "QUERY_TOKEN_NOT_ALLOWED";
    throw err;
  }

  const authHeader = req.headers.authorization;
  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    const devUser = {
      uid: "dev-user-id",
      email: "dev@example.com",
      emailVerified: true,
      isAnonymous: false,
      name: "Dev User",
      admin: true,
      roles: ["admin"]
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
    token = authHeader.split("Bearer ")[1];
  }

  if (!token) {
    return null;
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const isAnonymous = decodedToken.firebase?.sign_in_provider === "anonymous";
    let admin = decodedToken.admin || false;
    let roles: string[] = ["student"];
    if (admin) {
      roles.push("admin", "reviewer", "ops");
    }
    if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
      roles = [...new Set([...roles, ...decodedToken.roles])];
    }
    if (decodedToken.role && typeof decodedToken.role === "string") {
      roles.push(decodedToken.role);
    }

    // Check Firestore user_roles collection
    try {
      const db = getAdminDb();
      const roleDoc = await db.collection("user_roles").doc(decodedToken.uid).get();
      if (roleDoc.exists) {
        const data = roleDoc.data();
        if (data?.roles && Array.isArray(data.roles)) {
          roles = [...new Set([...roles, ...data.roles])];
        }
        if (data?.role && typeof data.role === "string") {
          roles.push(data.role);
        }
      }
    } catch (e) {
      // safe fallback
    }

    roles = applyConfiguredAdminRoles(
      decodedToken.email,
      decodedToken.email_verified === true,
      roles,
    );

    if (roles.includes("admin")) {
      admin = true;
    }

    const rolesTyped = roles.filter(r => ["student", "teacher", "content_editor", "reviewer", "ops", "admin"].includes(r)) as AppRole[];
    const authContext: AuthContext = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      roles: rolesTyped.length > 0 ? rolesTyped : ["student"],
      isAnonymous,
      tokenIssuedAt: decodedToken.iat,
      authTime: decodedToken.auth_time
    };

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      isAnonymous,
      name: decodedToken.name || decodedToken.email?.split("@")[0] || "User",
      admin,
      roles: [...new Set(roles)],
      authContext
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

export async function requireFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await verifyAndExtractUser(req);
    if (!user) {
      return res.status(401).json({
        ok: false,
        code: "LOGIN_REQUIRED",
        message: "This operation requires a logged-in session."
      });
    }
    req.user = user;
    req.authContext = user.authContext;
    next();
  } catch (err: any) {
    if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
      return res.status(400).json({
        ok: false,
        code: "QUERY_TOKEN_NOT_ALLOWED",
        message: err.message
      });
    }
    res.status(401).json({ ok: false, error: err.message });
  }
}

export async function optionalFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await verifyAndExtractUser(req);
    if (user) {
      req.user = user;
      req.authContext = user.authContext;
    }
    next();
  } catch (err: any) {
    if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
      return res.status(400).json({
        ok: false,
        code: "QUERY_TOKEN_NOT_ALLOWED",
        message: err.message
      });
    }
    next();
  }
}

export async function requireNonAnonymousUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await verifyAndExtractUser(req);
    if (!user || user.isAnonymous) {
      return res.status(401).json({
        ok: false,
        code: "AUTHENTICATED_USER_REQUIRED",
        message: "මෙම ක්‍රියාව සිදු කිරීම සඳහා කරුණාකර ඔබගේ ගිණුමට ලොග් වන්න. (Sign-in required)"
      });
    }
    req.user = user;
    req.authContext = user.authContext;
    next();
  } catch (err: any) {
    if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
      return res.status(400).json({
        ok: false,
        code: "QUERY_TOKEN_NOT_ALLOWED",
        message: err.message
      });
    }
    res.status(401).json({ ok: false, error: err.message });
  }
}
