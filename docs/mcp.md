# MCP API backend

MCP endpoint доступен по `/mcp`. Инструменты событий используют тот же
application service, что HTTP API и источники экранов, поэтому правила
повторения и occurrence exceptions обрабатываются одинаково во всех трёх
точках входа.

## `get_events`

Возвращает фактические экземпляры событий в полуоткрытом диапазоне
`[start, end)`. Инструмент сам разворачивает повторения, исключает отменённые
экземпляры и применяет переносы.

Вход:

```ts
interface GetEventsInput {
    start: string // ISO 8601 с offset, inclusive
    end: string // ISO 8601 с offset, exclusive
    limit?: number // integer 1..8192
}
```

Выход — массив:

```ts
interface ResolvedEvent {
    id: number // ID исходного master-события
    title: string
    description: string | null
    start: string // фактическое время после переноса
    end: string | null
    timezone: string | null
    allDay: boolean
    recurrenceId: string | null
}
```

`recurrenceId` — исходное запланированное время конкретного экземпляра серии.
Оно не меняется при переносе и позволяет обратиться к исключению серии. Для
неповторяющегося события значение равно `null`. Полей `recurrence` и
`exceptions` в этом результате намеренно нет: они уже применены.

## `get_event`

Получает сохранённую сущность события по её положительному целочисленному
`id`. Возвращает master с `recurrence` и полным массивом `exceptions`; если
событие отсутствует, возвращает `null`.

Этот инструмент нужен для просмотра и последующего редактирования самой серии.
В отличие от `get_events`, он не материализует отдельные экземпляры.

## `search_events`

Ищет исходные master-события, чтобы модель могла определить их `id`. Все поля
входа optional:

```ts
interface SearchEventsInput {
    from?: string // inclusive граница master start
    to?: string // exclusive граница master start
    query?: string // подстрока в title или description
    limit?: number // integer 1..8192
}
```

`query` применяется как регистронезависимый SQL `LIKE` по `title` и
`description`. `from` и `to` фильтруют исходный `start` master-события и могут
использоваться независимо. Если обе границы заданы, `to` должна быть позже
`from`.

Результат имеет тот же формат master-сущности, что `get_event`: в нём есть
`recurrence` и `exceptions`. Повторения не раскрываются, переносы не изменяют
`start`/`end` master-события. Это отличает инструмент от `get_events`, который
возвращает готовое расписание.

## `create_event`

Создаёт одиночное или повторяющееся событие. Поддерживает `title`,
`description`, `start`, `end`, `timezone`, `allDay` и `recurrence`. Форматы
правил повторения совпадают с разделом [Повторение](api.md#повторение) HTTP API.
Возвращает `{ id: number }`.
