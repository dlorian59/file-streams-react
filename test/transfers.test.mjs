import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { FileUpload, FileDownload, TransferStatus, useFileUpload, useFileDownload } from '../dist/index.js';

const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const config = { objectsUrl: 'https://objects.invalid/objects', maxBytes: 100, scope: 'alice' };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function mount(hook, options) {
  const element = document.createElement('div'); document.body.append(element);
  const root = createRoot(element); let current;
  function Harness(props) { current = hook(props.options); return null; }
  const render = async value => act(async () => { root.render(React.createElement(StrictMode, null,
    React.createElement(Harness, { options: value }))); });
  await render(options);
  return { get current() { return current; }, render, async close() { await act(async () => root.unmount()); element.remove(); } };
}

test('upload byte progress remains transferring until a matching commit arrives', async () => {
  const consumed = deferred(), response = deferred(); let requested;
  const fetch = async (url, init) => {
    requested = { url: String(url), method: init.method, length: init.headers.get('x-upload-length') };
    const reader = init.body.getReader(); let bytes = 0;
    for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; }
    consumed.resolve(bytes); return response.promise;
  };
  const app = await mount(useFileUpload, { ...config, fetch });
  try {
    let pending;
    await act(async () => { pending = app.current.uploadFile('ticket/1.txt', new Blob(['hello'])); await consumed.promise; });
    assert.equal(app.current.state.status, 'transferring');
    assert.equal(app.current.state.bytes, 5);
    assert.equal(requested.length, '5');
    assert.match(requested.url, /ticket%2F1.txt$/);
    await act(async () => { response.resolve(Response.json({ committed: true, key: 'ticket/1.txt', bytes: 5, etag: 'v1' }, { status: 201 })); await pending; });
    assert.equal(app.current.state.status, 'complete');
    assert.equal(app.current.state.result.committed, true);
  } finally { await app.close(); }
});

test('account change cancels upload and never publishes its old state to the new account', async () => {
  const started = deferred(); let cancelled = false, signal;
  const fetch = async (_url, init) => {
    signal = init.signal; started.resolve();
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  };
  const app = await mount(useFileUpload, { ...config, fetch });
  try {
    let outcome;
    await act(async () => {
      outcome = app.current.upload({ key: 'private', source: new ReadableStream({ cancel() { cancelled = true; } }) }).catch(e => e);
      await started.promise;
    });
    await app.render({ ...config, scope: 'bob', fetch });
    let error; await act(async () => { error = await outcome; });
    assert.equal(signal.aborted, true);
    assert.equal(cancelled, true);
    assert.equal(error.uploadOutcome, 'unknown');
    assert.equal(app.current.state.status, 'idle');
  } finally { await app.close(); }
});

test('unmount while choosing destination aborts a late sink without starting GET', async () => {
  const chosen = deferred(); let aborted = 0, requests = 0;
  const app = await mount(useFileDownload, { ...config, fetch: async () => { requests++; throw Error('unexpected request'); } });
  let result;
  await act(async () => { result = app.current.download('a', () => chosen.promise).catch(e => e); });
  await app.close();
  assert.equal((await result).code, 'ABORTED');
  chosen.resolve(new WritableStream({ abort() { aborted++; } }));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(aborted, 1); assert.equal(requests, 0);
});

test('download applies backpressure and reports complete only after destination close', async () => {
  const wrote = deferred(), finish = deferred(); let bytes = 0;
  const app = await mount(useFileDownload, { ...config, fetch: async () => new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-length': '3', etag: 'opaque', 'accept-ranges': 'bytes' },
  }) });
  try {
    let pending;
    await act(async () => { pending = app.current.download('a', new WritableStream({
      write(value) { bytes += value.length; }, close() { wrote.resolve(); return finish.promise; },
    })); await wrote.promise; });
    assert.equal(app.current.state.status, 'transferring'); assert.equal(bytes, 3);
    await act(async () => { finish.resolve(); await pending; });
    assert.equal(app.current.state.status, 'complete'); assert.equal(app.current.state.result.bytesWritten, 3);
  } finally { await app.close(); }
});

test('components render on the server without creating streams or starting requests', () => {
  const html = renderToString(React.createElement(FileUpload, { ...config, objectKey: 'a' }));
  assert.match(html, /type="file"/);
  const download = renderToString(React.createElement(FileDownload, { ...config, objectKey: 'a', destination: () => { throw Error('must not open on server'); } }));
  assert.match(download, /Download/);
  const status = renderToString(React.createElement(TransferStatus, { state: { status: 'transferring', bytes: 5, total: 5 } }));
  assert.match(status, /progress/); assert.doesNotMatch(status, /Complete/);
});

test('retained upload callbacks reject old scopes and file selection resets with account', async () => {
  const app = await mount(useFileUpload, config);
  try {
    const oldUpload = app.current.uploadFile;
    await app.render({ ...config, scope: 'bob' });
    await assert.rejects(oldUpload('old-account', new Blob(['secret'])), /old scope/);
    assert.equal(app.current.state.status, 'idle');
  } finally { await app.close(); }
  const element = document.createElement('div'); document.body.append(element);
  const root = createRoot(element);
  try {
    await act(async () => root.render(React.createElement(FileUpload, { ...config, objectKey: 'a' })));
    const input = element.querySelector('input');
    Object.defineProperty(input, 'files', { configurable: true, value: [new Blob(['secret'])] });
    await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
    assert.equal(element.querySelector('button').disabled, false);
    await act(async () => root.render(React.createElement(FileUpload, { ...config, scope: 'bob', objectKey: 'a' })));
    assert.notEqual(element.querySelector('input'), input);
    assert.equal(element.querySelector('button').disabled, true);
  } finally { await act(async () => root.unmount()); element.remove(); }
});
