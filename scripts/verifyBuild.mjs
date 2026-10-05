import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const LIMIT = 250000;
const forbidden = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg', '.gltf', '.glb', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.ts', '.tsx', '.map']);
/** Audits all emitted chunks, including the separate hardware acceptance page. */
export async function auditProductionBuild(directory, basePath = process.env.CYBERANTE_BASE_PATH ?? '/') {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) throw new Error('Invalid production base path');
  const root = resolve(directory);
  const files = [];
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = resolve(dir, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile()) files.push(full);
      else throw new Error(`Unexpected build entry: ${relative(root, full)}`);
    }
  }
  await walk(root);
  if (files.some(file => forbidden.has(extname(file).toLowerCase()))) throw new Error('Production build contains media, raw TypeScript or source maps');
  if (!files.includes(resolve(root, 'index.html'))) throw new Error('Missing production index.html');
  for (const file of files.filter(file => file.endsWith('.html'))) {
    const html = await readFile(file, 'utf8');
    const entries = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1]);
    const assetPrefix = `${basePath}assets/`;
    if (!entries.length || entries.some(entry => !entry.startsWith(assetPrefix) || !/^[\w.-]+\.js$/.test(entry.slice(assetPrefix.length)))) throw new Error('Production HTML must load bundled JavaScript');
    for (const entry of entries) if (!files.includes(resolve(root, entry.slice(basePath.length)))) throw new Error('Missing production entry');
  }
  const chunks = [];
  for (const file of files.filter(file => file.endsWith('.js'))) {
    const body = await readFile(file);
    const gzipBytes = gzipSync(body, { level: 9 }).byteLength;
    chunks.push({ file: relative(root, file), bytes: body.byteLength, gzipBytes });
  }
  const gzipBytes = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
  if (gzipBytes >= LIMIT) throw new Error(`Production JavaScript ${gzipBytes} gzip bytes exceeds the <${LIMIT} byte limit`);
  return { gzipBytes, limitBytes: LIMIT, files: files.map(file => relative(root, file)).sort(), chunks };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await auditProductionBuild(fileURLToPath(new URL('../packages/client/dist/', import.meta.url)));
  console.log(JSON.stringify(report, null, 2));
}
