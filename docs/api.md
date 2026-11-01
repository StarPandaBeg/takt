# HTTP API backend

Этот документ описывает фактически реализованный HTTP-контракт `@takt/backend`.
Backend построен на Fastify и по умолчанию доступен по адресу
`http://localhost:3000`.

## Общие правила

### Формат данных

- JSON endpoints принимают и возвращают `application/json`.
- Даты во входном JSON следует передавать в RFC 3339 с явным UTC offset или
  суффиксом `Z`: `2026-10-26T10:00:00+03:00` или
  `2026-10-26T07:00:00.000Z`.
- Все `Date` в JSON-ответах сериализуются как ISO 8601 в UTC, например
  `2026-10-26T07:00:00.000Z`.
- Числовые идентификаторы должны быть положительными целыми числами.
- `createdAt` и `updatedAt` выставляются backend и передаются в UTC.
- Все endpoints, кроме `GET /health`, требуют HTTP-заголовок
  `Authorization: Bearer <AUTH_TOKEN>`. При отсутствующем или неверном токене
  backend отвечает `401 Unauthorized`. CORS разрешён для любого origin.

Для событий timezone может быть корректным IANA-именем или `null`; для
дедлайнов — корректным IANA-именем. Если timezone не передана при создании,
backend использует текущую настройку приложения. Собственная timezone записи
определяет календарную семантику её повторений, а timezone приложения —
отображение и границы текущего дня.

Флаги `allDay` и `dueIsDate` не изменяют переданную дату автоматически. Клиент
должен передавать согласованное значение времени, если использует date-only
семантику.

### Ответы на изменение данных

- Создание note, event или deadline: `201` и полная созданная сущность.
- Обновление note, event или deadline: `200` и полная обновлённая сущность.
  При `this_and_future` возвращается новый master будущей части серии.
- Scope-команды отмены и завершения: `200` и `{ "id": number }`.
- Legacy-команды, hard delete и старые occurrence endpoints: `204` без тела.
- Неизвестное имя экрана: `404 Not Found`.
- Для occurrence endpoints дополнительно определены `400`, `404` и `409`,
  описанные ниже.

Единый публичный формат ошибок валидации пока не зафиксирован: payload
проверяется Zod, но структуру ответа Fastify не следует считать стабильной.

### `GET /health`

Публичная проверка готовности HTTP-процесса. Bearer-токен для неё не требуется.
Успешный ответ имеет статус `200`:

```json
{ "status": "ok" }
```

### `GET /api/settings`

Возвращает типизированное представление настроек приложения:

```json
{ "timezone": "Europe/Moscow" }
```

Внутри SQLite настройки хранятся как пары `key/value`, чтобы новые настройки
не требовали изменения схемы таблицы.

### `PATCH /api/settings`

Частично обновляет настройки и возвращает их актуальное представление:

```json
{ "timezone": "Asia/Yekaterinburg" }
```

`timezone` должна быть валидной IANA timezone. Изменение влияет на backend,
рендер экрана, frontend и timezone по умолчанию для новых записей HTTP/MCP.

## Повторение

Одинаковое поле `recurrence` поддерживается событиями и дедлайнами. В БД оно
хранится как канонический iCalendar `RRULE`, но HTTP API работает с
типизированным JSON.

Общие optional-поля любого правила:

| Поле       | Тип         | Ограничения      | Значение                                         |
| ---------- | ----------- | ---------------- | ------------------------------------------------ |
| `interval` | `number`    | целое `1..1000`  | повторять каждые N периодов; default `1`         |
| `count`    | `number`    | целое `1..10000` | максимальное число экземпляров, включая исходный |
| `until`    | `date-time` | валидная дата    | последний допустимый момент серии                |

`count` и `until` взаимоисключающие. `interval: 1` при сохранении
нормализуется: в последующем GET поле будет отсутствовать.

Дата `start` события или `due` дедлайна задаёт нижнюю границу серии и время
вхождений, но сама по себе не добавляется в серию. Первым считается ближайший
момент не раньше этой даты, который соответствует правилу. Например, событие
со `start` в среду и `weekdays: ["MO", "TU", "TH", "FR"]` впервые появится в
четверг.

### Каждый день

```json
{
    "frequency": "daily"
}
```

Каждые два дня, не больше десяти экземпляров:

```json
{
    "frequency": "daily",
    "interval": 2,
    "count": 10
}
```

Эквивалентный RRULE: `FREQ=DAILY;INTERVAL=2;COUNT=10`.

### По указанным дням недели

```json
{
    "frequency": "weekly",
    "weekdays": ["MO", "WE", "FR"]
}
```

`weekdays` содержит от одного до семи уникальных значений:

| Код  | День        |
| ---- | ----------- |
| `MO` | понедельник |
| `TU` | вторник     |
| `WE` | среда       |
| `TH` | четверг     |
| `FR` | пятница     |
| `SA` | суббота     |
| `SU` | воскресенье |

В ответе дни нормализуются в порядке от понедельника до воскресенья.
Исходный `start`/`due` задаёт нижнюю границу, но появится как экземпляр только
если его день входит в `weekdays`.

Эквивалентный RRULE: `FREQ=WEEKLY;BYDAY=MO,WE,FR`.

### Ежемесячно по числу

```json
{
    "frequency": "monthly-date",
    "day": 31
}
```

`day` — целое `1..31`. Месяцы без указанного числа пропускаются: правило с
`day: 31` не создаёт экземпляр в феврале, апреле, июне, сентябре и ноябре.

Эквивалентный RRULE: `FREQ=MONTHLY;BYMONTHDAY=31`.

### Ежемесячно по дню недели

Второй понедельник каждого месяца:

```json
{
    "frequency": "monthly-weekday",
    "weekday": "MO",
    "occurrence": 2
}
```

Последняя пятница каждого месяца:

```json
{
    "frequency": "monthly-weekday",
    "weekday": "FR",
    "occurrence": -1
}
```

`occurrence` допускает `1..5` или `-1`. Если пятого указанного дня в месяце
нет, такой месяц пропускается.

Эквивалентные RRULE: `FREQ=MONTHLY;BYDAY=2MO` и
`FREQ=MONTHLY;BYDAY=-1FR`.

### Каждый год

```json
{
    "frequency": "yearly"
}
```

Используются месяц, число и локальное время исходного `start`/`due`. Например,
серия от 29 февраля создаёт следующие экземпляры только в високосные годы.

Эквивалентный RRULE: `FREQ=YEARLY`.

### Удаление повторения

При редактировании master-записи:

```json
{
    "recurrence": null
}
```

Если `recurrence` отсутствует в PUT payload, текущее правило не меняется.

## Соответствие MCP

HTTP API использует те же сервисы и поддерживает те же операции, что MCP:

| MCP tool                  | HTTP endpoint                       |
| ------------------------- | ----------------------------------- |
| `create_note`             | `POST /api/notes`                   |
| `get_note`                | `GET /api/notes/:id`                |
| `list_notes`              | `GET /api/notes`                    |
| `update_note`             | `PUT /api/notes/:id`                |
| `create_event`            | `POST /api/events`                  |
| `get_event`               | `GET /api/events/:id`               |
| `get_events`              | `GET /api/events/occurrences`       |
| `search_events`           | `GET /api/events/search`            |
| `update_event`            | `PUT /api/events/:id`               |
| `cancel_event`            | `POST /api/events/:id/cancel`       |
| `create_deadline`         | `POST /api/deadlines`               |
| `get_deadline`            | `GET /api/deadlines/:id`            |
| `get_deadlines`           | `GET /api/deadlines/occurrences`    |
| `search_deadlines`        | `GET /api/deadlines`                |
| `update_deadline`         | `PUT /api/deadlines/:id`            |
| `cancel_deadline`         | `POST /api/deadlines/:id/cancel`    |
| `set_deadline_completion` | `PUT /api/deadlines/:id/completion` |

## Notes

### Модель Note

```ts
interface Note {
    id: number
    text: string
    completedAt: string | null
}
```

Этот формат совпадает с MCP; внутреннее имя столбца `completed_at` наружу не
выдаётся.

### Чтение

`GET /api/notes?limit=32&withDone=true` возвращает `Note[]`. `limit` — целое
`1..8192`, `withDone` по умолчанию `false`. `GET /api/notes/:id` возвращает
`Note` либо `null`.

### Создание и изменение

`POST /api/notes` принимает `text` длиной `1..256` и возвращает созданную
`Note` со статусом `201`:

```json
{ "text": "Купить бумагу" }
```

`PUT /api/notes/:id` принимает хотя бы одно поле и возвращает обновлённую
`Note`:

```json
{
    "text": "Купить бумагу A4",
    "completedAt": "2026-11-01T12:00:00+03:00"
}
```

`completedAt: null` возвращает заметку в активное состояние. Совместимые
алиасы `POST /api/notes/:id/markDone` и `markUndone` используют текущее время
сервера и возвращают `204`.

## Events

### Модели

```ts
interface Event {
    id: number
    title: string
    description: string | null
    start: string
    end: string | null
    timezone: string | null
    allDay: boolean
    cancelledAt: string | null
    createdAt: string
    updatedAt: string
    recurrence: Recurrence | null
    exceptions: EventOccurrenceException[]
}

type EventOccurrenceException =
    | { recurrenceId: string; status: 'cancelled' }
    | {
          recurrenceId: string
          status: 'rescheduled'
          start: string
          end: string | null
      }
    | {
          recurrenceId: string
          status: 'updated'
          title: string
          description: string | null
          start: string
          end: string | null
          timezone: string | null
          allDay: boolean
      }

interface ResolvedEvent {
    id: number
    title: string
    description: string | null
    start: string
    end: string | null
    timezone: string | null
    allDay: boolean
    recurrenceId: string | null
}
```

`recurrenceId` — неизменяемый исходный старт вхождения. `start` и `end` у
`ResolvedEvent` уже учитывают перенос или полное occurrence-изменение.

### Чтение и поиск

- `GET /api/events/:id` возвращает master с исключениями либо `null`.
- `GET /api/events/search` ищет активные master-записи. Параметры `from` и
  `to` фильтруют master `start`, `query` ищет подстроку в title/description,
  `limit` ограничивает ответ. Все параметры optional; если присутствуют обе
  границы, `to` должна быть позже `from`.
- `GET /api/events/occurrences` возвращает разрешённые вхождения. Обязательны
  `from` (inclusive) и `to` (exclusive), optional `limit`.
- `GET /api/events` без диапазона остаётся коротким alias списка master. С
  одновременными `from` и `to` он остаётся совместимым alias списка вхождений.

### Создание

`POST /api/events` возвращает полную созданную `Event` со статусом `201`:

```json
{
    "title": "Созвон",
    "description": "Обсудить макет",
    "start": "2026-11-02T10:00:00+03:00",
    "end": "2026-11-02T11:00:00+03:00",
    "timezone": "Europe/Moscow",
    "allDay": false,
    "recurrence": {
        "frequency": "weekly",
        "weekdays": ["MO", "WE"]
    }
}
```

Обязательны `title` и `start`. Остальные поля optional. `description`, `end`,
`timezone` и `recurrence` допускают `null`; `end` не может быть раньше
`start`. `end: null` обозначает точечное событие.

### Обновление: series, occurrence, this_and_future

`PUT /api/events/:id` принимает контракт, совпадающий с `update_event`:

```json
{
    "scope": "occurrence",
    "recurrenceId": "2026-11-04T07:00:00.000Z",
    "changes": {
        "title": "Стоматолог",
        "description": null,
        "start": "2026-11-04T12:00:00+03:00",
        "end": null,
        "allDay": false,
        "timezone": "Europe/Moscow"
    }
}
```

`scope`:

- `series` — меняет master целиком; `recurrenceId` не нужен;
- `occurrence` — меняет одно вхождение; `recurrence` в `changes` запрещён;
- `this_and_future` — завершает предыдущую серию перед выбранным вхождением и
  создаёт новый master для него и будущих вхождений.

Для двух последних scope обязателен исходный `recurrenceId`. `changes` должен
содержать хотя бы одно из полей create-контракта. Ответ — полная изменённая
`Event`; при `this_and_future` это новый master с новым `id`.

Для совместимости flat partial payload без `scope` трактуется как
`scope: "series"`.

### Мягкая отмена

`POST /api/events/:id/cancel` совпадает с `cancel_event`:

```json
{
    "scope": "this_and_future",
    "recurrenceId": "2026-11-04T07:00:00.000Z"
}
```

Поддерживаются `series`, `occurrence`, `this_and_future`; для двух последних
нужен `recurrenceId`. Ответ: `{ "id": number }`. `series` выставляет
`cancelledAt`, `occurrence` создаёт отменяющее исключение, а
`this_and_future` обрезает RRULE перед выбранным вхождением.

### Совместимые occurrence endpoints и hard delete

- `PUT /api/events/:id/occurrences/:recurrenceId` с
  `{ "status": "cancelled" }` или
  `{ "status": "rescheduled", "start": ..., "end"?: ... }` делает старый
  occurrence-upsert и возвращает `204`.
- `DELETE /api/events/:id/occurrences/:recurrenceId` удаляет override и
  восстанавливает вычисляемое вхождение.
- `DELETE /api/events/:id` физически удаляет master и его exceptions. Для
  пользовательской отмены предпочтителен `/cancel`.

## Deadlines

### Модели

```ts
interface Deadline {
    id: number
    title: string
    description: string | null
    due: string
    dueIsDate: boolean
    timezone: string
    cancelledAt: string | null
    createdAt: string
    updatedAt: string
    recurrence: Recurrence | null
    visibility: DeadlineVisibility
    completedAt: string | null
    completions: DeadlineCompletion[]
    exceptions: DeadlineOccurrenceException[]
}

interface ResolvedDeadline {
    id: number
    title: string
    description: string | null
    due: string
    dueIsDate: boolean
    timezone: string
    completed: boolean
    completedAt: string | null
    recurrenceId: string | null
    visibility: DeadlineVisibility
}

interface DeadlineVisibility {
    show: { type: 'always' } | { type: 'before'; days: number }
    hide: 'on_due' | 'on_complete'
}

interface DeadlineCompletion {
    recurrenceId: string | null
    completedAt: string
}
```

Исключения имеют статусы `cancelled`, `rescheduled` или `updated` по аналогии
с событиями. `updated` содержит `title`, `description`, `due`, `dueIsDate` и
`timezone`. `recurrenceId` — исходный `due`, даже если вхождение перенесено.

`dueIsDate: true` означает календарную дату без значимого времени. Поле `due`
всё равно передаётся полной RFC 3339 строкой и автоматически не переписывается.

### Чтение и поиск

- `GET /api/deadlines/:id` возвращает master со всеми exceptions и
  completions либо `null`.
- `GET /api/deadlines` ищет активные master-записи. Поддерживает optional
  `from`, `to`, `query`, `limit` (`1..8192`) и `withCompleted` (`false` по
  умолчанию). Границы применяются к сохранённому master `due`, повторы не
  разворачиваются.
- `GET /api/deadlines/occurrences` возвращает разрешённые вхождения после
  применения исключений и завершений. `from` обязателен и inclusive; optional
  `limit` по умолчанию `128`, optional `withCompleted` по умолчанию `false`.

### Создание

`POST /api/deadlines` возвращает полную созданную `Deadline` со статусом
`201`:

```json
{
    "title": "Оплатить интернет",
    "description": null,
    "due": "2026-11-05T18:00:00+03:00",
    "dueIsDate": false,
    "timezone": "Europe/Moscow",
    "completed": false,
    "recurrence": { "frequency": "monthly-date", "day": 5 },
    "visibility": {
        "show": { "type": "before", "days": 3 },
        "hide": "on_complete"
    }
}
```

Обязательны `title` и `due`. `completed: true` разрешён только для
одноразового дедлайна. По умолчанию visibility равна
`{ show: { type: "always" }, hide: "on_due" }`.

### Обновление: series, occurrence, this_and_future

`PUT /api/deadlines/:id` принимает контракт `update_deadline`:

```json
{
    "scope": "this_and_future",
    "recurrenceId": "2026-12-05T15:00:00.000Z",
    "changes": {
        "title": "Оплатить интернет по новому тарифу",
        "due": "2026-12-07T18:00:00+03:00",
        "visibility": {
            "show": { "type": "before", "days": 5 },
            "hide": "on_complete"
        }
    }
}
```

Семантика scope совпадает с events. Для `occurrence` запрещено менять
`recurrence` и `visibility`. Ответ содержит полную изменённую `Deadline`, а
при `this_and_future` — новый будущий master. Flat partial payload без scope
остаётся совместимым обновлением всей серии.

### Завершение вхождения

`PUT /api/deadlines/:id/completion` совпадает с
`set_deadline_completion`:

```json
{
    "recurrenceId": "2026-11-05T15:00:00.000Z",
    "completed": true
}
```

Для повторяющегося дедлайна `recurrenceId` обязателен; для одноразового должен
отсутствовать. `completed: false` открывает вхождение заново. Ответ:
`{ "id": number }`.

Legacy-алиасы `markDone`/`markUndone` сохранены как для одноразового дедлайна,
так и в форме `/occurrences/:recurrenceId/markDone|markUndone`; они возвращают
`204`.

### Мягкая отмена

`POST /api/deadlines/:id/cancel` принимает `scope` и optional `recurrenceId`
точно как event cancel. Ответ: `{ "id": number }`. Для пользовательских
действий этот endpoint предпочтительнее физического удаления.

### Совместимые occurrence endpoints и hard delete

- `PUT /api/deadlines/:id/occurrences/:recurrenceId` поддерживает старые
  `cancelled` и `rescheduled` overrides.
- `DELETE /api/deadlines/:id/occurrences/:recurrenceId` удаляет override.
- `DELETE /api/deadlines/:id` физически удаляет master, exceptions и
  completions.

## Screens

Доступные имена берутся из `project.scenes`. Сейчас определены `main` и
`splash`; размер обоих экранов — `800 × 480`.

### `GET /screens/:name`

Возвращает metadata и семантический hash:

```json
{
    "width": 800,
    "height": 480,
    "hash": "7fc7a14f05ab815127e72d1b972b29ec"
}
```

Hash меняется при изменении данных или временного состояния, влияющего на
контекст экрана. Текущее время не добавляется в hash каждую минуту. При этом
запрос изображения всегда рендерит максимально актуальный контекст.

### `GET /screens/:name/png`

Возвращает `image/png` с `Cache-Control: no-store`.

PNG — непрозрачное монохромное изображение размером сцены.

### `GET /screens/:name/esp`

Возвращает `application/octet-stream` с `Cache-Control: no-store`.

Формат framebuffer:

- row-major;
- один бит на пиксель;
- stride равен `ceil(width / 8)`;
- старший бит байта соответствует левому пикселю;
- `0` — белый, `1` — чёрный;
- неиспользованные биты последнего байта строки равны нулю.

Для `800 × 480` payload занимает `48000` байт.

### `GET /screens/events` — SSE

Долгоживущее соединение с `Content-Type: text/event-stream`.

При подключении сервер отправляет рекомендуемый reconnect delay:

```text
retry: 3000
```

Затем отправляет актуальное состояние каждого экрана:

```text
event: screen
data: {"name":"main","hash":"7fc7a14f05ab815127e72d1b972b29ec"}
```

Payload:

```ts
interface ScreenChange {
    name: 'main' | 'splash'
    hash: string
}
```

После успешной мутации `/api/*` hash проверяется немедленно. Временные границы
и внешние изменения БД обнаруживаются общим монитором с периодом до 5 секунд.
Неизменившийся hash повторно не отправляется.

Чтобы соединение не закрывали idle-прокси, каждые 15 секунд отправляется SSE
comment:

```text
: heartbeat
```

На сервере request/connection timeout для потока отключён, TCP keepalive
включён, а `X-Accel-Buffering` установлен в `no`. После реконнекта клиент снова
получает текущие hashes всех экранов, поэтому отдельный replay по
`Last-Event-ID` не используется.

## Master-записи и экземпляры на экране

Search/list endpoints управляют сохранёнными master-записями и их exceptions.
Отдельные `/occurrences` endpoints возвращают вычисленные вхождения.

При подготовке сцены backend:

- разворачивает все сегодняшние event occurrences, включая переносы и события,
  пересекающие полночь;
- исключает отменённые occurrences;
- применяет deadline exceptions, completions и visibility, после чего оставляет
  только ближайшее подходящее вхождение каждой серии;
- получает до 32 заметок;
- передаёт эти данные шаблону, который сам выбирает, сколько элементов показать.

Текущий `main` template отображает максимум восемь событий, четыре дедлайна и
восемь заметок.

## Пока не входит в контракт

- пользователи, роли и разграничение прав поверх общего Bearer-токена;
- pagination/cursor вместо простого `limit`;
- CalDAV transport, UID/ETag и conflict resolution;
- стабильная публичная схема validation errors.
