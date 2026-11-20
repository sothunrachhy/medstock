import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Where `npm run dev` forwards /api requests: the API running on your computer.
  // Set API_PROXY_TARGET in frontend/.env to change it (default http://localhost:5000).
  const apiProxy = loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // validation schemas and helpers (API.md lists the matching API rules)
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // React + router change rarely: keep them in their own long-cached file
          manualChunks: {
            react: ['react', 'react-dom', 'react-router', 'react-router-dom'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiProxy, changeOrigin: true },
      },
    },
  };
});
