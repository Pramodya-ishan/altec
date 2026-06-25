import express from "express";
import { readUser, writeUser } from "../data/userRepository";
export const authRoutes = express.Router();
authRoutes.post("/email-login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const userData = readUser(email);
    if (!userData.profile) {
      return res.status(404).json({
        error: "No account found with this email. Please sign up to create a new profile."
      });
    }
    const savedProfile = userData.profile;
    if (!savedProfile.password) {
      return res.status(400).json({
        error: "This account was registered via Google. To set a password, please use the Register tab to configure a credential."
      });
    }
    const decryptedPassword = decrypt(savedProfile.password);
    if (decryptedPassword !== password) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }
    if (savedProfile.isVerified === false) {
      const code = Math.floor(1e5 + Math.random() * 9e5).toString();
      savedProfile.verificationCode = code;
      writeUser(email, userData);
      return res.json({
        requiresVerification: true,
        email: savedProfile.email,
        debugCode: code,
        message: "Please verify your email address before logging in."
      });
    }
    const userSession = {
      email: savedProfile.email,
      name: savedProfile.username,
      picture: savedProfile.picture,
      emailVerified: true
    };
    res.json({ success: true, user: userSession, profile: savedProfile });
  } catch (e) {
    res.status(500).json({ error: "Authentication system error: " + e.message });
  }
});
authRoutes.post("/register-start", (req, res) => {
  try {
    const { email, password, username, nic, mobileNumber, bday, gender } = req.body;
    if (!email || !password || !username) {
      return res.status(400).json({ error: "Email, password, and username are required." });
    }
    const userData = readUser(email);
    const newProfile = {
      email: email.trim().toLowerCase(),
      username: username.trim(),
      password: encrypt(password),
      nic: nic || "",
      mobileNumber: mobileNumber || "",
      bday: bday || "",
      gender: gender || "",
      bio: userData.profile?.bio || "Success-driven Technology Stream Learner",
      picture: userData.profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      isVerified: true,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    userData.profile = newProfile;
    writeUser(email, userData);
    const userSession = {
      email: newProfile.email,
      name: newProfile.username,
      picture: newProfile.picture,
      emailVerified: true
    };
    res.json({
      success: true,
      message: "\u0DBD\u0DD2\u0DBA\u0DCF\u0DB4\u0DAF\u0DD2\u0D82\u0DA0\u0DD2\u0DBA \u0DC3\u0DCF\u0DBB\u0DCA\u0DAE\u0D9A\u0DBA\u0DD2! (Registration successful!)",
      user: userSession,
      profile: newProfile
    });
  } catch (e) {
    res.status(500).json({ error: "Registration failed: " + e.message });
  }
});
authRoutes.post("/verify-code", (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const userData = readUser(email);
    if (!userData.profile) {
      return res.status(404).json({ error: "Account not found." });
    }
    if (userData.profile.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code. Please try again." });
    }
    userData.profile.isVerified = true;
    delete userData.profile.verificationCode;
    writeUser(email, userData);
    const userSession = {
      email: userData.profile.email,
      name: userData.profile.username,
      picture: userData.profile.picture,
      emailVerified: true
    };
    res.json({ success: true, user: userSession, profile: userData.profile });
  } catch (e) {
    res.status(500).json({ error: "Verification failed: " + e.message });
  }
});
