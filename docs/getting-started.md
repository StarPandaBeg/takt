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

Backend будет доступен на `http://localhost:3011`. Порт хоста и timezone можно
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

### Публикация образа в GHCR

Workflow [`.github/workflows/docker.yml`](../.github/workflows/docker.yml)
собирает образ для `linux/amd64` через Buildx и использует GitHub Actions cache.
Имя образа формируется из `github.repository` в нижнем регистре. Для этого
репозитория оно имеет вид `ghcr.io/starpandabeg/takt`.

- push в `main` публикует `ghcr.io/starpandabeg/takt:latest`;
- push тега `v1.2.0` публикует `ghcr.io/starpandabeg/takt:v1.2.0`, не изменяя
  `latest`;
- pull request в `main` только собирает образ и не авторизуется в GHCR;
- ручной запуск публикует immutable-style тег `sha-<короткий-commit-sha>`.

Workflow использует только встроенный `GITHUB_TOKEN`. В настройках GitHub
следует проверить, что Actions разрешены политикой репозитория/организации и
что workflow может запрашивать `packages: write`. После первой публикации пакет
появится в разделе Packages. Для анонимного скачивания с сервера сделайте пакет
public; для private-пакета предоставьте серверу отдельный read-only credential
с правом `read:packages`. Это не требуется для самого CI.

### Запуск опубликованного образа на сервере

Создайте рядом с `compose.yaml` файл `.env`:

```dotenv
AUTH_TOKEN=replace-with-a-long-random-token
TAKT_IMAGE=ghcr.io/starpandabeg/takt:v1.2.0
TAKT_PORT=3011
DEFAULT_TIMEZONE=Europe/Moscow
```

Затем скачайте и запустите образ без локальной сборки:

```bash
docker compose pull backend
docker compose up -d --no-build backend
docker compose ps
```

Для public-пакета вход в GHCR не нужен. Для private-пакета сначала выполните
`docker login ghcr.io` с учётными данными, имеющими только `read:packages`.
Обновление версии выполняется изменением `TAKT_IMAGE`, повторным `pull` и
`up -d --no-build`. Именованный том `takt-data` при этом сохраняется.

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
