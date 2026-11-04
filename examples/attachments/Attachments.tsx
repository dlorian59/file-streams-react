import { useEffect, useState } from 'react';
import { FileDownload, FileUpload, russianLabels } from '@59alex/file-streams-react';
import { CancelableImport } from './CancelableImport.js';
import type { UploadCommit } from '@59alex/file-streams';

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
    createWritable(): Promise<WritableStream<Uint8Array>>;
  }>;
}

export function Attachments() {
  const [saved, setSaved] = useState<UploadCommit>();
  const [canSave, setCanSave] = useState(false);
  useEffect(() => { setCanSave(typeof (window as SavePickerWindow).showSaveFilePicker === 'function'); }, []);
  // Both components use the raw PUT/GET endpoint configured by the Spring starter.
  // Оба компонента используют raw PUT/GET endpoint, настроенный Spring-стартером.
  const options = { objectsUrl: 'https://127.0.0.1:19443/objects', maxBytes: 8 * 1024 * 1024,
    scope: 'demo-account', credentials: 'omit' as const, labels: russianLabels };

  async function destination() {
    const picker = (window as SavePickerWindow).showSaveFilePicker;
    if (!picker) throw new Error('Supply a streaming destination supported by this browser');
    // Open the picker from the button gesture, then stream directly to its writable file.
    // Открываем диалог по нажатию кнопки, затем пишем поток прямо в выбранный файл.
    const file = await picker.call(window, { suggestedName: 'attachment.bin' });
    return file.createWritable();
  }

  return <main>
    <h1>Вложение к заявке</h1>
    <p>Выберите файл до 8 МиБ. Скачивание станет доступно после подтверждения сервера.</p>
    {/* The application supplies a logical key; the server must authorize this key in production. */}
    {/* Приложение передаёт логический ключ; в production сервер должен проверить доступ к нему. */}
    <FileUpload {...options} objectKey="tickets/demo/attachment.bin" onCommitted={setSaved} />
    {saved && <>
      {/* A 100% read counter alone cannot enable this action; only a validated commit can. */}
      {/* Счётчик чтения 100% не включает это действие; нужно подтверждение сохранения. */}
      <p data-testid="commit">Сохранено: {saved.bytes} байт · ETag {saved.etag}</p>
      <FileDownload {...options} objectKey={saved.key} destination={destination} disabled={!canSave} />
      {!canSave && <p>Браузер не поддерживает диалог потокового сохранения. Передайте свой WritableStream в hook.</p>}
    </>}
    <CancelableImport />
  </main>;
}
