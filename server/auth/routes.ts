import express from "express";
import { getAdminAuth, getAdminDb } from "../firebase/admin";
import { requireFirebaseUser } from "../firebase/authMiddleware";
import { requireRole } from "../utils/authGuards";
import { computeSourceCapabilities } from "../utils/authContext";

export const authRoutes = express.Router();

const SESSION_COOKIE_NAME = "__session";
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const COMMON_PASSWORDS = new Set([
  "password", "password123", "123456789", "qwerty123", "admin123",
  "letmein123", "welcome123", "srilanka123", "student123",
]);

function validatePassword(password: unknown, email: unknown) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return "Password must contain 12 to 128 characters.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, number, and symbol characters.";
  }
  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return "Choose a less common password.";
  const emailLocal = typeof email === "string" ? email.split("@")[0].toLowerCase() : "";
  if (emailLocal.length >= 4 && normalized.includes(emailLocal)) {
    return "Password must not contain the email username.";
  }
  return null;
}

function sessionCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    maxAge: SESSION_DURATION_MS,
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
  };
}

authRoutes.get("/context", requireFirebaseUser, async (req: any, res, next) => {
  try {
    const authContext = req.authContext;
    const user = req.user;
    if (!authContext) {
      return res.status(401).json({ ok: false, code: "LOGIN_REQUIRED", message: "Authentication is required." });
    }
    const capabilities = computeSourceCapabilities(authContext, {});
    const canManageLessonResources = authContext.roles.some((role: string) =>
      ["admin", "content_editor", "teacher", "ops"].includes(role),
    );
    res.json({
      ok: true,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        isAnonymous: user.isAnonymous,
      },
      roles: authContext.roles,
      capabilities: {
        ...capabilities,
        canUploadVideo: canManageLessonResources,
        canManageLessonResources,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/force-reset-password", requireRole("admin"), express.json({ limit: "16kb" }), async (req: any, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "A valid email is required." });
    }
    const policyError = validatePassword(password, email);
    if (policyError) {
      return res.status(400).json({ ok: false, code: "WEAK_PASSWORD", message: policyError });
    }
    const auth = getAdminAuth();
    const userRecord = await auth.getUserByEmail(email.trim().toLowerCase());
    await auth.updateUser(userRecord.uid, { password });
    await auth.revokeRefreshTokens(userRecord.uid);
    res.json({ ok: true, success: true, message: "Password updated and existing sessions revoked." });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/session", express.json({ limit: "32kb" }), async (req, res, next) => {
  try {
    const { idToken, profileData } = req.body || {};
    if (typeof idToken !== "string" || idToken.split(".").length !== 3) {
      return res.status(400).json({ ok: false, code: "INVALID_ID_TOKEN", message: "A valid Firebase ID token is required." });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!decoded.email || decoded.firebase?.sign_in_provider === "anonymous") {
      return res.status(401).json({ ok: false, code: "AUTHENTICATED_USER_REQUIRED", message: "A verified account is required." });
    }

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
    res.cookie(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions());

    const db = getAdminDb();
    const profileRef = db.collection("users").doc(decoded.uid).collection("profile").doc("main");
    const profileSnap = await profileRef.get();
    const existing = profileSnap.exists ? profileSnap.data() || {} : {};
    const profile = {
      email: decoded.email.toLowerCase(),
      username: existing.username || profileData?.username || decoded.name || decoded.email.split("@")[0],
      picture: existing.picture || decoded.picture || "",
      bio: existing.bio || "",
      nic: existing.nic || profileData?.nic || "",
      mobileNumber: existing.mobileNumber || profileData?.mobileNumber || "",
      bday: existing.bday || profileData?.bday || "",
      gender: existing.gender || profileData?.gender || "",
      isVerified: decoded.email_verified === true,
      updatedAt: new Date().toISOString(),
    };
    await profileRef.set(profile, { merge: true });
    await db.collection("users").doc(decoded.uid).set({
      email: decoded.email.toLowerCase(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({
      ok: true,
      success: true,
      user: {
        uid: decoded.uid,
        email: decoded.email.toLowerCase(),
        name: profile.username,
        picture: profile.picture,
        emailVerified: decoded.email_verified === true,
      },
      profile,
    });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  res.json({ ok: true });
});
