import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import {
    formatMonth,
    getCalendarDays,
    toIsoDate,
    weekDays,
} from '../lib/date'

interface Props {
    today: string
    month: Date
    selected: string
    eventDates?: Set<string>
    loading?: boolean
    onSelect: (date: string) => void
    onMonthChange: (month: Date) => void
    onToday: () => void
}

export function MiniCalendar({
    today,
    month,
    selected,
    eventDates,
    loading = false,
    onSelect,
    onMonthChange,
    onToday,
}: Props) {
    const changeMonth = (offset: number) =>
        onMonthChange(
            new Date(month.getFullYear(), month.getMonth() + offset, 1, 12),
        )

    return (
        <div className="mini-calendar">
            <div className="mini-calendar__toolbar">
                <strong>
                    {formatMonth(month)}
                    {loading && (
                        <Loader2
                            size={14}
                            className="spin-animation"
                            aria-label="Загрузка календаря"
                        />
                    )}
                </strong>
                <span>
                    <button type="button" onClick={onToday}>
                        Сегодня
                    </button>
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        aria-label="Предыдущий месяц"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        aria-label="Следующий месяц"
                    >
                        <ChevronRight size={18} />
                    </button>
                </span>
            </div>
            <div className="mini-calendar__weekdays">
                {weekDays.map((day) => (
                    <span key={day}>{day[0]}</span>
                ))}
            </div>
            <div className="mini-calendar__grid">
                {getCalendarDays(month).map((date) => {
                    const iso = toIsoDate(date)
                    return (
                        <button
                            key={iso}
                            className={`mini-calendar__day${iso === selected ? ' is-selected' : ''}${iso === today ? ' is-today' : ''}${date.getMonth() !== month.getMonth() ? ' is-outside' : ''}${eventDates?.has(iso) ? ' has-events' : ''}`}
                            type="button"
                            onClick={() => onSelect(iso)}
                            aria-label={date.toLocaleDateString('ru-RU')}
                        >
                            {date.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
