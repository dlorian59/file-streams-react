import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const output = resolve(import.meta.dirname, '../output/playwright');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // Test-only picker: retain the small fixture so byte equality can be asserted.
    // Только тестовый диалог: сохраняем небольшой fixture для сравнения байтов.
    window.savedBytes = [];
    window.showSaveFilePicker = async () => ({ createWritable: async () => new WritableStream({
      write(chunk) { window.savedBytes.push(...chunk); }, close() { window.savedClosed = true; },
    }) });
  });
  await page.goto('https://127.0.0.1:5173/');
  const payload = Buffer.from('attachment from React to Spring\nПривет\n');
  await page.getByLabel('Выбрать файл').setInputFiles({ name: 'attachment.bin', mimeType: 'application/octet-stream', buffer: payload });
  await page.getByRole('button', { name: 'Загрузить', exact: true }).click();
  await page.getByTestId('commit').waitFor({ timeout: 15000 });
  assert.match(await page.getByTestId('commit').innerText(), new RegExp(`Сохранено: ${payload.length} байт`));
  await page.getByRole('button', { name: 'Скачать', exact: true }).click();
  await page.waitForFunction(() => window.savedClosed === true, { timeout: 15000 });
  assert.deepEqual(await page.evaluate(() => window.savedBytes), [...payload]);
  await page.getByRole('button', { name: 'Передать поток', exact: true }).click();
  const cancelSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Отмена передачи', exact: true }) });
  await cancelSection.locator('span').filter({ hasText: /[1-9]\d* B/ }).waitFor();
  await page.getByRole('button', { name: 'Остановить поток', exact: true }).click();
  await page.getByTestId('cancel-result').waitFor();
  assert.equal(await page.getByTestId('cancel-result').textContent(), 'ABORTED · unknown');
  const cancelledObjectStatus = await page.evaluate(async () => {
    const response = await fetch('https://127.0.0.1:19443/objects/imports%2Fcancel-known-length.bin', { cache: 'no-store' });
    await response.body?.cancel();
    return response.status;
  });
  assert.equal(cancelledObjectStatus, 404);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(output, 'attachments.png'), fullPage: true });
  const result = { transport: 'Chromium HTTPS/HTTP2 -> Spring Boot 4.1.2 test fixture',
    bytes: payload.length, uploadCommit: true, streamedDownloadEqual: true, picker: 'test-only writable sink',
    storage: 'bounded in-memory ObjectStreams fixture; NOT S3',
    cancellation: 'ABORTED with unknown outcome before EOF; fixture GET returned 404', errors };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
