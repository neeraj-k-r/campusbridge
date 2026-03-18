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
          // FIX 1: Increase the Workbox cache limit to 4MB (4194304 bytes)
          maximumFileSizeToCacheInBytes: 4194304,
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
      // Suppresses the yellow warning in the Vite terminal
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // FIX 2: Code splitting! This chops your code into smaller files 
          // so no single file hits the 2MB limit in the first place.
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            pdf: ['jspdf', 'jspdf-autotable'],
            ui: ['lucide-react', 'framer-motion', 'react-hot-toast']
          }
        }
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