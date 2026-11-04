import { TransferError } from '@59alex/file-streams';
import { russianLabels, TransferStatus, useFileUpload } from '@59alex/file-streams-react';

export function CancelableImport() {
  const transfer = useFileUpload({ objectsUrl: 'https://127.0.0.1:19443/objects', maxBytes: 1024 * 1024 });
  async function start() {
    let produced = 0, cancelled = false;
    // This artificial delay makes cancellation visible; it is not a throughput benchmark.
    // Искусственная задержка позволяет увидеть отмену; это не тест производительности.
    const source = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (cancelled) return;
        if (produced++ === 256) controller.close();
        else controller.enqueue(new Uint8Array(4096));
      },
      cancel() { cancelled = true; },
    });
    try {
      // Declare the known total so the server rejects an early EOF as a length mismatch.
      // Объявляем известный размер: сервер отклонит ранний EOF как несовпадение длины.
      await transfer.upload({ key: 'imports/cancel-known-length.bin', source, knownLength: 1024 * 1024 });
    } catch { /* TransferStatus shows the failure without claiming server rollback.
               * TransferStatus показывает ошибку, не утверждая, что сервер откатил запись. */ }
  }
  const error = transfer.state.status === 'failed' && transfer.state.error;
  return <section>
    <h2>Отмена передачи</h2>
    <p>Источник выдаёт данные постепенно. Можно остановить передачу до завершения.</p>
    <button type="button" onClick={() => { void start(); }} disabled={transfer.state.status === 'transferring'}>Передать поток</button>
    {transfer.state.status === 'transferring' && <button type="button" onClick={transfer.cancel}>Остановить поток</button>}
    <TransferStatus state={transfer.state} labels={russianLabels} />
    {error instanceof TransferError && <output data-testid="cancel-result">{error.code} · {error.uploadOutcome}</output>}
  </section>;
}
