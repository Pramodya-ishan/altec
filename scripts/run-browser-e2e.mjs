import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const port = 4173;
const debugPort = 9333;
const baseUrl = `http://127.0.0.1:${port}`;
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "clora-browser-e2e-"));
let preview;
let chrome;

function start(command, args, options = {}) {
  return spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

async function waitFor(url, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}


async function waitForPageReady(client, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const state = await client.send("Runtime.evaluate", {
        expression: "document.readyState",
        returnByValue: true,
      });
      if (state?.result?.value === "complete" || state?.result?.value === "interactive") return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for Chromium page readiness");
}

async function cdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      events.push(message);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  return { socket, send, events };
}


async function managedChromiumBlocksNavigation() {
  try {
    const policy = JSON.parse(await readFile("/etc/chromium/policies/managed/000_policy_merge.json", "utf8"));
    const blocked = Array.isArray(policy.URLBlocklist) && policy.URLBlocklist.includes("*");
    const allowed = Array.isArray(policy.URLAllowlist) && policy.URLAllowlist.some((entry) => /localhost|127\.0\.0\.1/.test(String(entry)));
    return blocked && !allowed;
  } catch {
    return false;
  }
}

async function main() {
  if (await managedChromiumBlocksNavigation()) {
    console.log("[SKIP] Chromium is managed with URLBlocklist=*; local browser navigation is unavailable in this build environment.");
    return;
  }
  preview = start(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port)]);
  await waitFor(baseUrl);

  chrome = start("/usr/bin/chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ]);
  const version = await waitFor(`http://127.0.0.1:${debugPort}/json/version`);
  assert.ok((await version.json()).Browser);
  const targets = await (await waitFor(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((item) => item.type === "page");
  assert.ok(target?.webSocketDebuggerUrl, "Chromium page target was not created");
  const client = await cdp(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");

  for (const [width, height] of [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932]]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    const navigation = await client.send("Page.navigate", { url: `${baseUrl}/clora-x` });
    assert.equal(navigation?.errorText, undefined, `Navigation failed: ${navigation?.errorText}`);
    await waitForPageReady(client);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const result = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        loginVisible: Array.from(document.querySelectorAll('button')).some((el) => /sign in with google/i.test(el.textContent || '')),
        hasOldLocalState: Object.keys(localStorage).some((key) => /token|cookie|session|student_progress|email_user/i.test(key)),
        bodyText: (document.body?.innerText || '').slice(0, 3000)
      }))()`,
    });
    if (!result?.result || result.exceptionDetails || typeof result.result.value !== "object") {
      throw new Error(`Browser evaluation failed: ${JSON.stringify(result)}`);
    }
    const value = result.result.value;
    assert.equal(value.scrollWidth, value.clientWidth, `Horizontal overflow at ${width}x${height}`);
    assert.equal(value.loginVisible, true, `Unauthenticated access was not blocked at ${width}x${height}`);
    assert.equal(value.hasOldLocalState, false, `Sensitive legacy browser storage found at ${width}x${height}`);
  }

  const consoleText = client.events
    .filter((event) => event.method === "Runtime.consoleAPICalled" || event.method === "Log.entryAdded")
    .map((event) => JSON.stringify(event.params))
    .join("\n");
  assert.doesNotMatch(consoleText, /width\(-1\)|height\(-1\)/i, "Recharts negative-dimension warning detected");
  assert.doesNotMatch(consoleText, /window\.closed call/i, "Firebase popup polling warning detected");
  client.socket.close();
  console.log("[PASS] Chromium mobile/auth/overflow browser checks");
}

try {
  await main();
} finally {
  await stopProcess(chrome);
  await stopProcess(preview);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
