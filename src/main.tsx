import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";
import "./index.css";

let staleChunkRecoveryStarted = false;

async function recoverFromStaleChunk() {
  if (staleChunkRecoveryStarted) return;
  staleChunkRecoveryStarted = true;
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
  }
  if (typeof caches !== "undefined") {
    const keys = await caches.keys().catch(() => []);
    await Promise.all(keys.filter((key) => key.startsWith("workbox") || key.startsWith("clora")).map((key) => caches.delete(key)));
  }
  window.location.reload();
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  const message = String((event.reason as Error | undefined)?.message || event.reason || "");
  if (message.includes("Failed to fetch dynamically imported module") || message.includes("Importing a module script failed")) {
    event.preventDefault();
    void recoverFromStaleChunk();
  }
});

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
}

const root = document.getElementById("root");
if (!root) throw new Error("ROOT_ELEMENT_MISSING");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
