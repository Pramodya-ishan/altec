process.env.NODE_ENV = "production";
process.env.VERCEL = "1";

import { once } from "node:events";

const timeout = setTimeout(() => {
  console.error("Vercel runtime smoke test timed out during ESM module initialization.");
  process.exit(1);
}, 60_000);

try {
  const runtime = await import("../vercel-runtime/server.mjs");
  if (typeof runtime.default !== "function") {
    throw new Error("The Vercel runtime does not export an Express application.");
  }

  const server = runtime.default.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The Vercel runtime smoke server did not expose a local port.");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/context`);
  const contentType = response.headers.get("content-type") || "";
  const payload = await response.json();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

  if (response.status !== 401 || !contentType.includes("application/json") || payload?.code !== "LOGIN_REQUIRED") {
    throw new Error(`Unexpected API smoke response: ${response.status} ${contentType} ${JSON.stringify(payload)}`);
  }

  clearTimeout(timeout);
  console.log("Verified pure-ESM boot and JSON API handling for the Vercel runtime.");
  process.exit(0);
} catch (error) {
  clearTimeout(timeout);
  console.error("Vercel runtime ESM smoke test failed:", error);
  process.exit(1);
}
