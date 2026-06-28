import "dotenv/config";
import express from "express";
import crypto from "crypto";
// Dynamically import ytdl and play-dl only when needed to prevent Vercel initialization crashes

import { readUser, writeUser, syncUserFromFirestore } from "./data/userRepository";
import { aiRoutes } from "./ai/routes";
import { authRoutes } from "./auth/routes";
import { RPM_LIMIT, RPD_LIMIT, requestCountPM, requestCountPD } from "./ai/queue";

// Migrate old data


function createApp() {
  const app = express();

  if (process.env.DEBUG_API === "true" || process.env.NODE_ENV !== "production") {
    app.use((req, _res, next) => {
      console.log("API Request:", req.method, req.url, req.originalUrl);
      next();
    });
  }

  const sendDbError = (res: express.Response, operation: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Database operation failed: ${operation}`, error);
    res.status(500).json({
      error: "DB Error",
      operation,
      message: process.env.NODE_ENV === "production" ? undefined : message,
    });
  };

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Middleware to auto-sync user data from Firestore before any API requests containing email are processed
  app.use(async (req, res, next) => {
    try {
      const email = (req.query.email || req.body?.email || "") as string;
      if (email && email.trim().includes("@")) {
        await syncUserFromFirestore(email);
      }
    } catch (err) {
      console.error("Error in syncUserFromFirestore middleware:", err);
    }
    next();
  });

  app.use('/api', aiRoutes);
  app.use('/api/auth', authRoutes);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/quota", (req, res) => {
    try {
      res.json({
        rpmUsed: requestCountPM,
        rpmLimit: RPM_LIMIT,
        rpdUsed: requestCountPD,
        rpdLimit: RPD_LIMIT,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/send-email", async (req, res) => {
    try {
      const { token, raw } = req.body;
      if (!token || !raw) {
        return res.status(400).json({ error: "Missing token or raw body" });
      }

      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, data });
      } else {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }
    } catch (e: any) {
      console.error("Error proxies sending email via backend:", e);
      return res.status(500).json({ error: e.message || String(e) });
    }
  });

  app.get("/api/data", (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email required" });

      const userData = readUser(email);
      res.json({ data: userData ? userData.data : null });
    } catch (e) {
      sendDbError(res, "read data", e);
    }
  });

  app.post("/api/data", (req, res) => {
    try {
      const { email, data } = req.body;
      if (!email || !data)
        return res.status(400).json({ error: "Missing payload" });
      const userData = readUser(email);
      userData.data = data;
      writeUser(email, userData);
      
      res.json({ success: true });
    } catch (e) {
      sendDbError(res, "write data", e);
    }
  });
  app.get("/api/cookies", (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userData = readUser(email);
      res.json({ cookies: userData ? userData.cookies : null });
    } catch (e) {
      sendDbError(res, "read cookies", e);
    }
  });

  app.post("/api/cookies", (req, res) => {
    try {
      const { email, cookies } = req.body;
      if (!email) return res.status(400).json({ error: "Missing email" });
      const userData = readUser(email);
      userData.cookies = cookies;
      writeUser(email, userData);
      res.json({ success: true });
    } catch (e) {
      sendDbError(res, "write cookies", e);
    }
  });

  // ------------------ PROFILE ENDPOINTS ------------------
  app.get("/api/profile", (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email required" });
      
      const userData = readUser(email);
      res.json({ profile: userData ? userData.profile : null });
    } catch (e) {
      sendDbError(res, "read profile", e);
    }
  });

  app.post("/api/profile", (req, res) => {
    try {
      const { email, profile } = req.body;
      if (!email || !profile)
        return res.status(400).json({ error: "Missing payload" });
      const userData = readUser(email);
      userData.profile = profile;
      writeUser(email, userData);

      res.json({ success: true });
    } catch (e) {
      sendDbError(res, "write profile", e);
    }
  });

  // ------------------ EMAIL & PASSWORD AUTHENTICATION ENDPOINTS ------------------
  // ------------------ NOTIFICATION ENDPOINTS ------------------
  app.get("/api/notifications", (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userData = readUser(email);
      res.json({
        notifications:
          userData && userData.notifications ? userData.notifications : [],
      });
    } catch (e) {
      sendDbError(res, "read notifications", e);
    }
  });

  app.post("/api/notifications/trigger", (req, res) => {
    try {
      const { email, notification } = req.body;
      if (!email || !notification)
        return res.status(400).json({ error: "Missing payload" });
      const userData = readUser(email);
      if (!userData.notifications) userData.notifications = [];

      const newNotification = {
        id: crypto.randomUUID(),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        senderEmail: notification.senderEmail || "system@alblueprint.com",
        senderName: notification.senderName || "AL Blueprint Admin",
        read: false,
        timestamp: new Date().toISOString(),
      };

      userData.notifications.unshift(newNotification);
      writeUser(email, userData);
      res.json({ success: true, notification: newNotification });
    } catch (e) {
      sendDbError(res, "create notification", e);
    }
  });

  app.post("/api/notifications/read", (req, res) => {
    try {
      const { email, notificationId, readAll } = req.body;
      if (!email) return res.status(400).json({ error: "Missing email" });
      const userData = readUser(email);
      if (userData && userData.notifications) {
        if (readAll) {
          userData.notifications.forEach((n: any) => (n.read = true));
        } else if (notificationId) {
          const notif = userData.notifications.find(
            (n: any) => n.id === notificationId,
          );
          if (notif) notif.read = true;
        }
        writeUser(email, userData);
      }
      res.json({ success: true });
    } catch (e) {
      sendDbError(res, "mark notifications read", e);
    }
  });

  app.post("/api/notifications/delete", (req, res) => {
    try {
      const { email, notificationId } = req.body;
      if (!email || !notificationId)
        return res.status(400).json({ error: "Missing payload" });
      const userData = readUser(email);
      if (userData && userData.notifications) {
        userData.notifications = userData.notifications.filter(
          (n: any) => n.id !== notificationId,
        );
        writeUser(email, userData);
      }
      res.json({ success: true });
    } catch (e) {
      sendDbError(res, "delete notification", e);
    }
  });

  app.get("/api/yt-download", async (req, res) => {
    try {
      const url = req.query.url as string;
      const title = (req.query.title as string) || "video";
      const cookies =
        (req.query.cookies as string) ||
        (req.headers["x-youtube-cookies"] as string);

      if (!url) {
        return res.status(400).send("No URL provided");
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(title.replace(/[^a-zA-Z0-9 ]/g, ""))}.mp4"`,
      );
      res.setHeader("Content-Type", "video/mp4");

      const idMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
      );
      const videoId = idMatch ? idMatch[1] : null;
      if (!videoId) {
        return res.status(400).send("This is not a valid YouTube Watch URL");
      }

      // If cookies provided, configure play-dl with youtube authentication token
      const playDlPkg = "play-dl";
      const play = (await import(playDlPkg)).default;
      if (cookies && cookies.trim() !== "") {
        try {
          await play.setToken({
            youtube: {
              cookie: cookies.trim(),
            },
          });
          console.log(
            "Successfully fed custom cookies to play-dl for bot bypass session.",
          );
        } catch (cookieErr) {
          console.error("Failed to inject custom play-dl cookies:", cookieErr);
        }
      }

      // 1. Try public invidious proxies first since they bypass datacenter IPs.
      const instances = [
        "https://inv.thepixora.com",
        "https://invidious.nerdvpn.de",
        "https://yt.artemislena.eu",
        "https://invidious.projectsegfau.lt",
        "https://invidious.lunar.icu",
        "https://invidious.flokinet.to",
        "https://iv.ggtyler.dev",
        "https://yewtu.be",
      ];
      let proxyResponse = null;
      for (const inst of instances) {
        try {
          const proxyUrl = `${inst}/latest_version?id=${videoId}&itag=18&local=true`;
          // Add abort controller to fail fast on slow instances
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          // Build custom request headers with cookie bypass
          const reqHeaders: Record<string, string> = {};
          if (cookies && cookies.trim() !== "") {
            reqHeaders["Cookie"] = cookies.trim();
          }

          const r = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: reqHeaders,
          });
          clearTimeout(timeoutId);

          if (r.ok && r.body) {
            const contentType = r.headers.get("content-type") || "";
            const contentLength = parseInt(
              r.headers.get("content-length") || "0",
              10,
            );

            // Verify it's a real video stream, not a short 400/403 text error (usually less than 200KB)
            if (
              r.status === 200 &&
              (contentType.includes("video") ||
                contentType.includes("octet")) &&
              contentLength > 200000
            ) {
              proxyResponse = r;
              console.log(
                `Successfully found working direct stream proxy on ${inst} (${contentLength} bytes)`,
              );
              break;
            }
          }
        } catch (e) {
          // Ignore instance errors and continue
        }
      }

      if (proxyResponse && proxyResponse.body) {
        const streamModule = await import("stream");
        const Readable = streamModule.Readable;
        const stream = Readable.fromWeb(proxyResponse.body as any);
        stream.pipe(res);
        return;
      }

      // 2. Fallback to play-dl just in case
      const streamInfo = await play.stream(url);
      streamInfo.stream.pipe(res);
    } catch (e: any) {
      let errMsg = "Error downloading video";
      const errStr = String(e) + (e?.message || "") + (e?.stack || "");
      if (errStr.toLowerCase().includes("bot")) {
        errMsg =
          "YouTube Bot Detection Blocked Datacenter IP. Try providing custom session cookies in settings for bot bypass.";
      } else if (errStr.toLowerCase().includes("not a youtube")) {
        errMsg = "This is not a valid YouTube Watch URL";
      } else {
        errMsg = e?.message || errMsg;
        console.error("YTDL Error:", e);
      }
      res.status(500).send(errMsg);
    }
  });
  // New endpoint to generate GCE A/L specific AI Progress trends and focus areas advice
  // New endpoint for Lesson Optimizer
  // Return JSON for unmatched API routes instead of falling through to the SPA.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found", path: req.originalUrl });
  });

  // Central error handler keeps Vercel functions from returning opaque HTML 500 pages.
  app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled API error", {
      method: req.method,
      path: req.originalUrl,
      message: error?.message || String(error),
      stack: error?.stack,
    });
    if (res.headersSent) return;
    res.status(error?.status || 500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "production" ? undefined : error?.message,
    });
  });

  return app;
}

const app = createApp();
export default app;
