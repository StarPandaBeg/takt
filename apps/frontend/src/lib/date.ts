export const DEFAULT_TIMEZONE = 'Europe/Moscow'

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

const months = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
]

const genitiveMonths = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
]

export const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function getTodayIso(): string {
    const now = new Date()
    return toIsoDate(now)
}

export function toIsoDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function parseIsoDate(value: string): Date {
    if (!value) return new Date()
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12, 0, 0)
}

export function formatMonth(date: Date): string {
    return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export function formatLongDate(value: string): string {
    const date = parseIsoDate(value)
    const weekDay = new Intl.DateTimeFormat('ru-RU', {
        weekday: 'long',
    }).format(date)
    return `${weekDay}, ${date.getDate()} ${genitiveMonths[date.getMonth()]}`
}

export function getCalendarDays(month: Date): Date[] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
    const start = new Date(
        month.getFullYear(),
        month.getMonth(),
        1 - ((first.getDay() + 6) % 7),
        12,
    )
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        return date
    })
}

/**
 * Извлекает YYYY-MM-DD из ISO/RFC3339 строки даты
 */
export function extractDateString(isoString: string): string {
    if (!isoString) return getTodayIso()
    return isoString.slice(0, 10)
}

/**
 * Извлекает HH:mm из ISO/RFC3339 строки даты
 */
export function extractTimeString(isoString: string): string {
    if (!isoString) return '09:00'
    const match = /T(\d{2}:\d{2})/.exec(isoString)
    if (match?.[1]) {
        return match[1]
    }
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return '09:00'
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Создает RFC 3339 строку с датой и временем
 */
export function buildIsoDateTime(
    dateStr: string,
    timeStr?: string | null,
    allDay?: boolean,
): string {
    if (allDay || !timeStr) {
        // Для allDay событий или дедлайнов-дат начало дня
        return `${dateStr}T00:00:00.000Z`
    }
    const [h, m] = timeStr.split(':')
    const hours = String(h ?? '00').padStart(2, '0')
    const minutes = String(m ?? '00').padStart(2, '0')
    // Создаем дату в текущей локали и преобразуем в ISO с Z
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(
        year ?? 2026,
        (month ?? 1) - 1,
        day ?? 1,
        Number(hours),
        Number(minutes),
        0,
    )
    return date.toISOString()
}

/**
 * Форматирует интервал времени для отображения события
 */
export function eventTime(event: {
    allDay: boolean
    start: string
    end?: string | null
}): string {
    if (event.allDay) return 'Весь день'
    const startTime = extractTimeString(event.start)
    if (!event.end) return startTime
    const endTime = extractTimeString(event.end)
    return `${startTime} — ${endTime}`
}

/**
 * Форматирует срок для отображения дедлайна
 */
export function formatDeadlineDue(due: string, dueIsDate: boolean): string {
    const datePart = extractDateString(due)
    const parsed = parseIsoDate(datePart)
    const formattedDate = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
    })
        .format(parsed)
        .replace('.', '')

    if (dueIsDate) {
        return formattedDate
    }
    const timePart = extractTimeString(due)
    return `${formattedDate}, ${timePart}`
}
