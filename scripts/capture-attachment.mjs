import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { get } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'output/playwright/attachment');
const assets = resolve(root, 'assets/visuals');
await mkdir(output, { recursive: true }); await mkdir(assets, { recursive: true });
const probe = url => new Promise(done => { const request = get(url, { rejectUnauthorized: false }, response => { response.resume(); done(response.statusCode); }); request.on('error', () => done(0)); });
if (await probe('https://127.0.0.1:19443/example/status') !== 200) throw Error('Start the paired Spring S3 example on 19443 first; see docs/integration/en.md');
const server = spawn(process.execPath, ['scripts/demo.mjs', '--spring'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; server.stdout.on('data', chunk => logs += chunk); server.stderr.on('data', chunk => logs += chunk);
let browser; const results = [];
try {
  for (let attempt = 0; attempt < 80 && await probe('https://127.0.0.1:5173') !== 200; attempt++) {
    if (server.exitCode !== null) throw Error(logs); await delay(100);
  }
  browser = await chromium.launch({ headless: true });
  for (const language of ['en', 'ru']) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 800, height: 660 }, recordVideo: { dir: output, size: { width: 800, height: 660 } } });
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      // Capture-only pacing changes timing of real bytes, not responses, progress or commit values.
      // Задержка записи меняет время передачи реальных байтов, но не ответы, прогресс или commit.
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        if (!(init?.body instanceof ReadableStream)) return nativeFetch(input, init);
        const body = init.body.pipeThrough(new TransformStream({ async transform(chunk, controller) {
          for (let offset = 0; offset < chunk.length; offset += 8192) {
            await new Promise(resolve => setTimeout(resolve, 70));
            if (init.signal?.aborted) throw init.signal.reason;
            controller.enqueue(chunk.subarray(offset, offset + 8192));
          }
        } }));
        return nativeFetch(input, { ...init, body });
      };
      // Replace only the OS dialog in headless recording; its destination is a real OPFS writable file.
      // В headless заменяем только системный диалог; назначение — настоящий writable-файл OPFS.
      window.showSaveFilePicker = async () => {
        window.pickerHadActivation = navigator.userActivation.isActive;
        const directory = await navigator.storage.getDirectory();
        return directory.getFileHandle('ready-attachment.txt', { create: true });
      };
      document.addEventListener('DOMContentLoaded', () => {
        const cursor = document.createElement('div'); cursor.style.cssText = 'position:fixed;z-index:9999;left:-30px;top:-30px;width:18px;height:18px;border:2px solid #2454a6;border-radius:50%;background:#b5d0ff88;pointer-events:none;transform:translate(-50%,-50%)'; document.body.append(cursor);
        document.addEventListener('pointermove', event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
        document.addEventListener('pointerdown', () => cursor.style.background = '#2454a6');
        document.addEventListener('pointerup', () => cursor.style.background = '#b5d0ff88');
      });
    });
    await page.goto(`https://127.0.0.1:5173/?lang=${language}`);
    await page.locator('[data-file-attachment]').waitFor();
    const upload = language === 'en' ? 'Upload' : 'Загрузить'; const download = language === 'en' ? 'Download' : 'Скачать';
    assert.equal(await page.getByRole('button', { name: download, exact: true }).isDisabled(), true);
    const input = page.locator('input[type=file]'); const fileBox = await input.boundingBox();
    await page.mouse.move(fileBox.x + 40, fileBox.y + 15, { steps: 10 }); await delay(600);
    const chooser = page.waitForEvent('filechooser'); await input.click();
    const bytes = Buffer.alloc(128 * 1024, 65);
    await (await chooser).setFiles({ name: 'ticket-specification.txt', mimeType: 'text/plain', buffer: bytes });
    assert.match(await input.inputValue(), /ticket-specification.txt$/); await delay(900);
    async function click(name) { const box = await page.getByRole('button', { name, exact: true }).boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 }); await delay(350); await page.mouse.down(); await delay(150); await page.mouse.up(); }
    await click(upload);
    await page.waitForFunction(() => document.querySelector('[data-file-attachment]')?.getAttribute('data-upload-state') === 'transferring');
    assert.equal(await page.getByRole('button', { name: download, exact: true }).isDisabled(), true);
    await page.waitForFunction(() => document.querySelector('[data-file-attachment]')?.getAttribute('data-upload-state') === 'complete');
    await delay(1100); await click(download);
    await page.waitForFunction(() => document.querySelector('[data-file-attachment]')?.getAttribute('data-download-state') === 'complete');
    const saved = await page.evaluate(async () => {
      const directory = await navigator.storage.getDirectory(); const file = await (await directory.getFileHandle('ready-attachment.txt')).getFile();
      const data = new Uint8Array(await file.arrayBuffer()); return { bytes: data.length, equal: data.every(value => value === 65), activated: window.pickerHadActivation };
    });
    assert.deepEqual(saved, { bytes: bytes.length, equal: true, activated: true }); assert.deepEqual(errors, []);
    await page.mouse.move(760, 610, { steps: 8 }); await delay(1300);
    await page.screenshot({ path: resolve(assets, `attachment-spring-${language}.png`) });
    const video = page.video(); await context.close(); const path = await video.path(); const gif = resolve(assets, `attachment-spring-${language}.gif`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path, '-filter_complex', '[0:v]fps=8,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', gif]);
    const size = (await stat(gif)).size; assert.ok(size < 2 * 1024 * 1024);
    results.push({ language, gifBytes: size, objectKey: `demo-account:ticket-visual-${language}.txt`, ...saved, errors });
    console.log(JSON.stringify(results.at(-1)));
  }
  await writeFile(resolve(output, 'verification.json'), JSON.stringify({ backend: 'paired Spring WebFlux example + configured S3 endpoint (recorded with Garage)', results }, null, 2) + '\n');
} finally {
  if (browser) for (const context of browser.contexts()) await context.close();
  await browser?.close(); server.kill('SIGTERM');
  await new Promise(done => { if (server.exitCode !== null) done(); else server.once('exit', done); });
}
