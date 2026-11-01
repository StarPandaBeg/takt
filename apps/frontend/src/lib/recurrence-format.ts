import type { Recurrence, Weekday } from '../types/api'

const WEEKDAY_NAMES: Record<Weekday, string> = {
    MO: 'Пн',
    TU: 'Вт',
    WE: 'Ср',
    TH: 'Чт',
    FR: 'Пт',
    SA: 'Сб',
    SU: 'Вс',
}

const WEEKDAY_FULL_GENITIVE: Record<Weekday, string> = {
    MO: 'понедельник',
    TU: 'вторник',
    WE: 'среду',
    TH: 'четверг',
    FR: 'пятницу',
    SA: 'субботу',
    SU: 'воскресенье',
}

const OCCURRENCE_NAMES: Record<number, string> = {
    1: '1-й',
    2: '2-й',
    3: '3-й',
    4: '4-й',
    5: '5-й',
    [-1]: 'последний',
}

export function formatRecurrenceRule(recurrence: Recurrence | null): string {
    if (!recurrence) return 'Без повторения'

    const interval = recurrence.interval ?? 1

    switch (recurrence.frequency) {
        case 'daily': {
            if (interval === 1) return 'Каждый день'
            if (interval % 10 === 1 && interval % 100 !== 11) {
                return `Каждый ${interval}-й день`
            }
            if (
                [2, 3, 4].includes(interval % 10) &&
                ![12, 13, 14].includes(interval % 100)
            ) {
                return `Каждые ${interval} дня`
            }
            return `Каждые ${interval} дней`
        }

        case 'weekly': {
            const days = recurrence.weekdays
                .map((d) => WEEKDAY_NAMES[d] ?? d)
                .join(', ')
            if (interval === 1) {
                return recurrence.weekdays.length === 7
                    ? 'Каждый день'
                    : `Еженедельно: ${days}`
            }
            return `Каждые ${interval} нед.: ${days}`
        }

        case 'monthly-date': {
            if (interval === 1) {
                return `Ежемесячно, ${recurrence.day}-го числа`
            }
            return `Каждые ${interval} мес., ${recurrence.day}-го числа`
        }

        case 'monthly-weekday': {
            const occName =
                OCCURRENCE_NAMES[recurrence.occurrence] ??
                `${recurrence.occurrence}-й`
            const dayName =
                WEEKDAY_FULL_GENITIVE[recurrence.weekday] ?? recurrence.weekday
            if (interval === 1) {
                return `Каждый ${occName} ${dayName} месяца`
            }
            return `Каждые ${interval} мес. в ${occName} ${dayName}`
        }

        case 'yearly': {
            if (interval === 1) return 'Каждый год'
            return `Каждые ${interval} года`
        }

        default:
            return 'Регулярно'
    }
}
