import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Dev-time proxy to forward AI helper requests to the local proxy (port 3002)
      // This avoids exposing API keys to the browser and keeps the same origin for fetch calls.
      proxy: {
        '/openrouter': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          // keep the /openrouter path, Vite will forward to the helper as-is
          rewrite: (path) => path,
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
