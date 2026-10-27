# Техническая документация Takt

Это оглавление внутренней технической документации. Общее описание проекта, быстрый старт и актуальный статус реализации находятся в [корневом README](../README.md).

Документы ниже описывают фактическое состояние TypeScript-monorepo:
декларативное JSX-описание экранов, layout/raster pipeline, календарные сцены,
SQLite-backed Fastify API и доставку изображений устройствам.

## Быстрый маршрут

- [Начало работы](getting-started.md) — установка, сборка, запуск и проверка.
- [HTTP API](api.md) — notes, events, deadlines, recurrence, screens и SSE.
- [MCP API](mcp.md) — инструменты событий и различие между series master и разрешённым экземпляром.
- [Архитектура](architecture.md) — границы пакетов, зависимости и поток данных.
- [JSX и UI tree](concepts/jsx-ui-tree.md) — runtime, компоненты, нормализация и сериализуемое дерево.
- [Layout и rendering](concepts/layout-rendering.md) — measure/arrange, rasterization, изображения и PNG.
- [Проекты и сцены](concepts/scenes.md) — контекст, настройки экрана и готовые шаблоны.
- [Разработка](development.md) — как расширять уже существующие механизмы.

## Пакеты и приложения

| Часть             | Ответственность                                   | Документация                       |
| ----------------- | ------------------------------------------------- | ---------------------------------- |
| `@takt/ui`        | JSX runtime, примитивы, нормализация в `UINode[]` | [UI](packages/ui.md)               |
| `@takt/renderer`  | layout, монохромная растеризация, экспорт PNG     | [Renderer](packages/renderer.md)   |
| `@takt/templates` | типы проектов/сцен и две сцены календаря          | [Templates](packages/templates.md) |
| `@takt/backend`   | Node Canvas environment и HTTP-выдача сцен        | [Backend](packages/backend.md)     |

## Текущие границы реализации

В репозитории пока нет web-приложения, firmware и CalDAV-синхронизации. Backend
уже использует SQLite/libSQL, предоставляет mutation API для заметок, событий и
дедлайнов, поддерживает recurrence/occurrence exceptions, вычисляет семантические
hashes экранов и отправляет изменения через SSE.
