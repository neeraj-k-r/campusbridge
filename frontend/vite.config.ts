import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          importScripts: ['/firebase-messaging-sw.js']
        },
        manifest: {
          short_name: "CAMPUS BRIDGE",
          name: "CAMPUS BRIDGE",
          icons: [
            { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ],
          start_url: "/",
          background_color: "#ffffff",
          display: "standalone",
          theme_color: "#000000",
          orientation: "portrait"
        }
      })
    ],
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        // This tells Rollup these modules are external and should not be bundled
        external: ['fs', 'path', 'canvas', 'http', 'https', 'url', 'zlib', 'stream', 'util'],
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Comprehensive list of Node shims to prevent Render build crashes
        'fs': path.resolve(__dirname, 'node_modules/vite/dist/client/env.mjs'),
        'path': path.resolve(__dirname, 'node_modules/vite/dist/client/env.mjs'),
        'stream': path.resolve(__dirname, 'node_modules/vite/dist/client/env.mjs'),
        'zlib': path.resolve(__dirname, 'node_modules/vite/dist/client/env.mjs'),
        'util': path.resolve(__dirname, 'node_modules/vite/dist/client/env.mjs'),
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'global': 'window',
    },
    optimizeDeps: {
      include: ['jspdf', 'jspdf-autotable'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});