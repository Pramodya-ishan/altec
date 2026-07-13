// Keep the runtime specifier as .js. TypeScript resolves this to server.ts at
// build time, while Vercel's emitted ESM function resolves server.js at runtime.
import app from '../server.js';
export default app;
