import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const target = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  build: {
    // Compatible con el navegador de los televisores Samsung de 2022 (Tizen 6.5, motor Chromium ~85).
    // Solo transforma sintaxis; no añade polyfills, así que el código evita APIs más recientes.
    target: ['chrome85', 'safari14', 'firefox90', 'edge88'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/media': { target, changeOrigin: true },
    },
    watch: process.env.CHOKIDAR_USEPOLLING ? { usePolling: true } : undefined,
  },
});
