import { useState } from 'react';
import { TransferStatus, useFileDownload } from '@59alex/file-streams-react';

export function PartialPreview({ objectKey }: { objectKey: string }) {
  const [text, setText] = useState('');
  const download = useFileDownload({ objectsUrl: 'https://127.0.0.1:19443/objects', maxBytes: 4096, scope: objectKey });
  async function preview() {
    let boundedText = '';
    const decoder = new TextDecoder();
    // Only the requested 4 KiB prefix is retained, not the complete remote file.
    // Сохраняем только запрошенный префикс 4 КиБ, а не весь удалённый файл.
    const destination = new WritableStream<Uint8Array>({
      write(chunk) { boundedText += decoder.decode(chunk, { stream: true }); },
      close() { boundedText += decoder.decode(); },
    });
    try {
      // The base client verifies 206, Content-Range, ETag and the actual byte count.
      // Базовый клиент проверяет 206, Content-Range, ETag и реальное число байт.
      await download.download(objectKey, destination, { start: 0, end: 4095 });
      setText(boundedText);
    } catch { /* Errors remain available in download.state.
               * Ошибки доступны в download.state. */ }
  }
  return <section>
    <button type="button" disabled={download.state.status === 'transferring'} onClick={() => { void preview(); }}>Read prefix</button>
    <TransferStatus state={download.state} />
    <pre>{text}</pre>
  </section>;
}
