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
  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(event.reason?.message || event.reason || "");
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
console.log(`[APP_VERSION] Booting Clora X version ${APP_VERSION}`);

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

const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '100000000000-dummy.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    
      <BrowserRouter>
        <App />
      </BrowserRouter>
    
  </StrictMode>,
);
