# Verification / Проверка — 0.1.0

[← README](../README.md) · [Versions / Версии](index.md)

Local verification on 2026-11-05, Node 24.21.0, React 19.3.1, Chromium with the Spring Boot 4.1.2 HTTPS/HTTP2 example fixture on Java 25. Earlier fixture runs used Java 17.

| Check | Result |
| --- | --- |
| `npm test` | Eight focused cases: React 19 Action commit/error/queue cancellation and scope/unmount isolation, plus progress before commit, scope cancellation, late destination disposal, sink-close completion, SSR, stale callback/selection isolation. |
| `npm run typecheck` | Strict TypeScript compiler checked the public implementation and all source examples. |
| `npm run test:package` | Fresh consumer installed both packed artifacts, imported public exports, rendered the base entry on React 18.3.1 and the optional Action entry on React 19.3.1, checked declarations/semver peer and both retained `use client` directives. |
| `npm run test:browser` | Actual React component → HTTPS/HTTP2 → Java endpoint: 45 bytes uploaded with validated commit, downloaded into the supplied writable sink, exact bytes matched, no page errors. |
| Native React 19 form | Real `<form action>` sent 45 bytes through Java. A test-only gate delayed observation of the real response: pending and transferring remained true, no saved result appeared before commit. After release, the file input reset and the confirmed result appeared. |
| Known-length cancel | Paced 1 MiB source stopped before EOF. Client reported `ABORTED` / `unknown`; GET of the new key returned 404 in this fixture. |

The browser test replaces the save picker with a test-only sink for byte comparison. It does not exercise an OS file dialog. The Java endpoint uses a bounded in-memory `ObjectStreams` fixture in a separate example source set. This checks component/protocol integration, **not S3 durability or multipart cleanup**. The core repository has separate storage evidence. Own demo/browser processes are stopped after verification.

## Observed unknown-length boundary

An earlier cancellation run omitted knownLength. The client correctly reported `ABORTED` with `uploadOutcome: unknown`. The fixture nevertheless retained an 8192-byte prefix of the intended 1 MiB source. Therefore neither cancellation nor lack of client confirmation proves absence of a server object. The known-length example guards early EOF with `X-Upload-Length`; the uncertain-result contract remains unchanged.

If logical completeness is required for an unknown-length business object, applications need expected content verification or a separate staging/finalization policy. The React adapter supplies neither a distributed transaction nor a storage deletion guarantee. This observed fixture behavior must not be generalized into a verified S3 result.

## Обнаруженная граница неизвестной длины

В ранней проверке отмены размер не объявлялся. Клиент корректно показал `ABORTED` / `unknown`, но fixture сохранил префикс 8192 байта вместо полного источника 1 МиБ. Отмена и отсутствие подтверждения не доказывают отсутствие объекта на сервере. Пример с известным размером использует `X-Upload-Length`, чтобы отклонять ранний EOF; неизвестный результат после отмены по-прежнему возможен.

Для подтверждения логической полноты объектов неизвестной длины приложению нужна проверка ожидаемого содержимого либо отдельная политика staging/finalization. React-адаптер не предоставляет распределённую транзакцию или гарантию удаления. Поведение этого fixture не является результатом проверки S3.

Not exercised: full React 18 browser interaction, Safari/Firefox uploads, real save picker, production authentication/proxy behavior, hostile custom streams, storage failover and interrupted networks. No universal performance claim is made.

[← README](../README.md) · [Versions / Версии](index.md)

## React 19 integration / Интеграция React 19

The optional entry uses `useActionState`; the React 18 entry never imports it. Actions tests run under StrictMode. Cancellation invalidates existing queued work; scope changes and unmount prevent queued or retained Actions from starting another request. Original `TransferError` and `uploadOutcome: unknown` remain observable.

Дополнительный entry использует `useActionState`, основной React 18 его не импортирует. Тесты Actions работают в StrictMode: отмена делает очередь недействительной, смена scope и unmount не дают старым Actions запустить новый запрос. Исходный `TransferError` и неизвестный результат сохраняются. В настоящем браузере проверена нативная форма с ожиданием commit и очисткой поля. Это тот же bounded memory fixture, не проверка S3.

[EN reference](0.1.0/reference.en.md) · [Справочник RU](0.1.0/reference.ru.md) · [← README](../README.md)

## Visual guides — OSS-011

[Visual guide EN](visuals/en.md) · [Визуальное руководство RU](visuals/ru.md)

`npm run capture:visuals` completed eight headless Chromium recordings: four scenarios in English and Russian. The capture uses its own bounded **Node HTTP/2 memory fixture**, not the Spring fixture described above and not S3. Both task-owned listeners (5181 and 19444) and browser contexts stopped after capture.

| Recorded surface | Checked observations |
| --- | --- |
| `FileUpload` + `FileDownload` | Selected filename, actual upload click, all bytes read before confirmation, disabled download before commit, download progress, closed OPFS destination, exact 262144-byte content comparison |
| `useFileUpload` + `TransferStatus` | Intermediate byte count, cancellation with `ABORTED / unknown`, disabled retry before object check, fixture HEAD 404, new explicit stream attempt and confirmed commit |
| `useFileDownload` + `TransferStatus` | Actual range request, intermediate progress, validated HTTP 206 / 32768 bytes and bounded text preview |
| `useFileUploadAction` | Native React 19 form submission, pending submit disabled before commit, confirmed result and automatic input reset |

All recordings had zero page errors and no horizontal overflow at 800px. Eight GIFs are 511998–1893535 bytes each, below 2 MiB. Final static PNGs and separate cancelled-state PNGs are included for reduced motion. Small native File reads can jump directly to 100%; the recordings preserve that behavior instead of synthesizing intermediate upload percentages.

`npm run typecheck` checked the examples; twelve complete TSX integration snippets extracted from the EN/RU guides also passed TypeScript compilation. All 220 local Markdown/image links and anchors passed a path check. `git diff --check` passed. Runtime library source/API is unchanged.

Восемь записей проверяют настоящие действия и состояния UI на ограниченном Node fixture, а не надёжность S3 или Spring-интеграцию. Файловое назначение — настоящий OPFS; полное чтение маленького сохранённого файла используется только скриптом для сравнения байтов, не примером скачивания. Исходники записи и сервера находятся в `scripts/capture-visuals.mjs` и `scripts/visual-demo.mjs`; raw videos и `verification.json` остаются в игнорируемом `output/playwright/visuals/`.
