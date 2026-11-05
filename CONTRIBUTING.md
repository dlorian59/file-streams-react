# Local artifacts and development / Локальные артефакты и разработка

[← README](README.md) · [Integration EN](docs/integration/en.md) · [Интеграция RU](docs/integration/ru.md)

The npm packages are not yet published. Work from sibling `file-streams` and `file-streams-react` checkouts with Node 22.12+ and npm. Runtime dependencies remain versioned peers; the sibling file dependency is development-only.

Пакеты ещё не опубликованы в npm. Для работы нужны соседние checkout `file-streams` и `file-streams-react`, Node 22.12+ и npm. Runtime dependencies остаются версионными peers; зависимость на соседний каталог используется только при разработке.

```bash
(cd ../file-streams/browser && npm ci && npm run build)
npm ci
npm run typecheck
npm test
npm run test:package
```

To install the exact built artifacts into an existing application / Подключить собранные артефакты к существующему приложению:

```bash
mkdir -p output/packages
(cd ../file-streams/browser && npm pack --pack-destination ../../file-streams-react/output/packages)
npm pack --pack-destination output/packages
```

From that application's directory, use the actual paths to both `.tgz` files / Из каталога приложения передайте реальные пути к обоим `.tgz`:

```bash
npm install /path/to/59alex-file-streams-0.1.0.tgz /path/to/59alex-file-streams-react-0.1.0.tgz
```

`test:package` independently packs both artifacts and checks their public entry points in fresh React 18.3.1 and React 19.3.1 consumers. This proves local package consumption, not availability on npm.

`test:package` отдельно упаковывает оба артефакта и проверяет public entry в чистых потребителях React 18.3.1 и React 19.3.1. Это проверка локальных пакетов, не доступности в npm.

## Spring and S3 / Spring и S3

See the complete [EN](docs/integration/en.md#run-and-record) / [RU](docs/integration/ru.md#запуск-и-запись) setup. The Spring starter owns the backend launcher, TLS and S3 configuration. After it is ready on HTTPS 19443:

```bash
npm run demo:spring
```

Open `https://127.0.0.1:5173/?lang=en` or `?lang=ru`. For a headless recording, stop the frontend first and run:

Откройте `https://127.0.0.1:5173/?lang=en` или `?lang=ru`. Для headless-записи сначала остановите frontend, затем:

```bash
npm run capture:attachment
```

The recorder owns only its frontend/browser and stops them. The operator owns the backend/storage process. Local test certificates and recordings remain under ignored `output/`; public GIF/PNG images are under `assets/visuals/`.

Recorder владеет только своим frontend/browser и останавливает их. Backend/storage остаются под управлением запустившего их оператора. Локальные сертификаты и видео находятся в игнорируемом `output/`; опубликованные GIF/PNG — в `assets/visuals/`.

The older independent component demonstrations remain runnable with `npm run demo:visuals`; their memory fixture and full recording procedure are described in the [visual guide](docs/visuals/en.md#reproduce-recordings-and-checks). They are not S3 tests.

Прежние независимые демонстрации компонентов доступны через `npm run demo:visuals`; memory fixture и запись описаны в [визуальном руководстве](docs/visuals/ru.md#воспроизвести-записи-и-проверки). Это не тесты S3.
