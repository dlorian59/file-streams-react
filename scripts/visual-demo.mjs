import { build } from 'esbuild';
import { createServer } from 'node:https';
import { createSecureServer } from 'node:http2';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'output/visuals');
mkdirSync(output, { recursive: true });
// Local development keys stay in ignored output; no external credentials are needed.
// Локальные ключи остаются в игнорируемом output; внешние credentials не нужны.
const cert = resolve(output, 'cert.pem'), key = resolve(output, 'key.pem');
if (!existsSync(cert) || !existsSync(key)) execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
const tls = { key: readFileSync(key), cert: readFileSync(cert) };
await build({ entryPoints: [resolve(root, 'examples/visuals/main.tsx')], bundle: true, format: 'esm', outfile: resolve(output, 'main.js') });
const web = createServer(tls, (request, response) => {
  const route = new URL(request.url, 'https://127.0.0.1:5181').pathname;
  const file = route === '/' ? resolve(root, 'examples/visuals/index.html') : route === '/main.js' ? resolve(output, 'main.js') : undefined;
  if (!file) { response.writeHead(404).end(); return; }
  response.setHeader('content-type', route === '/' ? 'text/html; charset=utf-8' : 'text/javascript');
  response.end(readFileSync(file));
});
// This bounded memory fixture exists only for reproducible UI captures, not production storage.
// Ограниченный memory fixture нужен только для воспроизводимой записи UI, не для production.
const maxFile = 1024 * 1024, maxStored = 4 * maxFile;
const objects = new Map([['preview.txt', Buffer.from('Streaming keeps the UI responsive.\nOnly the requested prefix is downloaded.\n'.repeat(900))]]);
let activeUploads = 0;
const storage = createSecureServer({ ...tls, allowHTTP1: true }, async (request, response) => {
  const headers = { 'access-control-allow-origin': 'https://127.0.0.1:5181',
    'access-control-allow-methods': 'PUT, GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-Upload-Length, Range',
    'access-control-expose-headers': 'Content-Length, ETag, Accept-Ranges, Content-Range', 'cache-control': 'no-store' };
  const reply = (status, body) => { if (!response.destroyed) { response.writeHead(status, { ...headers, 'content-type': 'application/json' }); response.end(JSON.stringify(body)); } };
  response.on('error', () => {});
  try {
    if (request.method === 'OPTIONS') { response.writeHead(204, headers).end(); return; }
    const path = new URL(request.url, 'https://127.0.0.1:19444').pathname;
    if (!path.startsWith('/objects/')) { reply(404, { committed: false }); return; }
    const objectKey = decodeURIComponent(path.slice('/objects/'.length));
    if (request.method === 'PUT') {
      if (activeUploads >= 2) { reply(429, { committed: false }); return; }
      activeUploads++;
      try {
      const chunks = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maxFile) { reply(413, { committed: false }); return; }
        chunks.push(chunk);
      }
      if (size !== Number(request.headers['x-upload-length'])) { reply(400, { committed: false }); return; }
      // A real delay before the fixture commits makes awaiting confirmation visible.
      // Настоящая задержка перед commit fixture позволяет увидеть ожидание подтверждения.
      await delay(1000);
      if (response.destroyed || request.aborted) return;
      const storedBytes = [...objects.values()].reduce((sum, bytes) => sum + bytes.length, 0);
      if (objects.size >= 8 && !objects.has(objectKey) || storedBytes - (objects.get(objectKey)?.length ?? 0) + size > maxStored) {
        reply(413, { committed: false }); return;
      }
      objects.set(objectKey, Buffer.concat(chunks, size));
      reply(201, { committed: true, key: objectKey, bytes: size, etag: `fixture-${size}` }); return;
      } finally { activeUploads--; }
    }
    const bytes = objects.get(objectKey);
    if (!bytes) { reply(404, { committed: false }); return; }
    if (request.method !== 'GET' && request.method !== 'HEAD') { reply(405, { committed: false }); return; }
    const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? '');
    if (request.headers.range && !range) { reply(416, { committed: false }); return; }
    const start = range ? Number(range[1]) : 0, end = range ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    if (start > end || start >= bytes.length) { reply(416, { committed: false }); return; }
    response.writeHead(range ? 206 : 200, { ...headers, 'content-type': 'text/plain', 'content-length': end - start + 1,
      etag: `fixture-${bytes.length}`, 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}) });
    if (request.method === 'HEAD') { response.end(); return; }
    for (let offset = start; offset <= end && !response.destroyed; offset += 8192) {
      response.write(bytes.subarray(offset, Math.min(offset + 8192, end + 1)));
      await delay(75);
    }
    response.end();
  } catch { if (!response.destroyed) reply(400, { committed: false }); }
});
const sockets = new Set();
for (const server of [web, storage]) {
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('error', error => { console.error(error.message); shutdown(); });
}
web.listen(5181, '127.0.0.1');
storage.listen(19444, '127.0.0.1', () => console.log('Visual demo https://127.0.0.1:5181 — bounded Node HTTP/2 memory fixture, NOT S3'));
function shutdown() { for (const socket of sockets) socket.destroy(); web.close(); storage.close(); objects.clear(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);
