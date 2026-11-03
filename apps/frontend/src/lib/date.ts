import { Temporal } from 'temporal-polyfill'

export const IANA_TIMEZONES = [
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
    { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
    { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
    { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
    { value: 'UTC', label: 'UTC' },
]

export const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function plainDate(value: string): Temporal.PlainDate {
    return Temporal.PlainDate.from(value.slice(0, 10))
}

function dateToPlainDate(date: Date): Temporal.PlainDate {
    return Temporal.PlainDate.from({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
    })
}

export function getTodayIso(timezone: string): string {
    return Temporal.Now.zonedDateTimeISO(timezone).toPlainDate().toString()
}

export function toIsoDate(date: Date): string {
    return dateToPlainDate(date).toString()
}

export function parseIsoDate(value: string): Date {
    const date = plainDate(value)
    return new Date(date.year, date.month - 1, date.day, 12)
}

export function formatMonth(date: Date): string {
    return dateToPlainDate(date).toLocaleString('ru-RU', {
        month: 'long',
        year: 'numeric',
    })
}

export function formatLongDate(value: string): string {
    return plainDate(value).toLocaleString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })
}

export function getCalendarDays(month: Date): Date[] {
    const first = dateToPlainDate(month).with({ day: 1 })
    const start = first.subtract({ days: first.dayOfWeek - 1 })
    return Array.from({ length: 42 }, (_, index) =>
        parseIsoDate(start.add({ days: index }).toString()),
    )
}

export function extractDateString(isoString: string, timezone: string): string {
    if (!isoString) return getTodayIso(timezone)
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString
    return Temporal.Instant.from(isoString)
        .toZonedDateTimeISO(timezone)
        .toPlainDate()
        .toString()
}

export function extractTimeString(isoString: string, timezone: string): string {
    if (!isoString) return '09:00'
    const time = Temporal.Instant.from(isoString)
        .toZonedDateTimeISO(timezone)
        .toPlainTime()
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
}

/** Converts application-local wall time to the UTC transport representation. */
export function buildIsoDateTime(
    date: string,
    time: string | null | undefined,
    allDay: boolean | undefined,
    timezone: string,
): string {
    const localTime = allDay || !time ? '00:00:00' : `${time}:00`
    return Temporal.PlainDateTime.from(`${date}T${localTime}`)
        .toZonedDateTime(timezone)
        .toInstant()
        .toString()
}

export function eventTime(
    event: { allDay: boolean; start: string; end?: string | null },
    timezone: string,
): string {
    if (event.allDay) return 'Весь день'
    const startTime = extractTimeString(event.start, timezone)
    if (!event.end) return startTime
    return `${startTime} — ${extractTimeString(event.end, timezone)}`
}

export function formatDeadlineDue(
    due: string,
    dueIsDate: boolean,
    timezone: string,
): string {
    const date = plainDate(extractDateString(due, timezone))
    const formattedDate = date
        .toLocaleString('ru-RU', { day: 'numeric', month: 'short' })
        .replace('.', '')
    return dueIsDate
        ? formattedDate
        : `${formattedDate}, ${extractTimeString(due, timezone)}`
}

export interface OccurrenceRange {
    from: string
    to: string
}

function occurrenceBoundary(date: Temporal.PlainDate, timezone: string) {
    return date.toZonedDateTime(timezone).startOfDay().toInstant().toString()
}

export function getMonthOccurrenceRange(
    date: string,
    timezone: string,
): OccurrenceRange {
    const month = plainDate(date).with({ day: 1 })
    return {
        from: occurrenceBoundary(month.subtract({ months: 1 }), timezone),
        to: occurrenceBoundary(month.add({ months: 2 }), timezone),
    }
}

export function getCalendarViewOccurrenceRange(
    start: string,
    end: string,
    view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay',
    timezone: string,
): OccurrenceRange {
    const from = plainDate(start)
    const to = plainDate(end)
    const padding =
        view === 'dayGridMonth'
            ? { months: 1 }
            : view === 'timeGridWeek'
              ? { weeks: 1 }
              : { days: 2 }
    return {
        from: occurrenceBoundary(from.subtract(padding), timezone),
        to: occurrenceBoundary(to.add(padding), timezone),
    }
}
