# Справочник API — file-streams-react 0.1.0

[← Руководство](ru.md) · [Версии](../index.md) · [README](../../README.md) · [English](reference.en.md)
[Визуальные примеры](../visuals/ru.md)

## Выбор точки входа

| Импорт | React | Экспорты и назначение |
| --- | --- | --- |
| `@59alex/file-streams-react` | 18.3.1 или 19 | Hooks загрузки/скачивания, файловые компоненты, статус, подписи и их типы |
| `@59alex/file-streams-react/react19` | Только 19 | `useFileUploadAction`, `FileUploadActionOptions`, `FileUploadActionResult`: нативные Actions формы |

Оба entry сохраняют `use client`; импорт и серверный рендер не открывают потоки и не запускают сеть. Actions нужен клиентский JavaScript: это не Server Function и не загрузка без JavaScript. Дополнительный entry не входит в граф импортов React 18. Версии React и React DOM должны совпадать. В [официальном списке React](https://react.dev/versions) актуальна ветка 19.3; проверенные 2026-11-05 registry-версии React/React DOM — 19.3.1. Базовый упакованный пакет также проверен на 18.3.1.

## Карта возможностей

| Задача | API | Исходник для адаптации | Граница |
| --- | --- | --- | --- |
| Прикрепить файл, разрешить скачивание после сохранения | `FileUpload`, `FileDownload` | [Attachments](../../examples/attachments/Attachments.tsx) | Сервер проверяет доступ к ключу; прогресс не равен commit |
| Подключить свой UI без повторения lifecycle-кода | `useFileUpload`, `useFileDownload`, `TransferStatus` | [GeneratedReport](../../examples/attachments/GeneratedReport.tsx), [PartialPreview](../../examples/attachments/PartialPreview.tsx) | Одна активная операция на hook |
| Встроить передачу в форму React 19 | `useFileUploadAction` | [ActionAttachment](../../examples/attachments/ActionAttachment.tsx) | Клиентский Action, одно файловое поле; без multipart POST |
| Остановить импорт при уходе или отмене | `cancel`, `scope` | [CancelableImport](../../examples/attachments/CancelableImport.tsx) | Отправленная загрузка могла сохраниться |
| Прочитать небольшой участок для предпросмотра | `download` с range | [PartialPreview](../../examples/attachments/PartialPreview.tsx) | Смещения в байтах, не строки текста и не автоматическое возобновление |
| Использовать свой дизайн и язык | Labels, `className`, `renderError` | [Attachments](../../examples/attachments/Attachments.tsx) | Стили не включены; сообщение ошибки не должно обещать откат |

## Общие параметры: `FileStreamsOptions`

Используются обоими базовыми hooks, компонентами и hook React 19. Все поля readonly.

| Поле | Тип / значение по умолчанию | Контракт |
| --- | --- | --- |
| `objectsUrl` | Обязательный `string` | Абсолютный endpoint, например `https://files.example/objects`; без query/fragment. Логический ключ кодируется один раз в один сегмент пути. |
| `maxBytes` | Обязательный `number` | Неотрицательное безопасное целое число байт; ноль разрешает только пустые файлы. Клиентский лимит не заменяет серверный. |
| `scope` | Необязательный `string` | Идентификатор аккаунта/tenant/области доступа. Меняйте синхронно с credentials, не откладывайте через transition. |
| `headers` | Необязательный `HeadersInit`, пустые | Заголовки приложения/авторизации. Не задавайте `Content-Length`, `X-Upload-Length`, `Content-Range` для загрузки и `Range` для скачивания. |
| `credentials` | Необязательный `RequestCredentials`, `same-origin` | Политика cookie fetch. Для cross-origin credentials нужна соответствующая серверная политика CORS. |
| `fetch` | Необязательный `typeof fetch`, fetch среды | Свой транспорт обязан сохранять потоковую передачу, backpressure и семантику AbortSignal. |

Смена endpoint, scope или лимита отменяет активную работу и скрывает старое состояние. Одной смены headers недостаточно для отзыва активной операции: меняйте также `scope`. Unmount отменяет работу. При использовании hooks напрямую приложение отвечает за свои данные аккаунта, выбранные файлы и callbacks. Компоненты дополнительно включают `objectKey` в область операции.

## Базовые hooks и `TransferState<Result>`

`useFileUpload(options)` возвращает `state`, `upload`, `uploadFile`, `cancel`, `reset`. `useFileDownload(options)` возвращает `state`, `download`, `cancel`, `reset`.

| Метод | Результат | Поведение |
| --- | --- | --- |
| `upload(input: StreamUpload)` | `Promise<UploadCommit>` | Читает новый незахваченный поток байтов; завершается только после проверенного commit сервера. |
| `uploadFile(key: string, file: Blob)` | `Promise<UploadCommit>` | Использует `file.stream()`, `file.size` и непустой `file.type`; File подходит как Blob. |
| `download(key: string, destination: Destination, range?: ByteRange)` | `Promise<DownloadResult>` | Проверяет метаданные, ожидает записи и закрытия sink. Фабрика назначения запускается из вызова, сохраняя возможность открыть picker по нажатию. |
| `cancel()` | `void` | Кооперативная отмена активной операции; безопасна в idle. Не удаляет удалённый файл и не откатывает записи sink. |
| `reset()` | `void` | Очищает завершённое состояние UI. Бросает ошибку при активной операции или вызове старого callback из другой области. |

Обрабатывайте rejected promises, даже когда показываете состояние hook. Запуск второй операции при активной, запуск после unmount или вызов старой области отклоняется с `Error`. Базовые hooks не содержат неявной очереди, повтора или переигрывания потока.

`StreamUpload`: обязательные `key: string` (непустой, не `.`/`..`), `source: ReadableStream<Uint8Array>`; необязательные `knownLength: number` (неотрицательное безопасное целое, точное количество байт) и `contentType: string`. Передавайте длину, когда она известна. EOF неизвестной длины не доказывает бизнес-полноту; см. [наблюдаемую границу отмены](../VERIFICATION.md#обнаруженная-граница-неизвестной-длины).

`Destination = WritableStream<Uint8Array> | (() => Promise<WritableStream<Uint8Array>>)`. Для каждой попытки нужен новый незахваченный sink. Если picker завершится после отмены, поздний sink будет отменён без GET. Полного Blob fallback нет. Sink может успеть применить запись до отмены; атомарность сохранения зависит от его реализации.

| `state.status` | Дополнительные поля | Значение |
| --- | --- | --- |
| `idle` | `bytes: 0`, `total: undefined` | В этой области нет отображаемой операции |
| `transferring` | `bytes: number`, `total: number \| undefined` | Прочитанные байты загрузки или записанные байты скачивания. Включает ожидание commit/закрытия sink даже при 100%. |
| `complete` | `bytes`, `total`, `result: Result` | Подтверждённая загрузка или проверенное скачивание с закрытым назначением |
| `failed` | `bytes`, `total`, `error: unknown` | Исходная ошибка; отмена тоже является неуспешным завершением |

Типы результата и диапазона импортируются из `@59alex/file-streams`, адаптер их не реэкспортирует:

| Тип | Поля |
| --- | --- |
| `UploadCommit` | `committed: true`, `key: string`, `bytes: number`, `etag: string` |
| `DownloadResult` | `complete: true`, `bytesWritten: number`, `etag: string`, `contentType: string \| null`, `range: DownloadRange \| undefined` |
| `ByteRange` | `{start: number, end?: number}` с включённой правой границей или `{suffix: number}` с положительной длиной хвоста |
| `DownloadRange` | `start`, включённый `end`, `total`: неотрицательные целые байтовые значения проверенного ответа |

## Компоненты и тексты

`FileUpload` и `FileDownload` принимают все общие параметры и следующие props:

| Prop | Тип / значение по умолчанию | Поведение |
| --- | --- | --- |
| `labels` | `TransferLabels`, `englishLabels` | Полный объект подписей; также экспортируется `russianLabels`. |
| `className` | Необязательный `string` | Класс внешнего `<section>`. |
| `disabled` | Необязательный `boolean`, false | Запрещает выбор/запуск; отмена уже активной передачи остаётся доступной. |
| `renderError` | Необязательный `(error: unknown) => ReactNode` | Детали ошибки. Встроенное предупреждение о неизвестном результате загрузки остаётся видимым. |

`FileUploadProps` дополнительно требует `objectKey: string`; необязательный `accept: string` фильтрует native input, но не проверяет содержимое; необязательный `onCommitted(commit: UploadCommit): void` вызывается один раз для видимого подтверждённого результата. Выбор сбрасывается при смене endpoint/scope/key. Во время передачи input и отправка недоступны. Компонент — section с кнопками, не вложенная форма.

`FileDownloadProps` дополнительно требует `objectKey: string` и `destination: Destination`; необязательный `range: ByteRange` задаёт диапазон; необязательный `onComplete(result: DownloadResult): void` вызывается один раз после проверенного закрытия sink. Callbacks уведомляют UI, а не создают транзакцию хранилища. Их исключения обрабатывает приложение; завершение старой области не вызывает callback нового аккаунта.

`TransferStatus<Result>(props)` принимает обязательный `state: TransferState<Result>`, необязательные `labels` и `renderError` с теми же значениями. Idle ничего не рисует; передача показывает подписанный native progress и счётчик; успех — `role="status"`; ошибка — `role="alert"`. При неизвестном total progress остаётся неопределённым.

В `TransferLabels` восемь обязательных строк: `choose`, `upload`, `download`, `cancel`, `progress`, `complete`, `failed`, `unknown`. Экспортированные EN/RU объекты заморожены; создавайте свой вариант через `{...russianLabels, upload: 'Прикрепить'}`.

## Actions формы React 19

[Полный запускаемый исходник](../../examples/attachments/ActionAttachment.tsx); [парная настройка Java](ru.md#1-загрузить-вложение-из-react-и-принять-его-в-java). Пример включён в существующее demo: `npm run demo`. Он использует тот же PUT endpoint, что и компоненты React 18.

`useFileUploadAction(options: FileUploadActionOptions)` добавляет к общим параметрам обязательный `objectKey: string` и необязательный `fieldName: string` (по умолчанию `file`). Скрытое поле формы не может переопределить ключ; проверка доступа остаётся в Java.

| Поле результата | Тип | Применение |
| --- | --- | --- |
| `formAction` | `(data: FormData) => void` | Передайте в `<form action={...}>`. Программный вызов требует `startTransition(() => formAction(data))`. Только выбранный File становится потоковым телом PUT. |
| `isPending` | `boolean` | У React есть ожидающие Actions; отключайте submit, чтобы избежать повторных нажатий. Это не результат сохранения. |
| `state` | `TransferState<UploadCommit>` | Текущий прогресс и детали ошибки транспорта; сбрасывается при запуске следующего Action актуального владельца. |
| `result` | `FileUploadActionResult` | Последний завершённый Action этого lifecycle; сначала `{status:'idle'}`. Пока идёт следующий Action, может сохраняться предыдущий результат. |
| `cancel` | `() => void` | Отменяет активную загрузку и уже поставленные в очередь Actions. Позже можно отправить новую попытку. |

`FileUploadActionResult`: `{status:'idle'}`, `{status:'committed', commit: UploadCommit}` или `{status:'failed', error: unknown}`. Отсутствующее/нефайловое/безымянное поле даёт `TypeError` без запроса. Пустой файл с именем разрешён. Ошибки транспорта сохраняются вместе с `uploadOutcome`; оптимистичного «сохранено» и автоматического повтора нет.

React выполняет Actions последовательно; адаптер повторно проверяет владельца **при извлечении из очереди**. Смена scope/key/field/endpoint/limit и unmount делают старые submissions недействительными и скрывают их результат. Сохранённые старые Actions ничего не делают. React pending может оставаться true, пока старая работа завершается. Отменённый/устаревший элемент очереди пропускается без перезаписи последнего результата. Меняйте scope аккаунта синхронно и задавайте форме key аккаунта, чтобы очистить старый выбор файла в браузере.

Hook возвращает ошибки как данные результата. Поэтому resolved Action может означать `failed`, а React после разрешения очищает uncontrolled поля; для осознанного повтора выберите файл заново. Сначала проверьте неизвестный результат на сервере. Не ожидайте `formAction` через await: dispatch возвращает void; наблюдайте `result`/`isPending`. См. официальные [очередь Actions](https://react.dev/reference/react/useActionState) и [сброс формы](https://react.dev/reference/react-dom/components/form).

## Ошибки и восстановление

`TransferError` импортируется из `@59alex/file-streams`. Поля: `name: 'TransferError'`, `message: string`, `code`, необязательные `status: number`, `uploadOutcome` и `cause`. Ошибки своего picker, URL, lifecycle и callbacks могут иметь другие типы: безопасно обрабатывайте `unknown`.

| `code` | Значение / действие |
| --- | --- |
| `INVALID_ARGUMENT` | Исправьте поток/параметры/управляемые заголовки/диапазон до следующей попытки. |
| `UNSUPPORTED` | Среда не предоставляет нужный потоковый транспорт; выберите поддерживаемую, без скрытого полного буфера. |
| `ABORTED` | Отмена пользователем/lifecycle; объект мог сохраниться, частичные записи sink могли остаться. |
| `LIMIT_EXCEEDED` | Источник/ответ превышает лимит; проверьте политику и входные данные. |
| `LENGTH_MISMATCH` | Длина источника/ответа отличается от объявленной; проверьте данные и сервер. |
| `HTTP_ERROR` | Неожиданный HTTP status; смотрите `status`, авторизацию и серверную политику. |
| `PROTOCOL_ERROR` | Неверный commit/метаданные; проверьте endpoint, proxy и видимость заголовков через CORS. |
| `SOURCE_ERROR` | Ошибка источника или неверные байты; новый источник создаётся только после выяснения результата предыдущей попытки. |
| `SINK_ERROR` | Ошибка записи/закрытия назначения; проверьте его семантику частичных записей и отката. |
| `NETWORK_ERROR` | Сбой fetch/сети; результат уже отправленной загрузки может быть неизвестен. |

`uploadOutcome`: `not-started` — транспорт ещё не начал PUT; `rejected` — проверен явный отказ; `unknown` — объект мог сохраниться. Для скачивания поле undefined. Сброс UI не превращает `unknown` в доказанный отказ: проверьте состояние/версию объекта через приложение до повтора. См. [проверки и границы](../VERIFICATION.md); автоматическое возобновление, защита от перезаписи, проверка хеша и распределённая транзакция не обещаются.

[← Руководство](ru.md) · [Версии](../index.md) · [README](../../README.md)
