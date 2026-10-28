# Начало работы

## Требования

- Node.js с поддержкой ESM, npm workspaces, `CompressionStream`, `Blob` и `Intl.Segmenter`.
- npm и платформенная сборка `@napi-rs/canvas` для вашей ОС.

Точная минимальная версия Node.js в `package.json` не закреплена. Репозиторий использует типы Node 22 и проверен документацией на установленном Node.js 22.22.3 / npm 10.9.8, поэтому Node.js 22 — практический безопасный выбор.

## Установка и проверка

Из корня репозитория:

```bash
npm install
npm run build
npm test
```

`npm test` сам выполняет полную сборку, а затем запускает `node --test tests/*.test.mjs`. Дополнительные проверки:

```bash
npm run typecheck
npm run lint
```

Доступные build-команды:

```bash
npm run build              # tsc --build --force
npm run build:incremental  # tsc --build
npm run build:clean        # удалить outputs через tsc --build --clean
npm run rebuild            # clean + полная сборка
```

## Запуск backend

Обычный режим:

```bash
npm run build
AUTH_TOKEN=replace-with-a-long-random-token npm start
```

По умолчанию Fastify слушает `0.0.0.0:3000`. Переменные `HOST` и `PORT` читаются напрямую из окружения:

```bash
HOST=127.0.0.1 PORT=3001 AUTH_TOKEN=replace-me npm start
```

После запуска доступны две сцены и metadata endpoint:

```text
GET /screens/main
GET /screens/main/png
GET /screens/main/esp
GET /screens/splash
GET /screens/splash/png
GET /screens/splash/esp
GET /screens/events
```

PNG и ESP endpoints возвращают `Cache-Control: no-store`. `/screens/events`
открывает SSE-поток изменений. Неизвестное имя сцены возвращает
`404 Not Found`. Полный контракт приведён в [HTTP API](api.md).

Режим разработки сначала собирает проект, затем параллельно запускает TypeScript watch и backend с `node --watch`:

```bash
AUTH_TOKEN=replace-me npm run dev
```

## Запуск в Docker

Для тестового сервера достаточно Docker Compose:

```bash
AUTH_TOKEN=replace-with-a-long-random-token docker compose up --build -d
docker compose ps
```

Backend будет доступен на `http://localhost:3000`. Порт хоста и timezone можно
переопределить без изменения compose-файла:

```bash
AUTH_TOKEN=replace-me TAKT_PORT=8080 DEFAULT_TIMEZONE=Asia/Yekaterinburg docker compose up --build -d
```

SQLite хранится в именованном томе `takt-data` и не теряется при пересоздании
контейнера. Перед каждым запуском backend автоматически применяет новые Drizzle
миграции. Проверить состояние можно запросом `GET /health` или через
`docker compose ps`; посмотреть журнал — командой:

```bash
docker compose logs -f backend
```

Для обновления развертывания получите новую версию исходников и повторите
`docker compose up --build -d`. Для всех API, MCP и screen-запросов передавайте
`Authorization: Bearer <AUTH_TOKEN>`. Endpoint `/health` намеренно остаётся
публичным для оркестратора. Несмотря на наличие токена, для публичного сервера
используйте HTTPS через reverse proxy, чтобы секрет не передавался открытым
текстом.

## Минимальный renderer example

Renderer платформенно независим, но вызывающая сторона обязана предоставить операции текста и изображений:

```ts
import { createRenderer } from '@takt/renderer'
import { Rect, Text } from '@takt/ui/components'

const render = createRenderer({
    measureText(value, style) {
        return { width: value.length * style.fontSize, height: style.fontSize }
    },
    rasterizeText(value, style) {
        const size = this.measureText(value, style)
        return { ...size, buffer: new Uint8Array(size.width * size.height) }
    },
    loadImage() {
        throw new Error('В этом примере Image не используется')
    },
})

const frame = render({
    viewport: { width: 200, height: 80 },
    content: [
        <Rect width={200} height={80} stroke />,
        <Text x={12} y={12}>Takt</Text>,
    ],
})
```

В реальном Node-приложении backend использует `createNodeEnvironment()`, который измеряет и растеризует текст через `@napi-rs/canvas`, а изображения требует предварительно передать в `preloadImages(content)`. Полный pipeline описан в [renderer](packages/renderer.md).

> Пример TSX предполагает `"jsx": "react-jsx"` и `"jsxImportSource": "@takt/ui"`, как в пакетах репозитория.
