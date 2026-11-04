import { TransferStatus, russianLabels } from '@59alex/file-streams-react';
import { useFileUploadAction } from '@59alex/file-streams-react/react19';

export function ActionAttachment({ accountId }: { accountId: string }) {
  const upload = useFileUploadAction({ objectsUrl: 'https://127.0.0.1:19443/objects',
    scope: accountId, objectKey: 'tickets/demo/action-attachment.bin', maxBytes: 8 * 1024 * 1024 });
  // The native Action supplies FormData; only its File stream becomes the raw PUT body.
  // Нативный Action передаёт FormData; телом raw PUT становится только поток File.
  return <section>
    <h2>Вложение через React 19 Action</h2>
    <form key={accountId} action={upload.formAction}>
      <label>Файл <input name="file" type="file" required disabled={upload.isPending} /></label>
      <button type="submit" disabled={upload.isPending}>Отправить вложение</button>
      {upload.isPending && <button type="button" onClick={upload.cancel}>Отменить</button>}
      <TransferStatus state={upload.state} labels={russianLabels} />
      {/* While pending, the last Action result still describes the previous attempt: hide it. */}
      {/* Во время ожидания результат относится к предыдущей попытке: скрываем его. */}
      {!upload.isPending && upload.result.status === 'committed' && <p>Сохранено {upload.result.commit.bytes} байт</p>}
      {!upload.isPending && upload.result.status === 'failed' && upload.state.status !== 'failed' &&
        <p role="alert">Выберите файл перед отправкой.</p>}
    </form>
    <p>После попытки React очищает поле файла. Для новой попытки выберите файл снова; при неизвестном результате сначала проверьте сервер.</p>
  </section>;
}
