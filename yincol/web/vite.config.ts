import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The shared workspace is consumed as TypeScript source rather than as a build
// artefact — it keeps the palette engine openable in front of judges with no
// compile step between what they read and what runs.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@yincol/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // The browser never holds the API key; every vendor call goes through Express.
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
