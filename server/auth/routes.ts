import express from 'express';
import { requireAdmin, getAdminAuth } from '../firebase/admin';
import { requireFirebaseUser } from '../firebase/authMiddleware';
import { computeSourceCapabilities } from '../utils/authContext';
import { applyConfiguredAdminRoles } from '../utils/configuredRoles';

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
      const userRecord = await getAdminAuth().getUserByEmail(email);
      await getAdminAuth().updateUser(userRecord.uid, { password });
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
      const decodedToken = await getAdminAuth().verifyIdToken(idToken);
      const email = decodedToken.email;
      if (!email) {
        return res.status(400).json({ error: "Email missing from token" });
      }
      const configuredRoles = applyConfiguredAdminRoles(
        email,
        decodedToken.email_verified === true,
        Array.isArray(decodedToken.roles) ? decodedToken.roles : [],
        decodedToken.uid,
      );
      let claimsUpdated = false;
      if (configuredRoles.includes("admin")) {
        try {
          const auth = getAdminAuth();
          const record = await auth.getUser(decodedToken.uid);
          const currentClaims = record.customClaims || {};
          const nextRoles = [...new Set([...(Array.isArray(currentClaims.roles) ? currentClaims.roles : []), ...configuredRoles])];
          if (currentClaims.admin !== true || JSON.stringify(currentClaims.roles || []) !== JSON.stringify(nextRoles)) {
            await auth.setCustomUserClaims(decodedToken.uid, {
              ...currentClaims,
              admin: true,
              role: "admin",
              roles: nextRoles,
            });
            claimsUpdated = true;
          }
        } catch (claimError: any) {
          // Server routes still resolve configured roles by UID. Claim sync is
          // best-effort and only needed for direct client Firestore access.
          console.warn("[AUTH] Admin custom-claim sync skipped:", String(claimError?.message || claimError));
        }
      }
      // Vercel Functions have an ephemeral/read-only application filesystem.
      // Authentication must never depend on writing a local JSON user store.
      const profile = {
        email: email.toLowerCase(),
        username: profileData?.username || decodedToken.name || email.split('@')[0],
        picture: decodedToken.picture || profileData?.picture || "",
        nic: profileData?.nic || "",
        mobileNumber: profileData?.mobileNumber || "",
        bday: profileData?.bday || "",
        gender: profileData?.gender || "",
        isVerified: decodedToken.email_verified === true,
        updatedAt: new Date().toISOString(),
        bio: profileData?.bio || "Technology Stream Learner"
      };
      const userSession = {
        email: profile.email,
        name: profile.username,
        picture: profile.picture,
        emailVerified: decodedToken.email_verified === true,
        uid: decodedToken.uid
      };
      res.json({ success: true, user: userSession, profile, claimsUpdated });
    } catch (error: any) {
      res.status(401).json({ error: "Invalid or expired login" });
    }
});
