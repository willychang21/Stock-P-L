import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, './src/domain'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@application': path.resolve(__dirname, './src/application'),
      '@presentation': path.resolve(__dirname, './src/presentation'),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: {
    fs: {
      // Allow serving files from sql.js wasm
      allow: ['..'],
    },
    // Proxy Yahoo Finance API to bypass CORS
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
    },
  },
});
