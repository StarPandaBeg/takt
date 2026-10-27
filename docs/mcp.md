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

## `update_event`

Изменяет master-серию, один экземпляр либо выбранный экземпляр и все будущие:

```ts
interface UpdateEventInput {
    id: number
    scope: 'series' | 'occurrence' | 'this_and_future'
    recurrenceId?: string
    changes: {
        title?: string
        description?: string | null
        start?: string
        end?: string | null
        timezone?: string | null
        allDay?: boolean
        recurrence?: Recurrence | null
    }
}
```

`changes` должен содержать хотя бы одно поле. Отсутствующее поле сохраняет
текущее значение; явный `null` очищает nullable-поле. Если меняется только
`start`, существующая длительность сохраняется. `end: null` делает событие или
экземпляр точечным.

- `series` изменяет исходный master. `recurrenceId` не нужен. Изменение
  `start`, `end`, `timezone` или `recurrence` очищает его occurrence overrides.
- `occurrence` требует точный `recurrenceId` из `get_events`. Изменения
  сохраняются как полный override выбранного экземпляра. Поле `recurrence`
  для этого scope запрещено.
- `this_and_future` требует `recurrenceId` и разделяет серию перед выбранным
  экземпляром. Старый master получает конечный `count` или `until`, новый
  master начинается с выбранного экземпляра и получает изменения. Исключения
  до точки разделения остаются у старой серии; исключения начиная с неё
  удаляются, поскольку после изменения времени, timezone или recurrence их
  идентификаторы могут стать недействительными.

Если выбран первый экземпляр, `this_and_future` эквивалентен `series` и новый
master не создаётся. В остальных случаях результат `{ id }` содержит ID новой
будущей серии; для двух других scope это ID исходного master.

## `cancel_event`

Отменяет один экземпляр, выбранный и все будущие экземпляры либо всю серию:

```ts
interface CancelEventInput {
    id: number
    scope: 'series' | 'occurrence' | 'this_and_future'
    recurrenceId?: string
}
```

- `series` выполняет мягкое удаление master-события, устанавливая
  `cancelledAt`. Оно перестаёт попадать в `search_events`, `get_events` и экран,
  но остаётся доступно через `get_event(id)`.
- `occurrence` требует `recurrenceId` и сохраняет cancellation exception.
- `this_and_future` требует `recurrenceId` и завершает RRULE перед выбранным
  экземпляром. Прошлые exceptions сохраняются, выбранный и более поздние
  удаляются как больше не относящиеся к активной части серии.

Если `this_and_future` указывает на первый экземпляр, отменяется вся серия.
Результат для всех scope — `{ id }` исходного master-события.

## Инструменты дедлайнов

### `get_deadline`

Возвращает deadline master по ID вместе с `recurrence`, полным массивом
`exceptions` и `cancelledAt`. Мягко отменённая запись остаётся доступна по ID.

### `get_deadlines`

Возвращает фактические экземпляры дедлайнов начиная с inclusive-границы
`from`. Повторения и occurrence overrides уже применены.

```ts
interface GetDeadlinesInput {
    from: string
    limit?: number // 1..8192, default 128
    withCompleted?: boolean // default false
}
```

Каждый результат содержит ID master, эффективные `title`, `description`,
`due`, `dueIsDate`, `timezone`, `completed` и исходный `recurrenceId` либо
`null` для одиночного дедлайна.

### `search_deadlines`

Ищет активные master-записи без раскрытия повторений. Поддерживает optional
`from`, `to`, `query`, `limit` и `withCompleted`. Временные границы относятся к
исходному `due` master, `query` ищет подстроку в title и description.

### `create_deadline`

Создаёт одиночный или повторяющийся дедлайн. Принимает `title`, `description`,
`due`, `dueIsDate`, IANA `timezone`, `completed` и `recurrence`. Возвращает
`{ id }`.

### `update_deadline`

Использует тот же `scope`, что `update_event`:

```ts
interface UpdateDeadlineInput {
    id: number
    scope: 'series' | 'occurrence' | 'this_and_future'
    recurrenceId?: string
    changes: {
        title?: string
        description?: string | null
        due?: string
        dueIsDate?: boolean
        timezone?: string
        recurrence?: Recurrence | null
        completed?: boolean
    }
}
```

Один occurrence хранится как полный override и не может менять recurrence.
`this_and_future` разделяет серию и возвращает ID нового будущего master.

### `cancel_deadline`

Поддерживает `series`, `occurrence` и `this_and_future`. Вся серия отменяется
мягко через `cancelledAt`; один экземпляр получает cancellation exception;
текущий и будущие обрезают RRULE перед выбранным `recurrenceId`.

### `set_deadline_completion`

Отмечает дедлайн выполненным или возвращает его в работу:

```ts
interface SetDeadlineCompletionInput {
    id: number
    scope: 'series' | 'occurrence' | 'this_and_future'
    recurrenceId?: string
    completed: boolean
}
```

Для одного occurrence состояние сохраняется в override. Для
`this_and_future` создаётся новая серия и возвращается её ID.
