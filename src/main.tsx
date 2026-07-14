import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Silence recharts defaultProps warning in React 18+
const errorLog = console.error;
console.error = (...args: any[]) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('defaultProps')) return;
  errorLog(...args);
};

const warnLog = console.warn;
console.warn = (...args: any[]) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('defaultProps')) return;
  warnLog(...args);
};

// Suppress Vite websocket warnings in AI Studio preview
if (typeof window !== 'undefined') {
  const recoverFromStaleChunk = async () => {
    const recoveryKey = 'clora_chunk_recovery';
    const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (Date.now() - lastRecovery < 30_000) return;
    sessionStorage.setItem(recoveryKey, String(Date.now()));
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys().catch(() => []);
      await Promise.all(keys.filter((key) => key.startsWith('workbox') || key.startsWith('clora')).map((key) => caches.delete(key)));
    }
    window.location.reload();
  };

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    void recoverFromStaleChunk();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(event.reason?.message || event.reason || "");
    if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
      event.preventDefault();
      void recoverFromStaleChunk();
      return;
    }
    if (msg.includes("WebSocket closed without opened")) {
      event.preventDefault();
      console.warn("[dev] Vite HMR websocket unavailable");
    }
  });
}

// Suppress unhandled websocket rejections/errors during hot reload or offline state
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || "");
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('WS')) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event.message || "");
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('WS')) {
      event.preventDefault();
    }
  });
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION || Date.now().toString();
if (import.meta.env.DEV) {
  console.info(`[APP_VERSION] Booting Clora X version ${APP_VERSION}`);
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isDev = import.meta.env.DEV || window.location.hostname.includes('localhost') || window.location.hostname.includes('ais-dev');
  if (isDev) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().then(() => {
          console.log('[APP_VERSION] Unregistered old service worker in dev');
        });
      });
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key.startsWith('workbox') || key.startsWith('clora')) {
            caches.delete(key).then(() => {
              console.log(`[APP_VERSION] Purged old cache key: ${key}`);
            });
          }
        });
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    
      <BrowserRouter>
        <App />
      </BrowserRouter>
    
  </StrictMode>,
);
