# Техническая документация Takt

Это оглавление внутренней технической документации. Общее описание проекта, быстрый старт и актуальный статус реализации находятся в [корневом README](../README.md).

Документы ниже описывают фактическое состояние TypeScript-monorepo: декларативное JSX-описание экранов, layout/raster pipeline, две календарные сцены и Fastify endpoint, который возвращает сгенерированный PNG.

## Быстрый маршрут

- [Начало работы](getting-started.md) — установка, сборка, запуск и проверка.
- [Архитектура](architecture.md) — границы пакетов, зависимости и поток данных.
- [JSX и UI tree](concepts/jsx-ui-tree.md) — runtime, компоненты, нормализация и сериализуемое дерево.
- [Layout и rendering](concepts/layout-rendering.md) — measure/arrange, rasterization, изображения и PNG.
- [Проекты и сцены](concepts/scenes.md) — контекст, настройки экрана и готовые шаблоны.
- [Разработка](development.md) — как расширять уже существующие механизмы.

## Пакеты и приложения

| Часть | Ответственность | Документация |
| --- | --- | --- |
| `@takt/ui` | JSX runtime, примитивы, нормализация в `UINode[]` | [UI](packages/ui.md) |
| `@takt/renderer` | layout, монохромная растеризация, экспорт PNG | [Renderer](packages/renderer.md) |
| `@takt/templates` | типы проектов/сцен и две сцены календаря | [Templates](packages/templates.md) |
| `@takt/backend` | Node Canvas environment и HTTP-выдача сцен | [Backend](packages/backend.md) |

## Текущие границы реализации

В репозитории нет web-приложения, firmware, базы данных, синхронизации CalDAV, SSE, revision/hash протокола и API редактирования календаря. Они описаны в `AGENTS.md` как направление продукта, но не являются реализованными возможностями. Текущий backend использует демонстрационные данные в памяти и рендерит PNG при каждом запросе.

