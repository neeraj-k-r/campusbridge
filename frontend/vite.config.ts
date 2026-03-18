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
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ],
          start_url: "/",
          background_color: "#ffffff",
          display: "standalone",
          theme_color: "#000000",
          orientation: "portrait"
        }
      })
    ],
    // ADDED BUILD CONFIG FOR JSPDF
    build: {
      rollupOptions: {
        external: [], // If a specific module like 'fs' was listed in the error, put it here
      },
      commonjsOptions: {
        transformMixedEsModules: true, // Helps with jspdf's mixed module format
      }
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      // Important for some libraries that check for global/process
      'global': 'window',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // ADDED TO HELP VITE CACHE JSPDF LOCALLY
    optimizeDeps: {
      include: ['jspdf', 'jspdf-autotable'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});