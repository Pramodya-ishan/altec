process.env.NODE_ENV = "production";
process.env.VERCEL = "1";

import { once } from "node:events";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const timeout = setTimeout(() => {
  console.error("Vercel runtime smoke test timed out during ESM module initialization.");
  process.exit(1);
}, 60_000);
let isolatedDirectory;
let exitCode = 0;

try {
  // Import from outside the repository so Node cannot silently resolve a
  // dependency from the root node_modules directory. This mirrors Vercel's
  // traced function filesystem and catches incomplete bundles before deploy.
  isolatedDirectory = await mkdtemp(path.join(tmpdir(), "altec-vercel-runtime-"));
  const isolatedRuntimePath = path.join(isolatedDirectory, "server.mjs");
  await cp(new URL("../vercel-runtime/server.mjs", import.meta.url), isolatedRuntimePath);
  await cp(
    new URL("../vercel-runtime/google-gax-protos/", import.meta.url),
    path.join(isolatedDirectory, "google-gax-protos"),
    { recursive: true },
  );

  const runtime = await import(pathToFileURL(isolatedRuntimePath).href);
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
  console.log("Verified isolated pure-ESM boot and JSON API handling without root node_modules.");
} catch (error) {
  console.error("Vercel runtime ESM smoke test failed:", error);
  exitCode = 1;
} finally {
  clearTimeout(timeout);
  if (isolatedDirectory) {
    await rm(isolatedDirectory, { recursive: true, force: true });
  }
}

// Firebase Admin/gRPC and rate-limiter dependencies can retain background
// handles even after the HTTP server closes. This is a build-time smoke test,
// so terminate explicitly after all assertions and temporary-file cleanup.
process.exit(exitCode);
