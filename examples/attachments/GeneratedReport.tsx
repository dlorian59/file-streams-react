import { TransferStatus, useFileUpload } from '@59alex/file-streams-react';

export function GeneratedReport() {
  const upload = useFileUpload({ objectsUrl: 'https://127.0.0.1:19443/objects', maxBytes: 1024 * 1024 });
  async function generate() {
    let row = 0;
    const encoder = new TextEncoder();
    // Produce rows only when the transport requests them; the full CSV is never assembled.
    // Создаём строки по запросу транспорта; целый CSV не накапливается в памяти.
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (row === 1000) controller.close();
        else controller.enqueue(encoder.encode(`${row++},ready\n`));
      },
    });
    try {
      // Unknown length is permitted; the byte limit still applies during reading.
      // Неизвестная длина допустима; ограничение объёма действует во время чтения.
      await upload.upload({ key: 'reports/demo.csv', source, contentType: 'text/csv' });
    } catch { /* The status component displays the error.
               * Компонент состояния показывает ошибку. */ }
  }
  return <section>
    <button type="button" disabled={upload.state.status === 'transferring'} onClick={() => { void generate(); }}>Generate CSV</button>
    {upload.state.status === 'transferring' && <button type="button" onClick={upload.cancel}>Cancel</button>}
    <TransferStatus state={upload.state} />
  </section>;
}
