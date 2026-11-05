import { useState } from 'react';
import { TransferError, objectUrl } from '@59alex/file-streams';
import { TransferStatus, useFileUpload } from '@59alex/file-streams-react';
import { options, objectsUrl } from './transport.js';
import { messages, type Language } from './text.js';

export function HookUpload({ language }: { language: Language }) {
  const text = messages(language);
  const transfer = useFileUpload(options);
  const [checked, setChecked] = useState<'absent' | 'present' | 'checking'>();
  const key = `visual/import-${language}.bin`;
  async function start() {
    setChecked(undefined);
    let chunks = 0, cancelled = false;
    // Every explicit attempt gets a fresh source; no one-shot stream is replayed.
    // Каждая явная попытка получает новый источник; одноразовый поток не переигрывается.
    const source = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise(resolve => setTimeout(resolve, 80));
        if (cancelled) return;
        if (chunks++ === 24) controller.close();
        else controller.enqueue(new Uint8Array(8192));
      }, cancel() { cancelled = true; },
    });
    try { await transfer.upload({ key, source, knownLength: 24 * 8192 }); }
    catch { /* The original error remains in transfer.state.
             * Исходная ошибка остаётся в transfer.state. */ }
  }
  async function check() {
    setChecked('checking');
    try {
      // This fixture offers HEAD; real applications reconcile their own object/version state.
      // Fixture поддерживает HEAD; реальное приложение сверяет своё состояние/версию объекта.
      const response = await fetch(objectUrl(objectsUrl, key), { method: 'HEAD' });
      setChecked(response.status === 404 ? 'absent' : 'present');
    } catch { setChecked('present'); }
  }
  const busy = transfer.state.status === 'transferring';
  const failed = transfer.state.status === 'failed';
  const error = transfer.state.status === 'failed' ? transfer.state.error : undefined;
  return <>
    <h1>{text.hook}</h1><p className="intro">{text.hookHint}</p>
    <article><h2>useFileUpload + TransferStatus</h2>
      <button disabled={busy || failed && checked !== 'absent'} onClick={() => { void start(); }}>{failed ? text.retry : text.start}</button>
      {busy && <button className="secondary" onClick={transfer.cancel}>{text.stop}</button>}
      {failed && <button className="secondary" disabled={checked === 'checking'} onClick={() => { void check(); }}>{text.check}</button>}
      <TransferStatus state={transfer.state} labels={text.labels} />
      {error instanceof TransferError && <p className="code" data-testid="outcome">{text.code}: {error.code} · {error.uploadOutcome}</p>}
      {checked && <p data-testid="checked">{text[checked]}</p>}
      {transfer.state.status === 'complete' && <p data-testid="hook-commit">{text.accepted}: {transfer.state.result.bytes} B</p>}
    </article>
    <p className="note">{text.progress}</p>
  </>;
}
