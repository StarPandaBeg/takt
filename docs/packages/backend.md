# Приложение `@takt/backend`

Backend — Fastify composition root. Он связывает bundled templates, renderer, Node Canvas environment и PNG exporter. Пакет private и не объявляет `exports`, поэтому его функции используются внутри workspace/tests, а не как опубликованный API.

## HTTP API

### `GET /screen/:screen`

`screen` ищется в `project.scenes`. Реализованы `blank` и `splash`.

- успех: `200`, `Content-Type: image/png`, `Cache-Control: no-store`;
- неизвестная сцена: `404` с телом `Not Found`;
- Fastify также обслуживает `HEAD` для route.

На каждый запрос backend получает `DateTime.now()`, добавляет hard-coded arrays `events`, `deadlines` и `notes`, генерирует сцену и заново рендерит PNG. Persistence, mutation endpoints, auth, caching/revisions и SSE отсутствуют. CORS настроен как `origin: '*'`.

## `buildApp`

```ts
interface AppOptions {
    readonly logger?: boolean
}

function buildApp(options: AppOptions = {}): FastifyInstance
```

Logger по умолчанию включён. Тесты используют Fastify `inject` и `logger: false`.

## Node render environment

`createNodeEnvironment(options)` реализует общий `RenderEnvironment` через `@napi-rs/canvas` и добавляет `preloadImages`:

```ts
interface NodeEnvironmentOptions {
    readonly assetRoot?: string
    readonly imageCacheSize?: number
}

interface NodeRenderEnvironment extends RenderEnvironment {
    preloadImages(content: JSXChild): Promise<void>
}
```

- `assetRoot` по умолчанию — корень репозитория.
- Relative image paths разрешаются относительно `assetRoot`; `file:` URL поддерживаются напрямую.
- Другие URL schemes, включая HTTP(S), отклоняются.
- `preloadImages` сначала вызывает UI `resolve`, собирает unique image paths и декодирует их параллельно.
- `loadImage` синхронен и работает только для уже подготовленного/закэшированного ресурса.
- LRU cache по умолчанию хранит 32 decoded images; `0` отключает долговременный cache.
- Cache signature включает file size, `mtimeNs` и `ctimeNs`, поэтому изменение файла инвалидирует запись.

Text geometry и alpha bitmap строятся одной Canvas implementation. `metrics: 'font'` использует font bounding box, `tight` — actual glyph bounds. Underline и strikethrough включаются и в измерение, и в rasterization.

## Запуск

`main.ts` читает `HOST` (default `0.0.0.0`) и `PORT` (default `3000`, допустимо целое `0..65535`), запускает Fastify и корректно закрывает его по `SIGINT`/`SIGTERM`. Команды приведены в [начале работы](../getting-started.md).

