import { useEffect, useId, useRef, useState } from 'react';
import { fileProfiles, TransferError, type FileProfile, type UploadCommit, type DownloadResult } from '@59alex/file-streams';
import { englishLabels, russianLabels, TransferStatus } from './components.js';
import { useFileDownload, useFileUpload, type Destination, type FileStreamsOptions } from './hooks.js';

export type UploadReconciliation = 'absent' | 'present' | 'unknown';
export interface FileAttachmentProps extends Omit<FileStreamsOptions, 'objectsUrl' | 'maxBytes' | 'scope'> {
  readonly objectKey: string;
  readonly existingFile?: UploadCommit;
  readonly scope: string;
  readonly objectsUrl?: string;
  readonly profile?: FileProfile;
  readonly maxBytes?: number;
  readonly language?: 'en' | 'ru';
  readonly accept?: string;
  readonly fileName?: string;
  readonly destination?: Destination;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onCommitted?: (commit: UploadCommit) => void;
  readonly onComplete?: (result: DownloadResult) => void;
  /** Resolve through application-owned storage/version state, not by assuming cancellation rolled back.
   * Проверяйте состояние/версию через приложение, не предполагая откат после отмены. */
  readonly reconcileUpload?: (key: string, signal: AbortSignal) => Promise<UploadReconciliation>;
}

interface PickerWindow extends Window {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;
}

/** Call this destination from a user gesture; no complete-file buffer is created.
 * Вызывайте назначение по действию пользователя; полного буфера файла нет. */
export function saveFileDestination(fileName = 'download.bin'): Destination {
  return async () => {
    const browser = typeof window === 'undefined' ? undefined : window as PickerWindow;
    if (!browser?.showSaveFilePicker) throw new TransferError('UNSUPPORTED', 'Supply a WritableStream destination supported by this browser');
    const handle = await browser.showSaveFilePicker({ suggestedName: fileName });
    return handle.createWritable();
  };
}

export function FileAttachment(props: FileAttachmentProps) {
  if (props.existingFile && props.existingFile.key !== props.objectKey) throw new TypeError('existingFile.key must match objectKey');
  const profile = props.profile ?? 'attachments';
  if (!Object.hasOwn(fileProfiles, profile)) throw new TypeError('Unknown file profile');
  const maxBytes = props.maxBytes ?? fileProfiles[profile].maxBytes;
  const endpoint = props.objectsUrl ?? '/objects';
  const objectsUrl = typeof window === 'undefined' ? endpoint : new URL(endpoint, window.location.href).href;
  // Remount the owned UI when authorization or object identity changes; stale callbacks cannot cross accounts.
  // При смене доступа или объекта пересоздаём UI; старые callbacks не переходят между аккаунтами.
  const identity = JSON.stringify([objectsUrl, props.scope, props.objectKey, maxBytes, props.existingFile?.etag]);
  return <OwnedAttachment key={identity} {...props} objectsUrl={objectsUrl} maxBytes={maxBytes} />;
}

function OwnedAttachment(props: FileAttachmentProps & { objectsUrl: string; maxBytes: number }) {
  const labels = props.language === 'ru' ? russianLabels : englishLabels;
  const text = props.language === 'ru' ? {
    title: 'Вложение', retry: 'Повторить загрузку', check: 'Проверить результат', checking: 'Проверяем результат…',
    present: 'Объект уже существует. Проверьте его в приложении перед перезаписью.',
    unknown: 'Результат пока неизвестен. Повторная загрузка заблокирована.',
    absent: 'Приложение подтвердило отсутствие объекта. Можно повторить с новым потоком.',
    unsupported: 'Для скачивания в этом браузере передайте потоковое назначение destination.',
    uploaded: 'Файл подтверждён сервером', downloaded: 'Файл записан в назначение',
  } : {
    title: 'Attachment', retry: 'Retry upload', check: 'Check upload result', checking: 'Checking result…',
    present: 'The object exists. Inspect it in your application before overwriting.',
    unknown: 'The outcome is still unknown. Another upload is blocked.',
    absent: 'Your application confirmed absence. You can retry with a fresh stream.',
    unsupported: 'Supply a streaming destination to enable downloads in this browser.',
    uploaded: 'File confirmed by the server', downloaded: 'File written to the destination',
  };
  const upload = useFileUpload(props);
  const download = useFileDownload(props);
  const [file, setFile] = useState<File>();
  const [pickerAvailable, setPickerAvailable] = useState(false);
  const [reconciliation, setReconciliation] = useState<UploadReconciliation | 'checking'>();
  const checking = useRef<AbortController | undefined>(undefined);
  const notifiedUpload = useRef<UploadCommit | undefined>(undefined);
  const notifiedDownload = useRef<DownloadResult | undefined>(undefined);
  useEffect(() => {
    setPickerAvailable(typeof (window as PickerWindow).showSaveFilePicker === 'function');
    return () => { checking.current?.abort(); };
  }, []);
  useEffect(() => {
    if (upload.state.status === 'complete' && notifiedUpload.current !== upload.state.result) {
      notifiedUpload.current = upload.state.result;
      props.onCommitted?.(upload.state.result);
    }
  }, [upload.state, props.onCommitted]);
  useEffect(() => {
    if (download.state.status === 'complete' && notifiedDownload.current !== download.state.result) {
      notifiedDownload.current = download.state.result;
      props.onComplete?.(download.state.result);
    }
  }, [download.state, props.onComplete]);
  const busy = upload.state.status === 'transferring' || download.state.status === 'transferring';
  const uncertain = upload.state.status === 'failed' && upload.state.error instanceof TransferError && upload.state.error.uploadOutcome === 'unknown';
  const blocked = uncertain && reconciliation !== 'absent';
  const committed = upload.state.status === 'complete' || !file && props.existingFile !== undefined;
  const id = useId();
  async function send() {
    if (!file || busy || blocked || props.disabled) return;
    setReconciliation(undefined);
    download.reset();
    try { await upload.uploadFile(props.objectKey, file); }
    catch { /* TransferStatus preserves the error and uncertain outcome.
             * TransferStatus сохраняет ошибку и неизвестный результат. */ }
  }
  async function receive() {
    if (!committed || busy || props.disabled) return;
    // The factory opens the picker synchronously from the click path, before awaiting network work.
    // Фабрика открывает picker прямо из обработчика нажатия, до ожидания сети.
    const destination = props.destination ?? saveFileDestination(props.fileName ?? file?.name ?? props.objectKey.split('/').pop());
    try { await download.download(props.objectKey, destination); }
    catch { /* The hook exposes picker/transport/sink failures.
             * Hook показывает ошибки picker, транспорта и sink. */ }
  }
  async function reconcile() {
    if (!props.reconcileUpload || checking.current || props.disabled) return;
    const controller = new AbortController(); checking.current = controller; setReconciliation('checking');
    try {
      const result = await props.reconcileUpload(props.objectKey, controller.signal);
      if (!controller.signal.aborted) {
        if (result === 'absent') upload.reset();
        setReconciliation(result === 'absent' || result === 'present' ? result : 'unknown');
      }
    } catch { if (!controller.signal.aborted) setReconciliation('unknown'); }
    finally { if (checking.current === controller) checking.current = undefined; }
  }
  return <section className={['fs-attachment', props.className].filter(Boolean).join(' ')} data-file-attachment
    data-upload-state={upload.state.status} data-download-state={download.state.status}>
    <h2>{text.title}</h2>
    <label htmlFor={id}>{labels.choose}</label>
    <input id={id} type="file" accept={props.accept} disabled={props.disabled || busy || blocked}
      onChange={event => { upload.reset(); download.reset(); setReconciliation(undefined); setFile(event.currentTarget.files?.[0]); }} />
    <div className="fs-attachment-actions">
      <button type="button" disabled={!file || busy || blocked || props.disabled} onClick={() => { void send(); }}>
        {upload.state.status === 'failed' || reconciliation === 'absent' ? text.retry : labels.upload}</button>
      {upload.state.status === 'transferring' && <button type="button" onClick={upload.cancel}>{labels.cancel}</button>}
      <button type="button" disabled={!committed || busy || props.disabled || !props.destination && !pickerAvailable}
        onClick={() => { void receive(); }}>{labels.download}</button>
      {download.state.status === 'transferring' && <button type="button" onClick={download.cancel}>{labels.cancel}</button>}
    </div>
    <TransferStatus state={upload.state} labels={{ ...labels, complete: text.uploaded }} />
    <TransferStatus state={download.state} labels={{ ...labels, complete: text.downloaded }} />
    {uncertain && props.reconcileUpload && <button type="button" disabled={props.disabled || reconciliation === 'checking'}
      onClick={() => { void reconcile(); }}>{text.check}</button>}
    {reconciliation && <p role="status">{text[reconciliation]}</p>}
    {!props.destination && !pickerAvailable && <p className="fs-attachment-note">{text.unsupported}</p>}
  </section>;
}
