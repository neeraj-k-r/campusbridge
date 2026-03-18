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
          start_url: "/",
          display: "standalone",
          theme_color: "#000000",
          background_color: "#ffffff",
          icons: [
            { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ],
        }
      })
    ],
    build: {
      outDir: 'dist',
      rollupOptions: {
        // Only externalize actual Node built-ins if they cause errors later
        // But do NOT externalize jspdf here, or it won't be bundled!
        external: [],
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'global': 'window',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});