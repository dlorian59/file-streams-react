import type { FileStreamsOptions } from '@59alex/file-streams-react';

export const objectsUrl = 'https://127.0.0.1:19444/objects';
export const options: FileStreamsOptions = { objectsUrl, maxBytes: 1024 * 1024, scope: 'visual-example', fetch: pacedFetch };

// Capture-only pacing: the real byte stream, AbortSignal and HTTP request remain intact.
// Задержка только для записи: реальный поток байтов, AbortSignal и HTTP-запрос сохраняются.
async function pacedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!(init?.body instanceof ReadableStream)) return fetch(input, init);
  const paced = init.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      for (let offset = 0; offset < chunk.length; offset += 8192) {
        await new Promise(resolve => setTimeout(resolve, 60));
        if (init.signal?.aborted) throw init.signal.reason;
        controller.enqueue(chunk.subarray(offset, offset + 8192));
      }
    },
  }));
  return fetch(input, { ...init, body: paced });
}

// OPFS is a real streaming destination; it does not create a whole-file Blob in memory.
// OPFS — настоящее потоковое назначение; полный Blob файла в памяти не создаётся.
export async function openDestination(): Promise<WritableStream<Uint8Array>> {
  const directory = await navigator.storage.getDirectory();
  const handle = await directory.getFileHandle('visual-attachment.bin', { create: true });
  return handle.createWritable();
}
