import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { get } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'output/playwright/visuals');
const assets = resolve(root, 'assets/visuals');
await mkdir(output, { recursive: true }); await mkdir(assets, { recursive: true });
const server = spawn(process.execPath, ['scripts/visual-demo.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', chunk => { serverLog += chunk; }); server.stderr.on('data', chunk => { serverLog += chunk; });
const ready = () => new Promise(resolveReady => {
  const request = get('https://127.0.0.1:5181', { rejectUnauthorized: false }, response => { response.resume(); resolveReady(response.statusCode === 200); });
  request.on('error', () => resolveReady(false));
});
let browser;
const results = [];
const names = {
  en: { upload: 'Upload', download: 'Download', start: 'Start upload', stop: 'Cancel upload', check: 'Check object', retry: 'Retry with a fresh stream', read: 'Read prefix', submit: 'Attach file' },
  ru: { upload: 'Загрузить', download: 'Скачать', start: 'Передать поток', stop: 'Отменить передачу', check: 'Проверить объект', retry: 'Повторить с новым потоком', read: 'Прочитать начало', submit: 'Прикрепить файл' },
};
try {
  for (let attempt = 0; attempt < 80 && !await ready(); attempt++) {
    if (server.exitCode !== null) throw Error(serverLog);
    await delay(100);
  }
  if (!await ready()) throw Error(`Visual server unavailable: ${serverLog}`);
  browser = await chromium.launch({ headless: true });
  for (const language of ['en', 'ru']) {
    for (const scenario of ['components', 'upload', 'download', 'action']) {
      const name = `${scenario}-${language}`;
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 800, height: 680 },
        recordVideo: { dir: output, size: { width: 800, height: 680 } }, reducedMotion: 'reduce', locale: language === 'ru' ? 'ru-RU' : 'en-US' });
      const page = await context.newPage(); const errors = []; const states = new Set();
      page.on('pageerror', error => errors.push(error.message));
      // Recorder-only cursor follows real mouse events; it never changes transfer state.
      // Курсор записи следует реальным событиям мыши; состояние передачи он не меняет.
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const cursor = document.createElement('div');
          cursor.style.cssText = 'position:fixed;z-index:9999;left:-30px;top:-30px;width:18px;height:18px;border:2px solid #2454a6;border-radius:50%;background:#b5d0ff88;pointer-events:none;transform:translate(-50%,-50%)';
          document.body.append(cursor);
          document.addEventListener('pointermove', event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
          document.addEventListener('pointerdown', () => { cursor.style.background = '#2454a6'; });
          document.addEventListener('pointerup', () => { cursor.style.background = '#b5d0ff88'; });
        });
      });
      await page.goto(`https://127.0.0.1:5181/?scenario=${scenario}&lang=${language}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      const payload = Buffer.alloc(256 * 1024, 65);
      const labels = names[language];
      async function click(label) {
        const button = page.getByRole('button', { name: label, exact: true });
        const box = await button.boundingBox(); assert.ok(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
        await delay(350); await page.mouse.down(); await delay(150); await page.mouse.up();
      }
      async function chooseFile() {
        const input = page.locator('input[type=file]'); const box = await input.boundingBox(); assert.ok(box);
        await page.mouse.move(box.x + 45, box.y + box.height / 2, { steps: 8 });
        await delay(300);
        const chooser = page.waitForEvent('filechooser'); await input.click();
        await (await chooser).setFiles({ name: 'architecture-notes.txt', mimeType: 'text/plain', buffer: payload });
        assert.match(await input.inputValue(), /architecture-notes\.txt$/);
        await delay(950); states.add('file-selected');
      }
      async function observeProgress() {
        await page.waitForFunction(() => [...document.querySelectorAll('progress')].some(p => p.value > 0 && p.value < p.max), undefined, { timeout: 10000 }).catch(async error => { await page.screenshot({ path: resolve(output, 'failed.png') }); console.error(await page.locator('main').innerText()); throw error; });
        states.add('intermediate-byte-progress');
      }
      async function observeAwaiting() {
        await page.waitForFunction(() => [...document.querySelectorAll('progress')].some(p => p.value > 0 && p.value === p.max), undefined, { timeout: 10000 });
        assert.equal(await page.locator('[data-testid=commit], [data-testid=action-commit]').count(), 0);
        states.add('all-bytes-read-before-commit'); await delay(450);
      }
      await delay(650);
      if (scenario === 'components') {
        assert.equal(await page.getByRole('button', { name: labels.download, exact: true }).isDisabled(), true);
        await chooseFile(); await click(labels.upload); await observeAwaiting();
        await page.getByTestId('commit').waitFor(); states.add('confirmed-upload'); await delay(850);
        await click(labels.download); await observeProgress(); await page.getByTestId('downloaded').waitFor(); states.add('closed-destination');
        // Read the small OPFS fixture only for test verification, never in the example download flow.
        // Небольшой OPFS fixture читается целиком только для проверки, не в примере скачивания.
        const saved = await page.evaluate(async () => {
          const directory = await navigator.storage.getDirectory();
          const file = await (await directory.getFileHandle('visual-attachment.bin')).getFile();
          const bytes = new Uint8Array(await file.arrayBuffer()); return { size: bytes.length, allA: bytes.every(byte => byte === 65) };
        });
        assert.deepEqual(saved, { size: payload.length, allA: true });
      } else if (scenario === 'upload') {
        await click(labels.start); await observeProgress(); await delay(400); await click(labels.stop);
        await page.getByTestId('outcome').waitFor(); assert.match(await page.getByTestId('outcome').textContent(), /ABORTED · unknown/);
        assert.equal(await page.getByRole('button', { name: labels.retry, exact: true }).isDisabled(), true);
        states.add('cancelled-unknown'); await delay(1100);
        await page.screenshot({ path: resolve(assets, `${name}-cancelled.png`) });
        await click(labels.check); await page.waitForFunction(() => document.querySelector('[data-testid=checked]')?.textContent?.includes('404'));
        states.add('checked-absent'); await delay(700); await click(labels.retry);
        await page.getByTestId('hook-commit').waitFor(); states.add('explicit-retry-confirmed');
      } else if (scenario === 'download') {
        await click(labels.read); await observeProgress(); await page.getByTestId('range').waitFor();
        assert.match(await page.getByTestId('range').textContent(), /HTTP 206 · 32768 B/);
        assert.match(await page.getByTestId('preview').textContent(), /Streaming keeps/); states.add('validated-range-preview');
      } else {
        await chooseFile(); await click(labels.submit);
        assert.equal(await page.getByRole('button', { name: labels.submit, exact: true }).isDisabled(), true);
        await observeAwaiting(); await page.getByTestId('action-commit').waitFor();
        assert.equal(await page.locator('input[type=file]').inputValue(), ''); states.add('confirmed-action-and-reset');
      }
      await page.mouse.move(760, 625, { steps: 8 }); await delay(1200);
      await page.screenshot({ path: resolve(assets, `${name}.png`) });
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const video = page.video(); await context.close();
      const path = await video.path();
      const gif = resolve(assets, `${name}.gif`);
      // Encode the real recording at a modest frame rate and palette, without inventing UI frames.
      // Кодируем настоящую запись с умеренной частотой и палитрой, не дорисовывая состояния UI.
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path, '-filter_complex',
        '[0:v]fps=8,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
        '-loop', '0', gif]);
      const size = (await stat(gif)).size; assert.ok(size < 2 * 1024 * 1024, `${name} GIF too large`);
      results.push({ name, bytes: size, states: [...states], errors }); console.log(`${name}: ${size} bytes; ${[...states].join(', ')}`);
    }
  }
  await writeFile(resolve(output, 'verification.json'), JSON.stringify({ backend: 'bounded Node HTTP/2 memory fixture; not Spring or S3', results }, null, 2) + '\n');
} finally {
  if (browser) for (const context of browser.contexts()) await context.close();
  await browser?.close(); server.kill('SIGTERM');
  await new Promise(resolveExit => { if (server.exitCode !== null) resolveExit(); else server.once('exit', resolveExit); });
}
