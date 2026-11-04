import { useCallback } from 'react';
import { downloadTo, objectUrl, TransferError, uploadStream, type ByteRange,
  type DownloadResult, type UploadCommit } from '@59alex/file-streams';
import { useOperation } from './operation.js';

export interface FileStreamsOptions {
  readonly objectsUrl: string;
  readonly maxBytes: number;
  /** Change this value when the account or authorization scope changes.
   * Меняйте значение при смене аккаунта или области доступа. */
  readonly scope?: string;
  readonly headers?: HeadersInit;
  readonly credentials?: RequestCredentials;
  readonly fetch?: typeof globalThis.fetch;
}
export interface StreamUpload {
  readonly key: string;
  readonly source: ReadableStream<Uint8Array>;
  readonly knownLength?: number;
  readonly contentType?: string;
}
export type Destination = WritableStream<Uint8Array> | (() => Promise<WritableStream<Uint8Array>>);

function owner(options: FileStreamsOptions): string {
  return JSON.stringify([options.objectsUrl, options.scope ?? '', options.maxBytes]);
}

export function useFileUpload(options: FileStreamsOptions) {
  const { state, run, cancel, reset } = useOperation<UploadCommit>(owner(options));
  const upload = useCallback((input: StreamUpload) => run(async (signal, progress) => {
    const headers = new Headers(options.headers);
    if (input.contentType) headers.set('Content-Type', input.contentType);
    return uploadStream({
      url: objectUrl(options.objectsUrl, input.key), key: input.key, source: input.source,
      maxBytes: options.maxBytes, signal, headers,
      ...(input.knownLength === undefined ? {} : { knownLength: input.knownLength }),
      ...(options.credentials === undefined ? {} : { credentials: options.credentials }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      onProgress: value => progress({ bytes: value.bytesRead,
        total: value.phase === 'reading' ? value.knownLength : value.commit.bytes }),
    });
  }, result => result.bytes), [run, options.objectsUrl, options.maxBytes, options.headers, options.credentials, options.fetch]);

  const uploadFile = useCallback((key: string, file: Blob) => upload({
    key, source: file.stream(), knownLength: file.size,
    ...(file.type ? { contentType: file.type } : {}),
  }), [upload]);
  return { state, upload, uploadFile, cancel, reset };
}

// The picker can resolve after cancellation; abort that late sink instead of leaking it.
// Диалог выбора может завершиться после отмены; поздний sink закрывается с ошибкой.
async function destinationFor(input: Destination, signal: AbortSignal): Promise<WritableStream<Uint8Array>> {
  if (typeof input !== 'function') return input;
  const pending = input();
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new TransferError('ABORTED', 'Download cancelled before opening the destination'));
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    void pending.then(destination => {
      signal.removeEventListener('abort', aborted);
      if (signal.aborted) {
        void destination.abort(signal.reason).catch(() => {});
      } else resolve(destination);
    }, error => { signal.removeEventListener('abort', aborted); reject(error); });
  });
}

export function useFileDownload(options: FileStreamsOptions) {
  const { state, run, cancel, reset } = useOperation<DownloadResult>(owner(options));
  const download = useCallback((key: string, destination: Destination, range?: ByteRange) =>
    run(async (signal, progress) => {
      // Validate the URL before the application opens a file destination.
      // Проверяем URL до того, как приложение откроет файл назначения.
      const url = objectUrl(options.objectsUrl, key);
      const sink = await destinationFor(destination, signal);
      try {
        return await downloadTo({ url, destination: sink, maxBytes: options.maxBytes, signal,
        ...(range === undefined ? {} : { range }),
        ...(options.headers === undefined ? {} : { headers: options.headers }),
        ...(options.credentials === undefined ? {} : { credentials: options.credentials }),
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        onProgress: value => progress({ bytes: value.bytesWritten, total: value.responseBytes }),
        });
      } catch (error) {
        // Validation can fail before the base transport claims the opened destination.
        // Проверка может завершиться ошибкой до захвата открытого назначения транспортом.
        if (!sink.locked) await sink.abort(error).catch(() => {});
        throw error;
      }
    }, result => result.bytesWritten),
  [run, options.objectsUrl, options.maxBytes, options.headers, options.credentials, options.fetch]);
  return { state, download, cancel, reset };
}
