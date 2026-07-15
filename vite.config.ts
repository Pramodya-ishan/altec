import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
       react(), 
       tailwindcss(),
       VitePWA({
          registerType: 'autoUpdate',
          workbox: {
             maximumFileSizeToCacheInBytes: 1024 * 1024,
             globIgnores: [
                "**/pdf.worker*",
                "**/assets/pdf*",
                "**/assets/charts*",
                "**/assets/admission-predictor*",
                "**/*.map"
             ],
             // Never let the service worker turn an API request into the SPA.
             // Unknown SPA routes intentionally redirect to admission-predictor,
             // which made failed API navigations look like server redirects.
             navigateFallbackDenylist: [/^\/api(?:\/|$)/],
             clientsClaim: true,
             skipWaiting: true,
             cleanupOutdatedCaches: true
          },
          devOptions: {
             enabled: false
          },
          manifest: {
             name: 'Tec A/L',
             short_name: 'Tec A/L',
             description: 'Sri Lankan A/L Technology learning workspace',
             theme_color: '#ffffff',
             background_color: '#ffffff',
             icons: []
          }
       })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/firebase")) return "firebase";
            if (id.includes("node_modules/recharts") || id.includes("node_modules/chart.js") || id.includes("node_modules/react-chartjs-2")) return "charts";
            if (id.includes("node_modules/katex") || id.includes("rehype-katex") || id.includes("remark-math")) return "math";
            if (id.includes("node_modules/pdfjs-dist")) return "pdf";
            if (id.includes("node_modules/shaka-player")) return "shaka-player";
            if (id.includes("node_modules/plyr")) return "plyr";
            if (id.includes("AdmissionPredictorView")) return "admission-predictor";
            if (id.includes("PaperStructureView")) return "paper-structure";
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
