import { defineConfig } from 'vite';
import path from 'path';

const base = process.env.CYBERANTE_BASE_PATH ?? '/';
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('CYBERANTE_BASE_PATH must be / or a slash-delimited path such as /cyberante/');

export default defineConfig({
  base,
  root: '.',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/ws': { target: 'http://127.0.0.1:8080', ws: true },
    },
  },
  resolve: {
    alias: {
      '@cyberante/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: { game: path.resolve(__dirname, 'index.html'), benchmark: path.resolve(__dirname, 'benchmark.html') },
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
