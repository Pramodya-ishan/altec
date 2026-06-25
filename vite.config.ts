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
             maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
             clientsClaim: true,
             skipWaiting: true
          },
          devOptions: {
             enabled: true
          },
          manifest: {
             name: 'Clora X',
             short_name: 'Clora X',
             description: 'AI Progress Assistant and Data Analyst',
             theme_color: '#1f1f1f',
             icons: [
                {
                   src: 'https://api.dicebear.com/7.x/shapes/svg?seed=CloraX&backgroundColor=4f46e5',
                   sizes: '192x192',
                   type: 'image/svg+xml'
                },
                {
                   src: 'https://api.dicebear.com/7.x/shapes/svg?seed=CloraX&backgroundColor=4f46e5',
                   sizes: '512x512',
                   type: 'image/svg+xml'
                }
             ]
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
