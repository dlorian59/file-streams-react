# API reference — file-streams-react 0.1.0

[← Guide](en.md) · [Versions](../index.md) · [README](../../README.md) · [Русский](reference.ru.md)

## Choose the entry

| Entry | React | Exports and purpose |
| --- | --- | --- |
| `@59alex/file-streams-react` | 18.3.1 or 19 | Upload/download hooks, file components, status, labels and their types |
| `@59alex/file-streams-react/react19` | 19 only | `useFileUploadAction`, `FileUploadActionOptions`, `FileUploadActionResult`: native form Actions |

Both entries preserve `use client`; importing/rendering them on the server does not open streams or start network work. Actions require client JavaScript: this is not a Server Function or a no-JavaScript upload. The optional entry is isolated from the React 18 import graph. React and React DOM must use matching versions. Official [current React versions](https://react.dev/versions) list 19.3; registry versions verified on 2026-11-05 were React/React DOM 19.3.1. The base packed consumer was also checked on 18.3.1.

## Capability map

| Need | API | Source to adapt | Boundary |
| --- | --- | --- | --- |
| Attach a file and enable download only after storage confirmation | `FileUpload`, `FileDownload` | [Attachments](../../examples/attachments/Attachments.tsx) | Server authorizes keys; progress alone is not a commit |
| Own UI without repeating lifecycle code | `useFileUpload`, `useFileDownload`, `TransferStatus` | [GeneratedReport](../../examples/attachments/GeneratedReport.tsx), [PartialPreview](../../examples/attachments/PartialPreview.tsx) | One active operation per hook |
| Integrate an existing React 19 form | `useFileUploadAction` | [ActionAttachment](../../examples/attachments/ActionAttachment.tsx) | Client Action, one file field; no multipart POST |
| Stop an import on navigation or cancellation | `cancel`, `scope` | [CancelableImport](../../examples/attachments/CancelableImport.tsx) | A sent upload may already have committed |
| Preview a bounded region | `download` range | [PartialPreview](../../examples/attachments/PartialPreview.tsx) | Byte offsets, not text lines or automatic resume |
| Use your design system and language | Labels, `className`, `renderError` | [Attachments](../../examples/attachments/Attachments.tsx) | No bundled styles; custom error UI must not imply rollback |

## Shared options: `FileStreamsOptions`

Used by both base hooks, both components and the React 19 hook. All fields are readonly.

| Field | Type / default | Contract |
| --- | --- | --- |
| `objectsUrl` | Required `string` | Absolute endpoint, e.g. `https://files.example/objects`; no query/fragment. Logical keys are encoded once as one path segment. |
| `maxBytes` | Required `number` | Nonnegative safe integer byte limit; includes zero for empty-file-only policy. Client enforcement does not replace the server limit. |
| `scope` | Optional `string` | Account/tenant/authorization identity. Change synchronously with credentials; never defer this change in a transition. |
| `headers` | Optional `HeadersInit` | Auth/application headers; default empty. Do not set `Content-Length`, `X-Upload-Length`, `Content-Range` for uploads or `Range` for downloads. |
| `credentials` | Optional `RequestCredentials`, `same-origin` | Fetch cookie policy. Cross-origin credentials require the matching server CORS policy. |
| `fetch` | Optional `typeof fetch`, runtime fetch | Custom transport must preserve streaming, backpressure and AbortSignal semantics. |

Changing endpoint, scope or limit cancels active work and hides old state. Changing headers alone does not revoke an active operation: also change `scope`. Unmount cancels work. Parent account-scoped data, selected files and callbacks remain application responsibilities when using hooks directly. Components additionally include `objectKey` in their operation scope.

## Base hooks and `TransferState<Result>`

`useFileUpload(options)` returns `state`, `upload`, `uploadFile`, `cancel`, `reset`. `useFileDownload(options)` returns `state`, `download`, `cancel`, `reset`.

| Method | Return | Behavior |
| --- | --- | --- |
| `upload(input: StreamUpload)` | `Promise<UploadCommit>` | Consume one fresh unlocked byte stream; resolve only after validated server commit. |
| `uploadFile(key: string, file: Blob)` | `Promise<UploadCommit>` | Use `file.stream()`, `file.size`, and nonempty `file.type`; a File works as a Blob. |
| `download(key: string, destination: Destination, range?: ByteRange)` | `Promise<DownloadResult>` | Validate response metadata, await sink writes and close. A destination factory starts from the call, allowing a user-gesture file picker. |
| `cancel()` | `void` | Cooperative cancellation of the active operation; safe if idle. Does not delete remote files or undo sink writes. |
| `reset()` | `void` | Clear settled display state. Throws while active or for a retained callback from an old scope. |

Catch rejected promises even when rendering hook state. Starting a second operation while active, starting after unmount, or using an old-scope callback rejects with `Error`. No implicit queue, retry or stream replay exists in base hooks.

`StreamUpload`: required `key: string` (nonempty, not `.`/`..`), `source: ReadableStream<Uint8Array>`; optional `knownLength: number` (nonnegative safe integer, exact byte count) and `contentType: string`. Supply length whenever available. Unknown-length EOF alone cannot establish business completeness; see the [observed cancellation boundary](../VERIFICATION.md#observed-unknown-length-boundary).

`Destination = WritableStream<Uint8Array> | (() => Promise<WritableStream<Uint8Array>>)`. Provide a fresh unlocked destination on each attempt. If a picker resolves after cancellation, the late sink is aborted without GET. No whole-file Blob fallback is used. A sink may have applied a write before cancellation; atomic saving depends on its implementation.

| `state.status` | Additional fields | Meaning |
| --- | --- | --- |
| `idle` | `bytes: 0`, `total: undefined` | No operation visible in this scope |
| `transferring` | `bytes: number`, `total: number \| undefined` | Upload bytes read or download bytes written. Includes waiting for commit/sink close, even at 100%. |
| `complete` | `bytes`, `total`, `result: Result` | Matching upload commit or validated download with closed destination |
| `failed` | `bytes`, `total`, `error: unknown` | Original error; cancellation is also a failure |

Result/range types come from `@59alex/file-streams`, not re-exports of this adapter:

| Type | Fields |
| --- | --- |
| `UploadCommit` | `committed: true`, `key: string`, `bytes: number`, `etag: string` |
| `DownloadResult` | `complete: true`, `bytesWritten: number`, `etag: string`, `contentType: string \| null`, `range: DownloadRange \| undefined` |
| `ByteRange` | `{start: number, end?: number}` with inclusive end, or `{suffix: number}` with positive suffix length |
| `DownloadRange` | `start`, `end` inclusive, `total`: nonnegative integer byte counts describing the validated response |

## Components and text

`FileUpload` and `FileDownload` accept every shared option plus these common props:

| Prop | Type / default | Behavior |
| --- | --- | --- |
| `labels` | `TransferLabels`, `englishLabels` | Full label object; `russianLabels` is also exported. |
| `className` | Optional `string` | Applied to the outer `<section>`. |
| `disabled` | Optional `boolean`, false | Disable starting/selecting; an active transfer's cancel button stays usable. |
| `renderError` | Optional `(error: unknown) => ReactNode` | Render failure details. The built-in uncertain-upload warning remains visible. |

`FileUploadProps` additionally requires `objectKey: string`; optional `accept: string` is the native input filter, not content validation; optional `onCommitted(commit: UploadCommit): void` runs once for a visible confirmed result. Selection resets on endpoint/scope/key changes. Input and submit are disabled while transferring. It is a section with buttons, not a nested form.

`FileDownloadProps` additionally requires `objectKey: string` and `destination: Destination`; optional `range: ByteRange` requests a range; optional `onComplete(result: DownloadResult): void` runs once after validated sink close. Callbacks are UI notifications, not storage transactions. Callback exceptions belong to the application; old-scope completions do not invoke a new account's callback.

`TransferStatus<Result>(props)` takes required `state: TransferState<Result>`, optional `labels` and `renderError` with the same meanings. Idle renders nothing; transferring renders a labelled native progress element and byte count; completion uses `role="status"`; errors use `role="alert"`. Unknown totals render indeterminate progress.

`TransferLabels` has eight required string fields: `choose`, `upload`, `download`, `cancel`, `progress`, `complete`, `failed`, `unknown`. The exported English/Russian label objects are frozen; derive custom labels with `{...englishLabels, upload: 'Attach'}`.

## React 19 form Actions

[Complete runnable source](../../examples/attachments/ActionAttachment.tsx); [paired Java setup](en.md#1-upload-an-attachment-and-receive-it-in-java). Mount the source in the existing demo with `npm run demo`; it shares the same PUT endpoint as the React 18 components.

`useFileUploadAction(options: FileUploadActionOptions)` adds required `objectKey: string` and optional `fieldName: string` (default `file`) to the shared options. No hidden form field may override the key; authorization stays on Java.

| Return field | Type | Usage |
| --- | --- | --- |
| `formAction` | `(data: FormData) => void` | Pass to `<form action={...}>`. Programmatic calls need `startTransition(() => formAction(data))`. Only the named File becomes the streamed PUT body. |
| `isPending` | `boolean` | True while React has pending Actions; disable submit to prevent duplicate user submissions. It is not a storage outcome. |
| `state` | `TransferState<UploadCommit>` | Current transfer's immediate byte progress and error details; reset when the next owned Action starts. |
| `result` | `FileUploadActionResult` | Last settled Action in this lifecycle, initially `{status:'idle'}`; it can remain the previous result while another Action is pending. |
| `cancel` | `() => void` | Abort active upload and invalidate already queued Actions. New later submissions remain possible. |

`FileUploadActionResult` is `{status:'idle'}` or `{status:'committed', commit: UploadCommit}` or `{status:'failed', error: unknown}`. Missing/wrong/unnamed file fields produce a `TypeError` without a request. Zero-byte named files are allowed. Transfer failures retain their original error including `uploadOutcome`; there is no optimistic saved state or automatic retry.

React serializes dispatched Actions; this adapter checks lifecycle ownership **again when dequeuing**. Scope/key/field/endpoint/limit changes and unmount invalidate stale queued submissions and hide old results. Old retained actions are no-ops. React pending can remain true while obsolete work settles. A cancelled/obsolete queued action is skipped without overwriting the last result. Change account scope synchronously, and key the form by account to clear the browser's old file selection.

The hook handles transfer errors as result data. Consequently, a resolved Action can mean `failed`, and React resets uncontrolled fields after it resolves; select a fresh file for a deliberate retry. Inspect uncertain server outcomes first. Do not await `formAction`: dispatch returns void; observe `result`/`isPending`. These semantics follow React's [Actions queue](https://react.dev/reference/react/useActionState) and [form reset behavior](https://react.dev/reference/react-dom/components/form).

## Errors and recovery

Import `TransferError` from `@59alex/file-streams`. Its fields are `name: 'TransferError'`, `message: string`, `code`, optional `status: number`, optional `uploadOutcome` and optional `cause`. Custom picker failures, URL errors, lifecycle misuse and callback errors can be other error types: always handle `unknown` safely.

| `code` | Meaning / next action |
| --- | --- |
| `INVALID_ARGUMENT` | Fix stream/options/managed headers/range before another attempt. |
| `UNSUPPORTED` | Runtime cannot supply the required streaming transport; choose a supported runtime, not a hidden buffer fallback. |
| `ABORTED` | User/lifecycle cancellation; upload may still exist; partial sink writes may remain. |
| `LIMIT_EXCEEDED` | Source/response exceeds byte policy; review limit or input. |
| `LENGTH_MISMATCH` | Source/response length differs from declared length; verify content and server behavior. |
| `HTTP_ERROR` | Unexpected HTTP status; inspect `status`, authentication and server policy. |
| `PROTOCOL_ERROR` | Invalid/mismatched commit or response metadata; verify endpoint/proxy/CORS exposure. |
| `SOURCE_ERROR` | Upload source failed or yielded invalid bytes; rebuild a fresh source only after outcome reconciliation. |
| `SINK_ERROR` | Destination write/close failed; inspect its partial-write/rollback behavior. |
| `NETWORK_ERROR` | Fetch/network failed; a sent upload's result may be unknown. |

Upload `uploadOutcome`: `not-started` means no PUT started by the transport; `rejected` means a validated explicit rejection; `unknown` means the object may exist. Download errors leave it undefined. A client cannot turn `unknown` into failure by resetting UI: query application storage state/version before deciding to retry. See [verification and limits](../VERIFICATION.md); no resumability, overwrite protection, hash verification or distributed transaction is promised.

[← Guide](en.md) · [Versions](../index.md) · [README](../../README.md)
