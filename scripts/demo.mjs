import { build } from 'esbuild';
import { createServer } from 'node:https';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(resolve(root, 'output/demo'), { recursive: true });
await build({ entryPoints: [resolve(root, 'examples/attachments/main.tsx')], bundle: true, format: 'esm',
  sourcemap: true, outfile: resolve(root, 'output/demo/main.js') });
const cert = process.env.DEMO_TLS_CERT ?? resolve(root, '../file-streams-spring-boot-starter/build/tls/cert.pem');
const key = process.env.DEMO_TLS_KEY ?? resolve(root, '../file-streams-spring-boot-starter/build/tls/key.pem');
const server = createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (request, response) => {
  const file = request.url === '/main.js' ? 'output/demo/main.js' : request.url === '/main.js.map' ? 'output/demo/main.js.map'
    : request.url === '/' ? 'examples/attachments/index.html' : undefined;
  if (!file) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript');
  response.end(readFileSync(resolve(root, file)));
});
server.listen(5173, '127.0.0.1', () => console.log('Attachment demo: https://127.0.0.1:5173/'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
