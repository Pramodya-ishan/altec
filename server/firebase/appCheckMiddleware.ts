import type { NextFunction, Request, Response } from "express";
import { getAppCheck } from "firebase-admin/app-check";
import { getAdminApp } from "./admin";
import { env } from "../utils/env";

function appCheckRequired() {
  return env.FIREBASE_APP_CHECK_REQUIRED;
}

export async function requireFirebaseAppCheck(req: Request, res: Response, next: NextFunction) {
  if (!appCheckRequired() || (req as any).appCheckVerified === true) return next();

  const token = String(req.header("X-Firebase-AppCheck") || "").trim();
  if (!token) {
    return res.status(401).json({
      ok: false,
      code: "APP_CHECK_REQUIRED",
      message: "The application verification token is missing. Refresh the page and try again.",
    });
  }

  try {
    const app = getAdminApp();
    if (!app) {
      return res.status(503).json({
        ok: false,
        code: "APP_CHECK_UNAVAILABLE",
        message: "Application verification is temporarily unavailable.",
      });
    }
    await getAppCheck(app).verifyToken(token);
    (req as any).appCheckVerified = true;
    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      code: "APP_CHECK_INVALID",
      message: "Application verification failed. Refresh the page and try again.",
    });
  }
}
