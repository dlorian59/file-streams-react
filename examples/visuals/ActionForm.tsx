import { TransferStatus } from '@59alex/file-streams-react';
import { useFileUploadAction } from '@59alex/file-streams-react/react19';
import { options } from './transport.js';
import { messages, type Language } from './text.js';

export function ActionForm({ language }: { language: Language }) {
  const text = messages(language);
  const upload = useFileUploadAction({ ...options, objectKey: 'visual/action.bin' });
  return <>
    <h1>{text.action}</h1><p className="intro">{text.actionHint}</p>
    <article><h2>useFileUploadAction · React 19</h2>
      {/* FormData is local Action input; only File.stream() becomes the raw PUT body. */}
      {/* FormData — локальный ввод Action; телом raw PUT становится только File.stream(). */}
      <form action={upload.formAction}>
        <label>{text.file}<input type="file" name="file" required disabled={upload.isPending} /></label>
        <button type="submit" disabled={upload.isPending}>{text.submit}</button>
        {upload.isPending && <button type="button" className="secondary" onClick={upload.cancel}>{text.labels.cancel}</button>}
        <p className="note" data-testid="pending">{upload.isPending ? text.pending : text.idle}</p>
        <TransferStatus state={upload.state} labels={text.labels} />
        {!upload.isPending && upload.result.status === 'committed' &&
          <p data-testid="action-commit">{text.accepted}: {upload.result.commit.bytes} B</p>}
      </form>
    </article>
    <p className="note">{text.progress}</p>
  </>;
}
