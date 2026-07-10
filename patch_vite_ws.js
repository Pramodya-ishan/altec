import fs from 'fs';

let content = fs.readFileSync('src/main.tsx', 'utf8');

if (!content.includes('unhandledrejection')) {
  const guard = `
if (import.meta.env.DEV) {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(event.reason?.message || event.reason || "");
    if (msg.includes("WebSocket closed without opened")) {
      event.preventDefault();
      console.warn("[dev] Vite HMR websocket unavailable");
    }
  });
}
`;
  content = guard + content;
  fs.writeFileSync('src/main.tsx', content);
}
