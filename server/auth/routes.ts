import express from 'express';
import { readUser, writeUser } from '../data/userRepository';
import { getAuth } from 'firebase-admin/auth';
import { requireAdmin } from '../firebase/admin';

export const authRoutes = express.Router();

const pendingCodes = new Map<string, { code: string; profile: any; expiresAt: number }>();

function buildLocalSession(email: string, profile: any) {
    return {
      email: email.toLowerCase(),
      name: profile?.username || profile?.name || email.split('@')[0],
      picture: profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      emailVerified: true,
      uid: `email_${Buffer.from(email.toLowerCase()).toString('base64url')}`
    };
}

authRoutes.post("/email-login", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      if (!email || !email.includes("@") || !password) {
        return res.status(400).json({ error: "Valid email and password are required" });
      }
      const userData = readUser(email);
      if (!userData.profile) {
        userData.profile = {
          email,
          username: email.split("@")[0],
          picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
          bio: "A/L Technology learner",
          isVerified: true,
          updatedAt: new Date().toISOString()
        };
        writeUser(email, userData);
      }
      const user = buildLocalSession(email, userData.profile);
      res.json({ success: true, user, profile: userData.profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Email login failed" });
    }
});

authRoutes.post("/register-start", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const profile = {
        email,
        username: req.body.username || req.body.name || email.split("@")[0],
        picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
        nic: req.body.nic || "",
        mobileNumber: req.body.mobileNumber || "",
        bday: req.body.bday || "",
        gender: req.body.gender || "",
        isVerified: process.env.NODE_ENV !== "production",
        updatedAt: new Date().toISOString(),
        bio: "Success-driven Technology Stream Learner"
      };
      pendingCodes.set(email, { code, profile, expiresAt: Date.now() + 10 * 60 * 1000 });

      if (process.env.NODE_ENV !== "production") {
        const userData = readUser(email);
        userData.profile = profile;
        writeUser(email, userData);
        return res.json({ success: true, user: buildLocalSession(email, profile), profile, debugCode: code });
      }

      res.json({ success: true, requiresVerification: true, email });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Registration failed" });
    }
});

authRoutes.post("/verify-code", async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const code = String(req.body.code || "").trim();
      const pending = pendingCodes.get(email);
      if (!pending || pending.expiresAt < Date.now()) {
        return res.status(400).json({ error: "Verification code expired" });
      }
      if (pending.code !== code && process.env.NODE_ENV === "production") {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      const profile = { ...pending.profile, isVerified: true, updatedAt: new Date().toISOString() };
      const userData = readUser(email);
      userData.profile = profile;
      writeUser(email, userData);
      pendingCodes.delete(email);
      res.json({ success: true, user: buildLocalSession(email, profile), profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Verification failed" });
    }
});

authRoutes.post("/force-reset-password", async (req, res) => {
    try {
      await requireAdmin(req); // Ensure caller is admin
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and new password are required" });
      }
      const userRecord = await getAuth().getUserByEmail(email);
      await getAuth().updateUser(userRecord.uid, { password });
      res.json({ success: true, message: "Password updated successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to update password" });
    }
});

authRoutes.post("/session", async (req, res) => {
    try {
      const { idToken, profileData } = req.body;
      if (!idToken) {
        return res.status(400).json({ error: "ID token is required" });
      }
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const email = decodedToken.email;
      if (!email) {
        return res.status(400).json({ error: "Email missing from token" });
      }
      let userData = readUser(email);
      if (!userData.profile) {
         userData.profile = {
           email: email.toLowerCase(),
           username: profileData?.username || decodedToken.name || email.split('@')[0],
           picture: decodedToken.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
           nic: profileData?.nic || "",
           mobileNumber: profileData?.mobileNumber || "",
           bday: profileData?.bday || "",
           gender: profileData?.gender || "",
           isVerified: true,
           updatedAt: new Date().toISOString(),
           bio: "Success-driven Technology Stream Learner"
         };
         writeUser(email, userData);
      }
      const userSession = {
        email: userData.profile.email,
        name: userData.profile.username,
        picture: userData.profile.picture,
        emailVerified: true,
        uid: decodedToken.uid
      };
      res.json({ success: true, user: userSession, profile: userData.profile });
    } catch (error: any) {
      res.status(401).json({ error: "Invalid or expired login" });
    }
});
