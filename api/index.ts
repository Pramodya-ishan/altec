// Vercel transpiles TypeScript without rewriting extensionless imports in the
// backend dependency graph. Import the esbuild-generated ESM bundle instead so
// the function always boots from one fully-resolved JavaScript module.
import app from '../vercel-runtime/server.mjs';
export default app;
