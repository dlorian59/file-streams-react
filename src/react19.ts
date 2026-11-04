'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UploadCommit } from '@59alex/file-streams';
import { useFileUpload, type FileStreamsOptions } from './hooks.js';

export interface FileUploadActionOptions extends FileStreamsOptions {
  readonly objectKey: string;
  /** The file input name; defaults to "file".
   * Имя поля файла; по умолчанию "file". */
  readonly fieldName?: string;
}
export type FileUploadActionResult =
  | { readonly status: 'idle' }
  | { readonly status: 'committed'; readonly commit: UploadCommit }
  | { readonly status: 'failed'; readonly error: unknown };

const idle = { status: 'idle' } as const;
type Owner = object;
type Lifetime = { owner: Owner; generation: number; queue: number };
type Submission = Lifetime & { data: FormData; reset: () => void; upload: (file: Blob) => Promise<UploadCommit>; field: string };
type Stored = { owner: Owner; generation: number; result: FileUploadActionResult } | undefined;

/** Client-side React 19 Action; the body still uses the base streaming PUT protocol.
 * Клиентский Action React 19; тело передаётся потоковым PUT базовой библиотеки. */
export function useFileUploadAction(options: FileUploadActionOptions) {
  const { objectKey, fieldName = 'file' } = options;
  const identity = JSON.stringify([options.objectsUrl, options.scope, options.maxBytes, objectKey, fieldName]);
  const owner = useMemo<Owner>(() => ({}), [identity]);
  const lifetime = useRef<Lifetime | undefined>(undefined);
  const generation = useRef(0);
  const [committedGeneration, setCommittedGeneration] = useState(0);
  const transfer = useFileUpload({ ...options, scope: identity });
  useEffect(() => {
    const current = { owner, generation: ++generation.current, queue: 0 };
    lifetime.current = current;
    setCommittedGeneration(current.generation);
    return () => { if (lifetime.current === current) lifetime.current = undefined; };
  }, [owner]);

  const [stored, dispatch, isPending] = useActionState<Stored, Submission>(async (previous, submission) => {
    const current = lifetime.current;
    // React queues Actions: validate ownership when dequeuing, before opening the source.
    // React ставит Actions в очередь: проверяем владельца до открытия источника.
    if (!current || current.owner !== submission.owner || current.generation !== submission.generation || current.queue !== submission.queue) return previous;
    let result: FileUploadActionResult;
    try {
      submission.reset();
      const file = submission.data.get(submission.field);
      if (!file || typeof file === 'string' || typeof file.stream !== 'function' || !file.name) {
        throw new TypeError(`Select a file in the "${submission.field}" field`);
      }
      const commit = await submission.upload(file);
      result = { status: 'committed', commit };
    } catch (error) {
      result = { status: 'failed', error };
    }
    return { owner: submission.owner, generation: submission.generation, result };
  }, undefined);

  const formAction = useCallback((data: FormData) => {
    const current = lifetime.current;
    if (!current || current.owner !== owner) return;
    // Capture the operation and lifecycle before it enters React's sequential queue.
    // Сохраняем операцию и жизненный цикл до попадания в последовательную очередь React.
    dispatch({ ...current, data, field: fieldName, reset: transfer.reset, upload: file => transfer.uploadFile(objectKey, file) });
  }, [owner, dispatch, fieldName, objectKey, transfer.reset, transfer.uploadFile]);
  const cancel = useCallback(() => {
    const current = lifetime.current;
    if (!current || current.owner !== owner) return;
    current.queue++;
    transfer.cancel();
  }, [owner, transfer.cancel]);
  const result = stored?.owner === owner && stored.generation === committedGeneration ? stored.result : idle;
  return { formAction, isPending, result, state: transfer.state, cancel };
}
