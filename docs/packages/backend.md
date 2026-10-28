# Приложение `@takt/backend`

Backend — Fastify composition root. Он связывает bundled templates, renderer, Node Canvas environment и PNG exporter. Пакет private и не объявляет `exports`, поэтому его функции используются внутри workspace/tests, а не как опубликованный API.

## HTTP API

Backend использует SQLite/libSQL и предоставляет CRUD/command endpoints для
заметок, событий и дедлайнов. Повторение хранится в формате iCalendar RRULE;
отмены и переносы отдельных экземпляров моделируются через RECURRENCE-ID
overrides. Экраны доступны как PNG, ESP framebuffer и metadata с семантическим
hash. Изменения hash доставляются через долгоживущее SSE-соединение.

Источник дедлайнов календарного экрана сначала применяет recurrence и все
occurrence overrides, а затем оставляет только ближайший фактический экземпляр
каждого master-дедлайна. Это правило относится только к экрану: HTTP и MCP API
по-прежнему могут возвращать несколько экземпляров одной серии.

Полный актуальный контракт, включая все поля и примеры payload, описан в
[HTTP API](../api.md).

## `buildApp`

```ts
interface AppOptions {
    readonly logger?: boolean
    readonly authToken?: string | false
}

function buildApp(options: AppOptions = {}): FastifyInstance
```

Logger по умолчанию включён. `authToken` по умолчанию читается из обязательной
переменной `AUTH_TOKEN`; `false` разрешён только для изолированных тестов.
Публичным остаётся только `GET /health`, остальные маршруты требуют Bearer-токен.
Тесты используют Fastify `inject`, `logger: false` и явное отключение проверки.

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

`main.ts` читает `HOST` (default `0.0.0.0`), `PORT` (default `3000`, допустимо
целое `0..65535`) и обязательный `AUTH_TOKEN`, запускает Fastify и корректно
закрывает его по `SIGINT`/`SIGTERM`. Команды приведены в
[начале работы](../getting-started.md).

