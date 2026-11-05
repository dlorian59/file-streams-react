import { useState } from 'react';
import { FileDownload, FileUpload } from '@59alex/file-streams-react';
import type { UploadCommit } from '@59alex/file-streams';
import { options, openDestination } from './transport.js';
import { messages, type Language } from './text.js';

export function Components({ language }: { language: Language }) {
  const text = messages(language);
  const [commit, setCommit] = useState<UploadCommit>();
  const [written, setWritten] = useState<number>();
  // Only the validated commit enables download; 100% read progress is not enough.
  // Скачивание включает только проверенный commit; прогресса чтения 100% недостаточно.
  return <>
    <h1>{text.attachment}</h1><p className="intro">{text.select}</p>
    <div className="columns">
      <article><h2>01 · FileUpload</h2>
        <FileUpload {...options} objectKey="visual/attachment.bin" labels={text.labels} onCommitted={setCommit} />
        <p className="note">{text.progress}</p>
      </article>
      <article><h2>02 · FileDownload</h2>
        <FileDownload {...options} objectKey="visual/attachment.bin" labels={text.labels}
          destination={openDestination} disabled={!commit} onComplete={result => setWritten(result.bytesWritten)} />
        <p className="note">OPFS · WritableStream</p>
      </article>
    </div>
    <div className="receipt" aria-live="polite">
      {commit && <p data-testid="commit">{text.chosen}: {commit.bytes.toLocaleString(language)} B</p>}
      {written !== undefined && <p data-testid="downloaded">{text.saved}: {written.toLocaleString(language)} B</p>}
    </div>
  </>;
}
