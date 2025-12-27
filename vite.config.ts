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
    plugins: [
      react(),
      // Simple dev plugin to serve /api/test during dev runs so SW e2e tests are deterministic
      {
        name: 'sw-test-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api/test')) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/plain');
              res.end('network');
              return;
            }
            next();
          });
        },
      },
    ],
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
