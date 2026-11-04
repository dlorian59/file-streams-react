# Verification / Проверка — 0.1.0

[← README](../README.md) · [Versions / Версии](index.md)

Local verification on 2026-11-04, Node 24.21.0, React 19.3.1, Chromium with the Spring Boot 4.1.2 HTTPS/HTTP2 example fixture.

| Check | Result |
| --- | --- |
| `npm test` | Six focused cases: progress before commit, scope cancellation, late destination disposal, sink-close completion, SSR, stale callback/selection isolation. |
| `npm run typecheck` | Strict TypeScript compiler checked the public implementation and all source examples. |
| `npm run test:package` | Fresh consumer installed both packed artifacts, imported public exports, rendered SSR, checked declarations/semver peer and retained `use client` entry directive. |
| `npm run test:browser` | Actual React component → HTTPS/HTTP2 → Java endpoint: 45 bytes uploaded with validated commit, downloaded into the supplied writable sink, exact bytes matched, no page errors. |
| Known-length cancel | Paced 1 MiB source stopped before EOF. Client reported `ABORTED` / `unknown`; GET of the new key returned 404 in this fixture. |

The browser test replaces the save picker with a test-only sink for byte comparison. It does not exercise an OS file dialog. The Java endpoint uses a bounded in-memory `ObjectStreams` fixture in a separate example source set. This checks component/protocol integration, **not S3 durability or multipart cleanup**. The core repository has separate storage evidence. Own demo/browser processes are stopped after verification.

## Observed unknown-length boundary

An earlier cancellation run omitted knownLength. The client correctly reported `ABORTED` with `uploadOutcome: unknown`. The fixture nevertheless retained an 8192-byte prefix of the intended 1 MiB source. Therefore neither cancellation nor lack of client confirmation proves absence of a server object. The known-length example guards early EOF with `X-Upload-Length`; the uncertain-result contract remains unchanged.

If logical completeness is required for an unknown-length business object, applications need expected content verification or a separate staging/finalization policy. The React adapter supplies neither a distributed transaction nor a storage deletion guarantee. This observed fixture behavior must not be generalized into a verified S3 result.

## Обнаруженная граница неизвестной длины

В ранней проверке отмены размер не объявлялся. Клиент корректно показал `ABORTED` / `unknown`, но fixture сохранил префикс 8192 байта вместо полного источника 1 МиБ. Отмена и отсутствие подтверждения не доказывают отсутствие объекта на сервере. Пример с известным размером использует `X-Upload-Length`, чтобы отклонять ранний EOF; неизвестный результат после отмены по-прежнему возможен.

Для подтверждения логической полноты объектов неизвестной длины приложению нужна проверка ожидаемого содержимого либо отдельная политика staging/finalization. React-адаптер не предоставляет распределённую транзакцию или гарантию удаления. Поведение этого fixture не является результатом проверки S3.

Not exercised: React 18, Safari/Firefox uploads, real save picker, production authentication/proxy behavior, hostile custom streams, storage failover and interrupted networks. No universal performance claim is made.

[← README](../README.md) · [Versions / Версии](index.md)
