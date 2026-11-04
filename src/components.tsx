import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { TransferError, type ByteRange, type DownloadResult, type UploadCommit } from '@59alex/file-streams';
import { useFileDownload, useFileUpload, type Destination, type FileStreamsOptions } from './hooks.js';
import type { TransferState } from './operation.js';

export interface TransferLabels {
  readonly choose: string;
  readonly upload: string;
  readonly download: string;
  readonly cancel: string;
  readonly progress: string;
  readonly complete: string;
  readonly failed: string;
  readonly unknown: string;
}
export const englishLabels: TransferLabels = Object.freeze({ choose: 'Choose a file', upload: 'Upload',
  download: 'Download', cancel: 'Cancel', progress: 'Bytes transferred', complete: 'Complete',
  failed: 'Transfer failed', unknown: 'The server may have saved the file. Check its state before retrying.' });
export const russianLabels: TransferLabels = Object.freeze({ choose: 'Выбрать файл', upload: 'Загрузить',
  download: 'Скачать', cancel: 'Отменить', progress: 'Передано байт', complete: 'Готово',
  failed: 'Передача не завершена', unknown: 'Сервер мог сохранить файл. Проверьте состояние перед повтором.' });

export interface TransferStatusProps<Result> {
  readonly state: TransferState<Result>;
  readonly labels?: TransferLabels;
  readonly renderError?: (error: unknown) => ReactNode;
}
export function TransferStatus<Result>({ state, labels = englishLabels, renderError }: TransferStatusProps<Result>) {
  if (state.status === 'idle') return null;
  const error = state.status === 'failed' ? state.error : undefined;
  const unknown = error instanceof TransferError && error.uploadOutcome === 'unknown';
  return <div data-transfer-status={state.status}>
    {state.status === 'transferring' && <>
      <progress aria-label={labels.progress} value={state.total === undefined ? undefined : state.bytes}
        max={state.total === undefined ? undefined : Math.max(1, state.total)} />
      <span>{state.bytes}{state.total === undefined ? '' : ` / ${state.total}`} B</span>
    </>}
    {state.status === 'complete' && <span role="status">{labels.complete}</span>}
    {state.status === 'failed' && <div role="alert">{renderError ? renderError(error) : labels.failed}
      {unknown && <p>{labels.unknown}</p>}
    </div>}
  </div>;
}

// Notify only while the completed operation still belongs to this mounted component.
// Уведомляем только пока завершённая операция принадлежит смонтированному компоненту.
function useCompletion<Result>(state: TransferState<Result>, callback: ((result: Result) => void) | undefined) {
  const notified = useRef<Result | undefined>(undefined);
  useEffect(() => {
    if (state.status === 'complete' && notified.current !== state.result) {
      notified.current = state.result;
      callback?.(state.result);
    }
  }, [state, callback]);
}

interface ComponentOptions extends FileStreamsOptions {
  readonly labels?: TransferLabels;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly renderError?: (error: unknown) => ReactNode;
}
export interface FileUploadProps extends ComponentOptions {
  readonly objectKey: string;
  readonly accept?: string;
  readonly onCommitted?: (commit: UploadCommit) => void;
}
export function FileUpload(props: FileUploadProps) {
  const { objectKey, labels = englishLabels } = props;
  const transfer = useFileUpload({ ...props, scope: JSON.stringify([props.scope, objectKey]) });
  useCompletion(transfer.state, props.onCommitted);
  const identity = JSON.stringify([props.objectsUrl, props.scope, objectKey]);
  const [selection, setSelection] = useState<{ identity: string; file: File | undefined }>();
  const file = selection?.identity === identity ? selection.file : undefined;
  useEffect(() => { setSelection(undefined); }, [identity]);
  const id = useId();
  const busy = transfer.state.status === 'transferring';
  async function submit() {
    if (!file) return;
    try {
      await transfer.uploadFile(objectKey, file);
    } catch { /* The hook exposes the error; callbacks do not change storage outcome.
               * Hook показывает ошибку; callbacks не меняют результат сохранения. */ }
  }
  return <section className={props.className}>
    <label htmlFor={id}>{labels.choose}</label>
    <input key={identity} id={id} type="file" accept={props.accept} disabled={props.disabled || busy}
      onChange={event => { transfer.reset(); setSelection({ identity, file: event.currentTarget.files?.[0] }); }} />
    <button type="button" disabled={props.disabled || busy || !file} onClick={() => { void submit(); }}>{labels.upload}</button>
    {busy && <button type="button" onClick={transfer.cancel}>{labels.cancel}</button>}
    <TransferStatus state={transfer.state} labels={labels} {...(props.renderError ? { renderError: props.renderError } : {})} />
  </section>;
}

export interface FileDownloadProps extends ComponentOptions {
  readonly objectKey: string;
  readonly destination: Destination;
  readonly range?: ByteRange;
  readonly onComplete?: (result: DownloadResult) => void;
}
export function FileDownload(props: FileDownloadProps) {
  const labels = props.labels ?? englishLabels;
  const transfer = useFileDownload({ ...props, scope: JSON.stringify([props.scope, props.objectKey]) });
  useCompletion(transfer.state, props.onComplete);
  const busy = transfer.state.status === 'transferring';
  async function start() {
    try {
      await transfer.download(props.objectKey, props.destination, props.range);
    } catch { /* The hook exposes the error, including picker cancellation.
               * Hook показывает ошибку, включая отмену диалога выбора. */ }
  }
  return <section className={props.className}>
    <button type="button" disabled={props.disabled || busy} onClick={() => { void start(); }}>{labels.download}</button>
    {busy && <button type="button" onClick={transfer.cancel}>{labels.cancel}</button>}
    <TransferStatus state={transfer.state} labels={labels} {...(props.renderError ? { renderError: props.renderError } : {})} />
  </section>;
}
