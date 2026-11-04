# file-streams-react

<details name="readme-language">
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-en-dark.svg"><img src="assets/lang-en-light.svg" width="42" height="26" alt="EN"></picture></summary>

[0.1.0 guide](docs/0.1.0/en.md) · [API reference](docs/0.1.0/reference.en.md) · [Versions](docs/index.md) · [MIT](LICENSE)

React components and hooks for continuous file uploads and downloads. Add an attachment to a form with progress, cancellation and a confirmed storage result; connect the same endpoint to the [Spring Boot starter](https://github.com/59Alex/file-streams-spring-boot-starter).

```tsx
import { FileUpload } from '@59alex/file-streams-react';

<FileUpload objectsUrl="https://files.example.com/objects"
  scope="account-42" objectKey="tickets/123/attachment.bin"
  maxBytes={8 * 1024 * 1024} onCommitted={setSaved} />
```

`setSaved` is your application callback. The complete [attachment example](examples/attachments/Attachments.tsx) provides it and pairs upload with download. The [guide](docs/0.1.0/en.md#1-upload-an-attachment-and-receive-it-in-java) shows the Java configuration and the matching request/response.

| Capability | Practical example |
| --- | --- |
| React 19 form Actions (optional entry) | [Form integration](examples/attachments/ActionAttachment.tsx) |
| File input, progress and validated commit | [Ticket attachment](examples/attachments/Attachments.tsx) |
| Streaming download to an application-owned sink | [Save the attachment](docs/0.1.0/en.md#2-download-directly-to-a-destination) |
| Unknown-length generated content | [CSV report](examples/attachments/GeneratedReport.tsx) |
| Cancellation and explicit uncertain outcomes | [Cancelable import](examples/attachments/CancelableImport.tsx) |
| Byte-range preview | [First 4 KiB](examples/attachments/PartialPreview.tsx) |
| Custom UI, labels, scope changes and SSR | [Hooks and ownership](docs/0.1.0/en.md#5-customize-ui-and-account-ownership) |

With `file-streams` checked out next to this repository, Node 22.12+:

```bash
(cd ../file-streams/browser && npm ci && npm run build)
npm ci
npm test
npm run typecheck
npm run test:package
```

This builds from source; registry publication is separate. [Run React and Spring together](docs/0.1.0/en.md#6-run-the-paired-example). The package reuses `@59alex/file-streams`; it adds no second upload protocol, chunk scheduler or whole-file buffer. The base entry works with React 18.3+/19; the optional `/react19` entry integrates native form Actions. Packed consumers were checked on React 18.3.1 and 19.3.1.

Progress is not confirmation: a fully read source can still fail during storage commit. Failed/cancelled uploads may have an unknown result. One hook owns one active operation. Browser upload needs a working streaming transport, normally HTTP/2/TLS. Custom download destinations remain application-owned. [Verified scope and limits](docs/0.1.0/en.md#troubleshooting-and-verified-limits).

</details>

<details name="readme-language" open>
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-ru-dark.svg"><img src="assets/lang-ru-light.svg" width="42" height="26" alt="RU"></picture></summary>

[Руководство 0.1.0](docs/0.1.0/ru.md) · [Справочник API](docs/0.1.0/reference.ru.md) · [Версии](docs/index.md) · [MIT](LICENSE)

React-компоненты и hooks для непрерывной загрузки и скачивания файлов. Подключают вложение к форме вместе с прогрессом, отменой и подтверждённым результатом сохранения. На другой стороне того же endpoint работает [Spring Boot-стартер](https://github.com/59Alex/file-streams-spring-boot-starter).

```tsx
import { FileUpload, russianLabels } from '@59alex/file-streams-react';

<FileUpload objectsUrl="https://files.example.com/objects"
  scope="account-42" objectKey="tickets/123/attachment.bin"
  maxBytes={8 * 1024 * 1024} onCommitted={setSaved} labels={russianLabels} />
```

`setSaved` — callback приложения. Полный [пример вложения](examples/attachments/Attachments.tsx) содержит его реализацию и скачивание. В [руководстве](docs/0.1.0/ru.md#1-загрузить-вложение-из-react-и-принять-его-в-java) рядом показаны Java-конфигурация и соответствующие запрос/ответ.

| Возможность | Практический пример |
| --- | --- |
| Actions формы React 19 (отдельный entry) | [Интеграция формы](examples/attachments/ActionAttachment.tsx) |
| Выбор файла, прогресс и проверенное подтверждение | [Вложение к заявке](examples/attachments/Attachments.tsx) |
| Потоковое скачивание в назначение приложения | [Сохранение вложения](docs/0.1.0/ru.md#2-скачать-файл-прямо-в-назначение) |
| Генерация данных неизвестной длины | [CSV-отчёт](examples/attachments/GeneratedReport.tsx) |
| Отмена и явный неизвестный результат | [Отмена импорта](examples/attachments/CancelableImport.tsx) |
| Предпросмотр диапазона | [Первые 4 КиБ](examples/attachments/PartialPreview.tsx) |
| Свой UI, перевод, смена аккаунта и SSR | [Hooks и владение](docs/0.1.0/ru.md#5-подключить-свой-интерфейс-и-смену-аккаунта) |

При соседнем checkout `file-streams` и Node 22.12+:

```bash
(cd ../file-streams/browser && npm ci && npm run build)
npm ci
npm test
npm run typecheck
npm run test:package
```

Это сборка из исходников; публикация в реестре выполняется отдельно. [Запуск React вместе со Spring](docs/0.1.0/ru.md#6-запустить-парный-пример). Пакет переиспользует `@59alex/file-streams`: не добавляет второй протокол, планировщик частей или полный буфер файла. Основной entry поддерживает React 18.3+/19; отдельный `/react19` подключает Actions формы. Упакованные потребители проверены на React 18.3.1 и 19.3.1.

Прогресс не является подтверждением: после чтения всех байтов сохранение ещё может завершиться ошибкой. Результат отменённой/неуспешной загрузки может остаться неизвестным. Один hook владеет одной активной операцией. Браузерной загрузке нужен рабочий потоковый транспорт, обычно HTTP/2/TLS. Назначение скачивания предоставляет приложение. [Границы проверки](docs/0.1.0/ru.md#диагностика-и-границы-проверки).

</details>
