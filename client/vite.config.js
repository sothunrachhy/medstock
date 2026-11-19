import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // code shared with the server (validation schemas, helpers)
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
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
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
