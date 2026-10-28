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

Для событий timezone может быть непустой строкой или `null`; клиенту следует
передавать IANA-имя, но сейчас event endpoint отдельно это не проверяет. Для
дедлайнов timezone обязана быть корректным IANA-именем, например
`Europe/Moscow`. Если timezone не передана, БД использует `Europe/Moscow`.

Флаги `allDay` и `dueIsDate` не изменяют переданную дату автоматически. Клиент
должен передавать согласованное значение времени, если использует date-only
семантику.

### Ответы на изменение данных

- Создание сущности: `201` и `{ "success": true, "id": number }`.
- Обычное редактирование: `200` без значимого JSON-тела.
- Команды, удаление и изменение отдельного повтора: `204` без тела.
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
Исходный `start`/`due` всегда является первым экземпляром серии; для наиболее
очевидного поведения его день следует включать в `weekdays`.

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

## Notes

### Модель Note

```ts
interface Note {
    id: number
    text: string
    completed_at: string | null
    createdAt: string
    updatedAt: string
}
```

`completed_at` использует имя с underscore, соответствующее текущей модели
БД. Отдельного DELETE endpoint для заметок пока нет.

### `GET /api/notes`

Query-параметры:

| Параметр   | Тип               | Default     | Значение                     |
| ---------- | ----------------- | ----------- | ---------------------------- |
| `limit`    | integer `1..8192` | отсутствует | максимальное число записей   |
| `withDone` | boolean string    | `false`     | включить завершённые заметки |

По умолчанию возвращаются только заметки, у которых `completed_at === null`.

```http
GET /api/notes?limit=32&withDone=true
```

Ответ: `200 Note[]`.

### `GET /api/notes/:id`

Возвращает одну сохранённую заметку.

### `POST /api/notes`

```json
{
    "text": "Купить бумагу"
}
```

`text` обязателен, после приведения к строке должен содержать хотя бы один
символ.

### `PUT /api/notes/:id`

```json
{
    "text": "Купить бумагу A4"
}
```

Все поля optional; сейчас редактируется только `text`.

### `POST /api/notes/:id/markDone`

Ставит `completed_at` в текущее серверное время. Ответ `204`.

### `POST /api/notes/:id/markUndone`

Сбрасывает `completed_at` в `null`. Ответ `204`.

## Events

### Модель Event

`GET /api/events` без диапазона и `GET /api/events/:id` возвращают
master-записи серий:

```ts
interface EventResponse {
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
    | {
          recurrenceId: string
          status: 'cancelled'
      }
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
```

`recurrenceId` — исходный `start` конкретного экземпляра серии. После
изменения он не меняется. `rescheduled` — совместимый time-only override,
создаваемый текущим occurrence HTTP endpoint. `updated` содержит полный снимок
полей экземпляра; это позволяет отличать явный `null` от наследования значения
master-серии.

`cancelledAt` — время мягкой отмены всей master-серии. Отменённые master-записи
не возвращаются списком и не материализуются в расписании, но доступны по
точному `GET /api/events/:id`.

Для календарного диапазона используется уже разрешённая модель экземпляра:

```ts
interface ResolvedEventResponse {
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

Здесь `start` и `end` — фактическое время экземпляра после применения
переноса. `id` остаётся ID master-события, а `recurrenceId` содержит исходный
запланированный старт экземпляра. Для неповторяющегося события
`recurrenceId === null`.

### `GET /api/events`

Query-параметры:

| Параметр | Тип               | Значение                                   |
| -------- | ----------------- | ------------------------------------------ |
| `from`   | date-time         | inclusive начало диапазона экземпляров     |
| `to`     | date-time         | exclusive конец диапазона экземпляров      |
| `limit`  | integer `1..8192` | максимальное число записей или экземпляров |

Без `from` и `to` endpoint возвращает `200 EventResponse[]`: сохранённые
master-события с правилами повторения и исключениями. Фильтры `from` и `to`
должны либо отсутствовать вместе, либо быть переданы вместе.

С диапазоном endpoint возвращает `200 ResolvedEventResponse[]`,
отсортированный по фактическому `start`. Повторения материализованы, отменённые
экземпляры исключены, а перенесённые находятся по новому интервалу. `limit`
применяется после разрешения и сортировки экземпляров.

Пример:

```http
GET /api/events?from=2026-10-27T00%3A00%3A00%2B03%3A00&to=2026-10-28T00%3A00%3A00%2B03%3A00
```

### `GET /api/events/occurrences`

Явный endpoint для получения разрешённых экземпляров. `from` и `to`
обязательны, `limit` optional. Формат и семантика ответа совпадают с
`GET /api/events?from=...&to=...`. Для нового клиентского кода рекомендуется
эта форма: она не перегружает один URL двумя типами ответа.

### `GET /api/events/:id`

Возвращает master-запись и все её `exceptions`.

### `POST /api/events`

Минимальный payload:

```json
{
    "title": "Созвон",
    "start": "2026-10-26T10:00:00+03:00"
}
```

Полный payload:

```json
{
    "title": "Созвон",
    "description": "Обсудить макет",
    "start": "2026-10-26T10:00:00+03:00",
    "end": "2026-10-26T11:00:00+03:00",
    "timezone": "Europe/Moscow",
    "allDay": false,
    "recurrence": {
        "frequency": "weekly",
        "weekdays": ["MO", "WE"]
    }
}
```

Поля:

| Поле          | Обязательное | Тип и default                                           |
| ------------- | ------------ | ------------------------------------------------------- |
| `title`       | да           | непустая строка после `trim`                            |
| `description` | нет          | nullable string, default `null`                         |
| `start`       | да           | date-time                                               |
| `end`         | нет          | date-time или `null`, default `null`; не раньше `start` |
| `timezone`    | нет          | непустая строка или `null`, default `Europe/Moscow`     |
| `allDay`      | нет          | boolean, default `false`                                |
| `recurrence`  | нет          | recurrence object или `null`, default `null`            |

Событие с `end: null` считается точечным.

### `PUT /api/events/:id`

Принимает partial-набор полей POST. `recurrence: null` отключает повторение.

Изменение `start`, `end`, `timezone` или `recurrence` атомарно удаляет все
occurrence exceptions этой серии, поскольку старые `recurrenceId` после такого
изменения больше нельзя считать корректными.

### Отмена одного экземпляра события

```http
PUT /api/events/:id/occurrences/:recurrenceId
Content-Type: application/json

{
  "status": "cancelled"
}
```

### Перенос одного экземпляра события

```http
PUT /api/events/:id/occurrences/:recurrenceId
Content-Type: application/json

{
  "status": "rescheduled",
  "start": "2026-10-27T12:00:00+03:00"
}
```

Если `end` отсутствует, сохраняется длительность master-события. Если master
точечный, перенесённый экземпляр также будет точечным.

Новый интервал можно задать явно:

```json
{
    "status": "rescheduled",
    "start": "2026-10-27T12:00:00+03:00",
    "end": "2026-10-27T12:30:00+03:00"
}
```

`end: null` превращает только этот экземпляр в точечный.

`recurrenceId` в URL должен быть точным исходным временем экземпляра и должен
быть URL-encoded:

```ts
const path = `/api/events/${id}/occurrences/${encodeURIComponent(recurrenceId)}`
```

PUT является idempotent upsert: повторный запрос для того же `recurrenceId`
заменяет существующую отмену или перенос.

Ответы occurrence endpoint:

- `204` — исключение сохранено;
- `400` — `recurrenceId` не принадлежит серии;
- `404` — event не найден;
- `409` — event не является повторяющимся.

### Восстановление исходного экземпляра

```http
DELETE /api/events/:id/occurrences/:recurrenceId
```

Удаляет cancellation/reschedule override. Исходный экземпляр снова вычисляется
из RRULE. Ответ `204`; удаление отсутствующего override также безопасно.

### `DELETE /api/events/:id`

Удаляет master и каскадно все его occurrence exceptions. Ответ `204`.

## Deadlines

### Модель Deadline

```ts
interface DeadlineResponse {
    id: number
    title: string
    description: string | null
    due: string
    dueIsDate: boolean
    timezone: string
    completed: boolean
    cancelledAt: string | null
    createdAt: string
    updatedAt: string
    recurrence: Recurrence | null
    exceptions: DeadlineOccurrenceException[]
}

type DeadlineOccurrenceException =
    | {
          recurrenceId: string
          status: 'cancelled'
      }
    | {
          recurrenceId: string
          status: 'rescheduled'
          due: string
      }
    | {
          recurrenceId: string
          status: 'updated'
          title: string
          description: string | null
          due: string
          dueIsDate: boolean
          timezone: string
          completed: boolean
      }
```

`recurrenceId` — исходный `due` экземпляра серии.
`updated` содержит полный снимок occurrence override. `cancelledAt` — время
мягкой отмены master; такая запись доступна по ID, но исключается из списков и
расписания.

### `GET /api/deadlines`

Query-параметры:

| Параметр        | Тип               | Default     | Значение                            |
| --------------- | ----------------- | ----------- | ----------------------------------- |
| `from`          | date-time         | отсутствует | master due не раньше границы        |
| `limit`         | integer `1..8192` | отсутствует | максимум master-записей             |
| `withCompleted` | boolean string    | `false`     | включить завершённые серии/дедлайны |

Ответ: `200 DeadlineResponse[]`, отсортированный по master `due`.

Как и events list, endpoint возвращает master-записи, а не вычисленные повторы.
Recurring master включается независимо от `from`.

### `GET /api/deadlines/:id`

Возвращает master-запись и все её `exceptions`.

### `POST /api/deadlines`

```json
{
    "title": "Оплатить счёт",
    "description": null,
    "due": "2026-10-30T18:00:00+03:00",
    "dueIsDate": false,
    "timezone": "Europe/Moscow",
    "completed": false,
    "recurrence": {
        "frequency": "monthly-date",
        "day": 30
    }
}
```

Поля:

| Поле          | Обязательное | Тип и default                                   |
| ------------- | ------------ | ----------------------------------------------- |
| `title`       | да           | непустая строка после `trim`                    |
| `description` | нет          | nullable string, default `null`                 |
| `due`         | да           | date-time                                       |
| `dueIsDate`   | нет          | boolean, default `false`                        |
| `timezone`    | нет          | валидная IANA timezone, default `Europe/Moscow` |
| `completed`   | нет          | boolean, default `false`                        |
| `recurrence`  | нет          | recurrence object или `null`, default `null`    |

### `PUT /api/deadlines/:id`

Принимает partial-набор полей POST. Изменение `due`, `timezone` или
`recurrence` атомарно удаляет occurrence exceptions серии.

### Отмена одного экземпляра дедлайна

```http
PUT /api/deadlines/:id/occurrences/:recurrenceId
Content-Type: application/json

{
  "status": "cancelled"
}
```

### Перенос одного экземпляра дедлайна

```http
PUT /api/deadlines/:id/occurrences/:recurrenceId
Content-Type: application/json

{
  "status": "rescheduled",
  "due": "2026-11-02T18:00:00+03:00"
}
```

Правила `recurrenceId`, idempotent upsert и статусы `204/400/404/409` совпадают
с event occurrence endpoint.

### Восстановление исходного экземпляра

```http
DELETE /api/deadlines/:id/occurrences/:recurrenceId
```

Удаляет override и возвращает исходный экземпляр RRULE. Ответ `204`.

### Завершение и возврат

```http
POST /api/deadlines/:id/markDone
POST /api/deadlines/:id/markUndone
```

Обе команды возвращают `204`. Поле `completed` относится ко всему master и
всей серии; завершение отдельного экземпляра пока не реализовано.

### `DELETE /api/deadlines/:id`

Удаляет master и каскадно все его exceptions. Ответ `204`.

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

REST list endpoints управляют сохранёнными master-записями и их exceptions.
Они не возвращают отдельный объект для каждого вычисленного повтора.

При подготовке сцены backend:

- разворачивает все сегодняшние event occurrences, включая переносы и события,
  пересекающие полночь;
- исключает отменённые occurrences;
- получает до 32 ближайших deadline occurrences;
- получает до 32 заметок;
- передаёт эти данные шаблону, который сам выбирает, сколько элементов показать.

Текущий `main` template отображает максимум восемь событий, четыре дедлайна и
восемь заметок.

## Пока не входит в контракт

- пользователи, роли и разграничение прав поверх общего Bearer-токена;
- pagination/cursor вместо простого `limit`;
- materialized-occurrences REST endpoint;
- редактирование title/description только одного occurrence;
- завершение одного occurrence повторяющегося дедлайна;
- CalDAV transport, UID/ETag и conflict resolution;
- стабильная публичная схема validation errors.
