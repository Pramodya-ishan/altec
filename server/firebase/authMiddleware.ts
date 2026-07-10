import { Request, Response, NextFunction } from "express";
import { getAdminAuth } from "./admin";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous: boolean;
    name?: string;
  };
}

export async function verifyAndExtractUser(req: Request): Promise<any> {
  const authHeader = req.headers.authorization;
  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return {
      uid: "dev-user-id",
      email: "dev@example.com",
      emailVerified: true,
      isAnonymous: false,
      name: "Dev User"
    };
  }

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1];
  } else if (req.query && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return null;
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const isAnonymous = decodedToken.firebase?.sign_in_provider === "anonymous";
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      isAnonymous,
      name: decodedToken.name || decodedToken.email?.split("@")[0] || "User"
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
    next();
  } catch (err: any) {
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
    }
    next();
  } catch (err) {
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
    next();
  } catch (err: any) {
    res.status(401).json({ ok: false, error: err.message });
  }
}
