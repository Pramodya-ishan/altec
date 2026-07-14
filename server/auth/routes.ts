import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb, requireAdmin } from '../firebase/admin';
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
      const normalizedEmail = email.toLowerCase();
      const fallbackProfile = {
        email: normalizedEmail,
        username: String(profileData?.username || decodedToken.name || email.split('@')[0]).slice(0, 120),
        picture: String(decodedToken.picture || profileData?.picture || '').slice(0, 1000),
        nic: String(profileData?.nic || '').slice(0, 40),
        mobileNumber: String(profileData?.mobileNumber || '').slice(0, 40),
        bday: String(profileData?.bday || '').slice(0, 40),
        gender: String(profileData?.gender || '').slice(0, 40),
        isVerified: decodedToken.email_verified === true,
        updatedAt: new Date().toISOString(),
        bio: String(profileData?.bio || '').slice(0, 500),
      };
      let profile = fallbackProfile;
      try {
        const db = getAdminDb();
        const [uidSnapshot, emailSnapshot] = await Promise.all([
          db.collection('users').doc(decodedToken.uid).get(),
          db.collection('users').doc(normalizedEmail).get(),
        ]);
        const existing = {
          ...(emailSnapshot.exists ? emailSnapshot.data() : {}),
          ...(uidSnapshot.exists ? uidSnapshot.data() : {}),
        } as Record<string, unknown>;
        const candidate = (existing.profile && typeof existing.profile === 'object' ? existing.profile : existing) as Record<string, unknown>;
        profile = {
          ...fallbackProfile,
          email: normalizedEmail,
          username: String(candidate.username || candidate.name || fallbackProfile.username).slice(0, 120),
          picture: String(candidate.picture || fallbackProfile.picture || '').slice(0, 1000),
          nic: String(candidate.nic || fallbackProfile.nic || '').slice(0, 40),
          mobileNumber: String(candidate.mobileNumber || fallbackProfile.mobileNumber || '').slice(0, 40),
          bday: String(candidate.bday || fallbackProfile.bday || '').slice(0, 40),
          gender: String(candidate.gender || fallbackProfile.gender || '').slice(0, 40),
          bio: String(candidate.bio || fallbackProfile.bio || '').slice(0, 500),
          isVerified: candidate.isVerified === true || fallbackProfile.isVerified,
        };
        const profileFields = {
          email: profile.email,
          username: profile.username,
          picture: profile.picture,
          nic: profile.nic || '',
          mobileNumber: profile.mobileNumber || '',
          bday: profile.bday || '',
          gender: profile.gender || '',
          isVerified: profile.isVerified === true,
          updatedAt: new Date().toISOString(),
          bio: profile.bio || '',
        };
        const batch = db.batch();
        batch.set(db.collection('users').doc(decodedToken.uid), profileFields, { merge: true });
        batch.set(db.collection('users').doc(normalizedEmail), profileFields, { merge: true });
        await batch.commit();
      } catch (profileError) {
        // Login is authenticated by verifyIdToken above. Profile persistence
        // is optional and must not turn a valid Google login into a 500/401.
        console.warn('[AUTH_SESSION] Profile sync skipped:', profileError);
      }
      const userSession = {
        email: normalizedEmail,
        name: profile.username,
        picture: profile.picture,
        emailVerified: decodedToken.email_verified === true,
        uid: decodedToken.uid
      };
      res.json({ success: true, user: userSession, profile });
    } catch (error: any) {
      res.status(401).json({ error: "Invalid or expired login" });
    }
});
