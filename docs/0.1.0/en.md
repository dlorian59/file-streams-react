# File streams React 0.1.0 — an attachment from screen to storage

[← Versions](../index.md) · [API](reference.en.md) · [README](../../README.md) · [Русский](ru.md)
[Visual examples](../visuals/en.md)
[Ready integration](../integration/en.md)

A support ticket needs an attachment. The UI must report progress, stop work when the user leaves, show whether storage actually confirmed the upload, and download the file without building a second full copy in browser memory. These are separate responsibilities from the ticket form itself.

The components handle that transfer lifecycle. Your application supplies the object key, authorized endpoint, size policy and download destination. The matching Spring starter supplies the Java HTTP adapter and storage wiring. The examples are reproducible integration scenarios, not claims about a production deployment or measured development speed.

## 1. Upload an attachment and receive it in Java

Full source: [Attachments.tsx](../../examples/attachments/Attachments.tsx). Each action has an English comment followed by Russian.

```tsx
<FileUpload
  objectsUrl="https://127.0.0.1:19443/objects"
  scope="account-42"
  objectKey="tickets/123/attachment.bin"
  maxBytes={8 * 1024 * 1024}
  onCommitted={setSaved}
/>
```

On the Java side the same URL is enabled explicitly:

```yaml
file-streams:
  enabled: true
  s3:
    bucket: attachments
    region: us-east-1
  http:
    enabled: true
```

Use the starter's [application](https://github.com/dlorian59/file-streams-spring-boot-starter/blob/main/example/src/main/java/example/FileStreamsApplication.java) and [complete configuration](https://github.com/dlorian59/file-streams-spring-boot-starter/blob/main/example/src/main/resources/application.yml), including HTTP/2, TLS, region, endpoint and CORS. Locally these files are under `../file-streams-spring-boot-starter/example/`. Credentials use the standard AWS chain; do not put them in React.

| React/browser action | Java/server action | Observable result |
| --- | --- | --- |
| Choose a File; call its `stream()` | Raw PUT body enters the existing WebFlux adapter | No form-data parser or browser part scheduler |
| PUT `/objects/tickets%2F123%2Fattachment.bin` with `X-Upload-Length` | Validate declared size, consume the stream with backpressure | Byte progress means bytes read by the client |
| Await JSON `201` | Storage confirms and the adapter returns `{committed,key,bytes,etag}` | Only a matching confirmed commit calls `onCommitted` |
| Cancel or leave this component | AbortSignal propagates; Java/storage perform their cleanup | A lost response may still leave an uploaded object |

This replaces repeated file input, progress, cancellation and commit-state glue in each form. It does not replace authorization: the server must ensure that account 42 can write this ticket's key.

## 2. Download directly to a destination

The second half of [Attachments.tsx](../../examples/attachments/Attachments.tsx) passes a factory that opens `showSaveFilePicker()` and returns `createWritable()` to `FileDownload`. The factory runs from the button gesture. GET uses exactly the same object URL; Java streams the S3 object back and exposes `Content-Length`, `ETag`, `Accept-Ranges` and, for partial responses, `Content-Range` through CORS.

```tsx
<FileDownload
  objectsUrl="https://127.0.0.1:19443/objects"
  scope="account-42"
  objectKey={saved.key}
  maxBytes={8 * 1024 * 1024}
  destination={openWritableFile}
/>
```

The client awaits every sink write, verifies length and metadata, and reports completion only after the sink closes. You can supply another `WritableStream` for OPFS or a processing pipeline. There is no hidden `Blob` fallback. File System Access support and streaming request support differ by browser; the demo is verified in Chromium. A stream constructor probe alone cannot prove transport support through a proxy.

## 3. Produce a report without constructing the complete file

[GeneratedReport.tsx](../../examples/attachments/GeneratedReport.tsx) produces CSV rows in a `ReadableStream.pull` callback. `useFileUpload().upload()` accepts this one-shot stream without a known length. The byte limit remains enforced. The same Spring PUT handler receives it: no second server API is needed.

Use this when data is generated incrementally. Supply `knownLength` whenever it is available: in the local HTTP/2 fixture, an 8 KiB prefix remained after cancelling an unknown-length source; the exact cause of HTTP stream termination is not established. No client commit was reported, but the object existed. Unknown length alone cannot prove logical completeness; applications needing that guarantee must add expected size/hash or a staging/finalization protocol. Those application protocols are not supplied by this adapter. Avoid a separate `rows.join(...)`, JSON-to-Blob step, or manually implementing upload progress for every report. Retries are explicit: generate a new source after checking whether the previous attempt committed.

[CancelableImport.tsx](../../examples/attachments/CancelableImport.tsx) makes cancellation visible with an intentionally paced source and a declared 1 MiB total. The declared length allows Java to reject early EOF. `ABORTED` with `uploadOutcome: unknown` does not prove server rollback.

## 4. Read only the requested prefix

[PartialPreview.tsx](../../examples/attachments/PartialPreview.tsx) requests bytes 0–4095 and keeps at most that small preview in memory. The Java endpoint answers `206`; the base client checks that `Content-Range` matches the requested range and that the actual bytes match the headers. An ignored Range request is rejected rather than treated as a successful preview.

This reduces transferred data for preview screens. It is a byte-range read, not an automatic resumable-download or text-boundary protocol. A prefix can end halfway through a UTF-8 code point; the example decoder flushes that boundary normally.

## 5. Customize UI and account ownership

Use `useFileUpload` or `useFileDownload` with your own components; `TransferStatus` is optional. Hooks expose `state`, `cancel()` and `reset()`. Upload additionally exposes `uploadFile(key, blob)` and `upload({key,source,knownLength?,contentType?})`; download exposes `download(key,destination,range?)`. These methods return promises: catch failures even if `state` is also rendered.

| State | Meaning |
| --- | --- |
| `idle` | No operation in this scope |
| `transferring` | Bytes are moving, or upload confirmation / destination close is pending |
| `complete` | Validated upload commit or completed download destination |
| `failed` | `error` contains the original cause; `TransferError.uploadOutcome` distinguishes `not-started`, `rejected`, `unknown` for upload |

The package entry preserves `'use client'` for framework client boundaries; it does not access browser globals at module import. Pass `scope` when account, tenant or authorization changes. Scope or endpoint changes cancel the old operation and hide its state; unmount also cancels. A component also resets its selected file when its key/scope changes. An old promise may still settle, but it does not update the new scope's UI. Cancellation is cooperative and is not proof of server rollback. Custom sinks must implement cancellation appropriately.

One hook admits one active transfer. Create independent instances for independent files; the application chooses its overall concurrency budget. Do not reuse a source stream or destination from an earlier attempt. `reset()` resets display state after completion, not remote storage.

`labels` accepts all button/status text; use exported `russianLabels` or `englishLabels`. `className`, semantic elements, native buttons and `renderError` let your design system control appearance. CSS is not bundled. Pass dynamic auth headers through `headers` and use `credentials` when required by your application's CORS policy.

## 6. Run the paired example

Prerequisites: sibling checkouts `file-streams`, `file-streams-spring-boot-starter`, `file-streams-react`; Node 22.12+, npm, JDK 17+ and OpenSSL. Artifacts are built locally; no npm/Maven release is assumed.

```bash
# From file-streams-react, prepare the core artifacts.
(cd ../file-streams && ./gradlew publishToMavenLocal -PtestJavaVersion=17 \
  -Dmaven.repo.local="$PWD/build/local-repository")
(cd ../file-streams/browser && npm ci && npm run build)
npm ci
npm test
npm run typecheck
npm run test:package
```

Terminal 1, a bounded **in-memory test fixture**, with no S3 credentials:

```bash
cd ../file-streams-spring-boot-starter
scripts/run-example.sh :example:runTransportFixture
```

Terminal 2, from this repository:

```bash
npm run demo
```

Open `https://127.0.0.1:5173/` and trust the local development certificate for both ports 5173 and 19443. Select a small file, upload it, wait for the commit record and download it. The demo uses the same certificate files generated by the starter. `DEMO_TLS_CERT` and `DEMO_TLS_KEY` can override their locations.

To use real S3-compatible storage, follow the starter's [storage setup](https://github.com/dlorian59/file-streams-spring-boot-starter#readme), provide AWS credentials through its standard chain and run `scripts/run-example.sh` without the fixture argument. The fixture exists only in the example test source set; it is not a production storage adapter.

With both servers running, `npm run test:browser` checks actual Chromium → Spring HTTP/2 PUT/GET byte equality. Its save picker is a test-only writable sink, not an automated OS dialog.

## 7. Integrate a React 19 form

Use the optional `@59alex/file-streams-react/react19` entry when an existing form already uses Actions. [ActionAttachment.tsx](../../examples/attachments/ActionAttachment.tsx) connects its named file input to the same Java PUT endpoint. It supplies pending state, streaming progress, cancellation and a validated result without a second submit handler. The base entry stays compatible with React 18.

Read the [complete Action contract](reference.en.md#react-19-form-actions), including the queue, file reset after an attempt, synchronous scope changes and uncertain outcomes. This is a client Action, not a Server Function; there is no optimistic saved state.

## Troubleshooting and verified limits

- `A transfer is already active`: wait for its promise to settle; use a separate hook for another file.
- `This transfer belongs to an old scope`: stop retaining callbacks across account changes; use the current render's hook result.
- `UNSUPPORTED` or streaming network failure: verify browser, trusted TLS, HTTP/2 and proxy handling; do not buffer the file as a workaround.
- Missing metadata during download: expose the required response headers through CORS.
- Upload outcome `unknown`: check storage/application state before deciding to create a new stream and retry.
- Certificate/readiness failure: start the Spring example first and ensure both origins are configured.

Verified locally: eight focused lifecycle/transfer/Action tests, strict example typecheck, clean packed-package consumer with SSR, and Chromium HTTP/2 upload/commit/download plus known-length cancellation through Spring Boot 4.1.2. [Detailed verification](../VERIFICATION.md). The paired run used the bounded in-memory fixture, **not S3**. Safari/Firefox uploads, real file-picker dialogs, interrupted networks and production proxies were not exercised. See the [core transport](https://github.com/dlorian59/file-streams) for its separate storage evidence and reliability limits.

[← Versions](../index.md) · [API](reference.en.md) · [README](../../README.md)
