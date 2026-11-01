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

const moscowDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

const moscowTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
})

export function getTodayIso(): string {
    return moscowDateFormatter.format(new Date())
}

export function toIsoDate(date: Date): string {
    return moscowDateFormatter.format(date)
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
 * Извлекает YYYY-MM-DD в часовом поясе пользователя (Europe/Moscow) из ISO/RFC3339 строки даты
 */
export function extractDateString(
    isoString: string,
    timeZone: string = DEFAULT_TIMEZONE,
): string {
    if (!isoString) return getTodayIso()
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
        return isoString
    }
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
        return isoString.slice(0, 10)
    }
    if (timeZone === DEFAULT_TIMEZONE) {
        return moscowDateFormatter.format(date)
    }
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

/**
 * Извлекает HH:mm в часовом поясе пользователя (Europe/Moscow) из ISO/RFC3339 строки даты
 */
export function extractTimeString(
    isoString: string,
    timeZone: string = DEFAULT_TIMEZONE,
): string {
    if (!isoString) return '09:00'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
        const match = /T(\d{2}:\d{2})/.exec(isoString)
        return match?.[1] ?? '09:00'
    }
    if (timeZone === DEFAULT_TIMEZONE) {
        return moscowTimeFormatter.format(date)
    }
    return new Intl.DateTimeFormat('ru-RU', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date)
}

/**
 * Создает RFC 3339 строку с датой и временем в московском часовом поясе (+03:00)
 */
export function buildIsoDateTime(
    dateStr: string,
    timeStr?: string | null,
    allDay?: boolean,
): string {
    if (allDay || !timeStr) {
        // Для all-day событий или дедлайнов-дат начало дня по Москве (00:00:00+03:00)
        return `${dateStr}T00:00:00+03:00`
    }
    const [h, m] = timeStr.split(':')
    const hours = String(h ?? '00').padStart(2, '0')
    const minutes = String(m ?? '00').padStart(2, '0')
    return `${dateStr}T${hours}:${minutes}:00+03:00`
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
