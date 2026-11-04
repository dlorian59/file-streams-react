import { useCallback, useEffect, useRef, useState } from 'react';

export type TransferState<Result> =
  | { readonly status: 'idle'; readonly bytes: 0; readonly total: undefined }
  | { readonly status: 'transferring'; readonly bytes: number; readonly total: number | undefined }
  | { readonly status: 'complete'; readonly bytes: number; readonly total: number | undefined; readonly result: Result }
  | { readonly status: 'failed'; readonly bytes: number; readonly total: number | undefined; readonly error: unknown };

const idle = { status: 'idle', bytes: 0, total: undefined } as const;
type Progress = { bytes: number; total: number | undefined };
type Operation = { owner: string; generation: number; controller: AbortController };

// One hook owns one operation; changing its scope cancels its previous work.
// Один hook владеет одной операцией; смена области отменяет предыдущую работу.
export function useOperation<Result>(owner: string) {
  const mounted = useRef(false);
  const currentOwner = useRef(owner);
  const generation = useRef(0);
  const active = useRef<Operation | undefined>(undefined);
  const [stored, setStored] = useState<{ owner: string; state: TransferState<Result> }>({ owner, state: idle });

  useEffect(() => {
    const epoch = ++generation.current;
    currentOwner.current = owner;
    mounted.current = true;
    return () => {
      if (generation.current === epoch) mounted.current = false;
      const operation = active.current;
      if (operation?.generation === epoch) operation.controller.abort();
    };
  }, [owner]);

  const cancel = useCallback(() => {
    const operation = active.current;
    if (currentOwner.current === owner && operation?.owner === owner) operation.controller.abort();
  }, [owner]);
  const reset = useCallback(() => {
    if (currentOwner.current !== owner) throw new Error('This transfer belongs to an old scope');
    if (active.current?.generation === generation.current) throw new Error('Wait for the active transfer before resetting');
    setStored({ owner, state: idle });
  }, [owner]);
  const run = useCallback(async (
    task: (signal: AbortSignal, progress: (value: Progress) => void) => Promise<Result>,
    completedBytes: (result: Result) => number,
  ): Promise<Result> => {
    if (!mounted.current) throw new Error('A transfer can only start in a mounted component');
    if (currentOwner.current !== owner) throw new Error('This transfer belongs to an old scope');
    if (active.current?.generation === generation.current) {
      throw new Error('A transfer is already active; await it before starting another');
    }
    active.current?.controller.abort();
    const operation = { owner, generation: generation.current, controller: new AbortController() };
    active.current = operation;
    let progress: Progress = { bytes: 0, total: undefined };
    const publish = (state: TransferState<Result>) => {
      if (mounted.current && currentOwner.current === owner && generation.current === operation.generation && active.current === operation) {
        setStored({ owner, state });
      }
    };
    publish({ status: 'transferring', ...progress });
    try {
      const result = await task(operation.controller.signal, value => {
        progress = value;
        publish({ status: 'transferring', ...progress });
      });
      publish({ status: 'complete', ...progress, bytes: completedBytes(result), result });
      return result;
    } catch (error) {
      publish({ status: 'failed', ...progress, error });
      throw error;
    } finally {
      if (active.current === operation) active.current = undefined;
    }
  }, [owner]);
  return { state: stored.owner === owner ? stored.state : idle, run, cancel, reset };
}
