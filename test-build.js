import "dotenv/config";
import express from "express";
import "path";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import play from "play-dl";
import { readUser, writeUser } from "./server/data/userRepository";
import { aiRoutes } from "./server/ai/routes";
import { authRoutes } from "./server/auth/routes";
let requestLog = [];
function cleanRequestLog() {
  const now = Date.now();
  requestLog = requestLog.filter((t) => now - t < 864e5);
}
async function processGeminiQueue() {
  if (currentGeminiRequests >= MAX_CONCURRENT_GEMINI) return;
  cleanRequestLog();
  const now = Date.now();
  const requestsLastMinute = requestLog.filter((t) => now - t < 6e4).length;
  if (requestLog.length >= RPD_LIMIT) {
    console.warn("Daily request limit reached. Queue paused for an hour.");
    setTimeout(processGeminiQueue, 60 * 60 * 1e3);
    return;
  }
  if (requestsLastMinute >= RPM_LIMIT) {
    setTimeout(processGeminiQueue, 4e3);
    return;
  }
  if (geminiQueue.length > 0) {
    const { task, resolve, reject } = geminiQueue.shift();
    currentGeminiRequests++;
    const executeTask = async () => {
      try {
        requestLog.push(Date.now());
        const result = await task();
        resolve(result);
      } catch (e) {
        console.warn("Clora X task failed:", e.message);
        reject(e);
      }
    };
    executeTask().finally(() => {
      currentGeminiRequests--;
      setTimeout(processGeminiQueue, 1e3);
    });
  }
}
function enqueueGeminiTask(task) {
  return new Promise((resolve, reject) => {
    geminiQueue.push({ task, resolve, reject });
    processGeminiQueue();
  });
}
async function callPollinationsAI(messages, jsonMode = false) {
  const models = ["qwen", "qwen-coder", "llama", "mistral", "openai"];
  let lastError = null;
  for (const model of models) {
    try {
      console.log(`Trying Pollinations AI model POST: ${model}...`);
      const userAgent = `CloraXInfinity-${Math.floor(Math.random() * 1e6)}`;
      const fallbackRes = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          Accept: "text/plain, */*",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({
          messages,
          model,
          jsonMode
        })
      });
      if (fallbackRes.ok) {
        const text = await fallbackRes.text();
        if (text && text.trim().length > 0) {
          console.log(`Pollinations AI model POST ${model} succeeded!`);
          return text;
        }
      } else {
        console.warn(
          `Pollinations AI model POST ${model} returned status ${fallbackRes.status}`
        );
        lastError = new Error(
          `Pollinations AI model POST ${model} returned status ${fallbackRes.status}`
        );
      }
    } catch (err) {
      console.warn(`Pollinations AI model POST ${model} failed:`, err);
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  try {
    console.log("Attempting Pollinations AI GET fallback...");
    const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content || "-";
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const getUrl = `https://text.pollinations.ai/${encodeURIComponent(lastUserMsg)}?system=${encodeURIComponent(systemMsg)}&model=qwen`;
    const getRes = await fetch(getUrl, {
      headers: {
        "User-Agent": `CloraXInfinity-GET-${Math.floor(Math.random() * 1e6)}`
      }
    });
    if (getRes.ok) {
      const text = await getRes.text();
      if (text && text.trim().length > 0) {
        console.log("Pollinations AI GET fallback succeeded!");
        return text;
      }
    }
  } catch (getErr) {
    console.error("Pollinations AI GET fallback failed:", getErr);
  }
  throw lastError || new Error("All Pollinations AI fallback attempts failed");
}
async function startServer() {
  app.use("/api", aiRoutes);
  app.use("/api/auth", authRoutes);
  const app = express();
  const PORT = 3e3;
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/quota", (req, res) => {
    try {
      cleanRequestLog();
      const now = Date.now();
      const requestsLastMinute = requestLog.filter(
        (t) => now - t < 6e4
      ).length;
      res.json({
        rpmUsed: requestsLastMinute,
        rpmLimit: RPM_LIMIT,
        rpdUsed: requestLog.length,
        rpdLimit: RPD_LIMIT
      });
    } catch (e) {
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
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw })
        }
      );
      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, data });
      } else {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }
    } catch (e) {
      console.error("Error proxies sending email via backend:", e);
      return res.status(500).json({ error: e.message || String(e) });
    }
  });
  app.get("/api/data", (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userData = readUser(email);
      res.json({ data: userData ? userData.data : null });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
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
      res.status(500).json({ error: "DB Error" });
    }
  });
  app.get("/api/cookies", (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userData = readUser(email);
      res.json({ cookies: userData ? userData.cookies : null });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
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
      res.status(500).json({ error: "DB Error" });
    }
  });
  app.get("/api/profile", (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userData = readUser(email);
      res.json({ profile: userData ? userData.profile : null });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
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
      res.status(500).json({ error: "DB Error" });
    }
  });
  app.get("/api/notifications", (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: "Email required" });
      const userData = readUser(email);
      res.json({
        notifications: userData && userData.notifications ? userData.notifications : []
      });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
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
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      userData.notifications.unshift(newNotification);
      writeUser(email, userData);
      res.json({ success: true, notification: newNotification });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
    }
  });
  app.post("/api/notifications/read", (req, res) => {
    try {
      const { email, notificationId, readAll } = req.body;
      if (!email) return res.status(400).json({ error: "Missing email" });
      const userData = readUser(email);
      if (userData && userData.notifications) {
        if (readAll) {
          userData.notifications.forEach((n) => n.read = true);
        } else if (notificationId) {
          const notif = userData.notifications.find(
            (n) => n.id === notificationId
          );
          if (notif) notif.read = true;
        }
        writeUser(email, userData);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
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
          (n) => n.id !== notificationId
        );
        writeUser(email, userData);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "DB Error" });
    }
  });
  app.get("/api/yt-download", async (req, res) => {
    try {
      const url = req.query.url;
      const title = req.query.title || "video";
      const cookies = req.query.cookies || req.headers["x-youtube-cookies"];
      if (!url) {
        return res.status(400).send("No URL provided");
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(title.replace(/[^a-zA-Z0-9 ]/g, ""))}.mp4"`
      );
      res.setHeader("Content-Type", "video/mp4");
      const idMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
      );
      const videoId = idMatch ? idMatch[1] : null;
      if (!videoId) {
        return res.status(400).send("This is not a valid YouTube Watch URL");
      }
      if (cookies && cookies.trim() !== "") {
        try {
          await play.setToken({
            youtube: {
              cookie: cookies.trim()
            }
          });
          console.log(
            "Successfully fed custom cookies to play-dl for bot bypass session."
          );
        } catch (cookieErr) {
          console.error("Failed to inject custom play-dl cookies:", cookieErr);
        }
      }
      const instances = [
        "https://inv.thepixora.com",
        "https://invidious.nerdvpn.de",
        "https://yt.artemislena.eu",
        "https://invidious.projectsegfau.lt",
        "https://invidious.lunar.icu",
        "https://invidious.flokinet.to",
        "https://iv.ggtyler.dev",
        "https://yewtu.be"
      ];
      let proxyResponse = null;
      for (const inst of instances) {
        try {
          const proxyUrl = `${inst}/latest_version?id=${videoId}&itag=18&local=true`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5e3);
          const reqHeaders = {};
          if (cookies && cookies.trim() !== "") {
            reqHeaders["Cookie"] = cookies.trim();
          }
          const r = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: reqHeaders
          });
          clearTimeout(timeoutId);
          if (r.ok && r.body) {
            const contentType = r.headers.get("content-type") || "";
            const contentLength = parseInt(
              r.headers.get("content-length") || "0",
              10
            );
            if (r.status === 200 && (contentType.includes("video") || contentType.includes("octet")) && contentLength > 2e5) {
              proxyResponse = r;
              console.log(
                `Successfully found working direct stream proxy on ${inst} (${contentLength} bytes)`
              );
              break;
            }
          }
        } catch (e) {
        }
      }
      if (proxyResponse && proxyResponse.body) {
        const streamModule = await import("stream");
        const Readable = streamModule.Readable;
        const stream = Readable.fromWeb(proxyResponse.body);
        stream.pipe(res);
        return;
      }
      const streamInfo = await play.stream(url);
      streamInfo.stream.pipe(res);
    } catch (e) {
      let errMsg = "Error downloading video";
      const errStr = String(e) + (e?.message || "") + (e?.stack || "");
      if (errStr.toLowerCase().includes("bot")) {
        errMsg = "YouTube Bot Detection Blocked Datacenter IP. Try providing custom session cookies in settings for bot bypass.";
      } else if (errStr.toLowerCase().includes("not a youtube")) {
        errMsg = "This is not a valid YouTube Watch URL";
      } else {
        errMsg = e?.message || errMsg;
        console.error("YTDL Error:", e);
      }
      res.status(500).send(errMsg);
    }
  });
  if (true) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
