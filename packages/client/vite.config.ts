import { defineConfig } from 'vite';
import path from 'path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const clientDirectory = fileURLToPath(new URL('.', import.meta.url));

const base = process.env.CYBERANTE_BASE_PATH ?? '/';
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('CYBERANTE_BASE_PATH must be / or a slash-delimited path such as /cyberante/');

export default defineConfig({
  base,
  plugins: [{
    name: 'cyberante-license-notices',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: readFileSync(path.resolve(clientDirectory, '../../LICENSE'), 'utf8') });
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.txt', source: readFileSync(path.resolve(clientDirectory, '../../THIRD_PARTY_NOTICES.txt'), 'utf8') });
    },
  }],
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
      '@cyberante/shared': path.resolve(clientDirectory, '../shared/src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: { game: path.resolve(clientDirectory, 'index.html'), benchmark: path.resolve(clientDirectory, 'benchmark.html') },
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
