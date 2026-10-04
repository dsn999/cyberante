import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
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
