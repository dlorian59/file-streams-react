import { useState } from 'react';
import { TransferStatus, useFileDownload } from '@59alex/file-streams-react';
import { options } from './transport.js';
import { messages, type Language } from './text.js';

export function HookDownload({ language }: { language: Language }) {
  const text = messages(language);
  const download = useFileDownload({ ...options, maxBytes: 32768 });
  const [preview, setPreview] = useState('');
  async function read() {
    setPreview('');
    let prefix = '';
    const decoder = new TextDecoder();
    // Keep only the requested 32 KiB, not the complete object; await validated sink close.
    // Храним только запрошенные 32 КиБ, не весь объект; ожидаем проверенного закрытия sink.
    const destination = new WritableStream<Uint8Array>({
      write(chunk) { prefix += decoder.decode(chunk, { stream: true }); },
      close() { prefix += decoder.decode(); },
    });
    try {
      await download.download('preview.txt', destination, { start: 0, end: 32767 });
      setPreview(prefix.split('\n').slice(0, 3).join('\n'));
    } catch { /* TransferStatus shows errors.
               * TransferStatus показывает ошибки. */ }
  }
  return <>
    <h1>{text.preview}</h1><p className="intro">{text.previewHint}</p>
    <article><h2>useFileDownload + TransferStatus</h2>
      <button disabled={download.state.status === 'transferring'} onClick={() => { void read(); }}>{text.read}</button>
      <TransferStatus state={download.state} labels={text.labels} />
      <pre data-testid="preview">{preview || 'Range: bytes=0–32767'}</pre>
      {download.state.status === 'complete' && <p data-testid="range">HTTP 206 · {download.state.result.bytesWritten} B · ETag {download.state.result.etag}</p>}
    </article>
  </>;
}
