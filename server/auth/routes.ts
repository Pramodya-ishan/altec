import express from 'express';
import { readUser, writeUser } from '../data/userRepository';
import { getAuth } from 'firebase-admin/auth';
import { requireAdmin } from '../firebase/admin';
import { requireFirebaseUser } from '../firebase/authMiddleware';
import { computeSourceCapabilities } from '../utils/authContext';

export const authRoutes = express.Router();

authRoutes.get("/context", requireFirebaseUser, async (req: any, res) => {
    try {
      const authContext = req.authContext;
      const user = req.user;
      if (!authContext) {
        return res.status(401).json({ ok: false, error: "AuthContext not available" });
      }
      const capabilities = computeSourceCapabilities(authContext, {});
      const canUploadVideo = authContext.roles.some((role: string) => ["admin", "content_editor", "ops"].includes(role));
      res.json({
        ok: true,
        user: {
          uid: user.uid,
          email: user.email,
          name: user.name,
          isAnonymous: user.isAnonymous
        },
        roles: authContext.roles,
        capabilities: { ...capabilities, canUploadVideo }
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
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
           picture: decodedToken.picture || "",
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
