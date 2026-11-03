import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { Temporal } from 'temporal-polyfill'

import { api } from '../api/client'
import type { ResolvedDeadline, ResolvedEvent } from '../types/api'

export type CalendarViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

export interface CalendarPeriod {
    key: string
    unit: 'month' | 'week' | 'day'
    from: string
    to: string
}

function occurrenceBoundary(
    date: Temporal.PlainDate,
    timezone: string,
): string {
    return date.toZonedDateTime(timezone).startOfDay().toInstant().toString()
}

export function computeCalendarPeriods(
    view: CalendarViewType,
    dateStr: string,
    timezone: string,
): { prev: CalendarPeriod; current: CalendarPeriod; next: CalendarPeriod } {
    const plainDate = Temporal.PlainDate.from(dateStr.slice(0, 10))

    if (view === 'dayGridMonth') {
        const currentMonthStart = plainDate.with({ day: 1 })
        const prevMonthStart = currentMonthStart.subtract({ months: 1 })
        const nextMonthStart = currentMonthStart.add({ months: 1 })
        const afterNextMonthStart = currentMonthStart.add({ months: 2 })

        const prev: CalendarPeriod = {
            key: `month:${prevMonthStart.year}-${String(prevMonthStart.month).padStart(2, '0')}`,
            unit: 'month',
            from: occurrenceBoundary(prevMonthStart, timezone),
            to: occurrenceBoundary(currentMonthStart, timezone),
        }
        const current: CalendarPeriod = {
            key: `month:${currentMonthStart.year}-${String(currentMonthStart.month).padStart(2, '0')}`,
            unit: 'month',
            from: occurrenceBoundary(currentMonthStart, timezone),
            to: occurrenceBoundary(nextMonthStart, timezone),
        }
        const next: CalendarPeriod = {
            key: `month:${nextMonthStart.year}-${String(nextMonthStart.month).padStart(2, '0')}`,
            unit: 'month',
            from: occurrenceBoundary(nextMonthStart, timezone),
            to: occurrenceBoundary(afterNextMonthStart, timezone),
        }
        return { prev, current, next }
    }

    if (view === 'timeGridWeek') {
        // Понедельник — 1 день недели
        const currentMonday = plainDate.subtract({
            days: plainDate.dayOfWeek - 1,
        })
        const prevMonday = currentMonday.subtract({ weeks: 1 })
        const nextMonday = currentMonday.add({ weeks: 1 })
        const afterNextMonday = currentMonday.add({ weeks: 2 })

        const prev: CalendarPeriod = {
            key: `week:${prevMonday.toString()}`,
            unit: 'week',
            from: occurrenceBoundary(prevMonday, timezone),
            to: occurrenceBoundary(currentMonday, timezone),
        }
        const current: CalendarPeriod = {
            key: `week:${currentMonday.toString()}`,
            unit: 'week',
            from: occurrenceBoundary(currentMonday, timezone),
            to: occurrenceBoundary(nextMonday, timezone),
        }
        const next: CalendarPeriod = {
            key: `week:${nextMonday.toString()}`,
            unit: 'week',
            from: occurrenceBoundary(nextMonday, timezone),
            to: occurrenceBoundary(afterNextMonday, timezone),
        }
        return { prev, current, next }
    }

    // dayGridDay / timeGridDay
    const prevDay = plainDate.subtract({ days: 1 })
    const nextDay = plainDate.add({ days: 1 })
    const afterNextDay = plainDate.add({ days: 2 })

    const prev: CalendarPeriod = {
        key: `day:${prevDay.toString()}`,
        unit: 'day',
        from: occurrenceBoundary(prevDay, timezone),
        to: occurrenceBoundary(plainDate, timezone),
    }
    const current: CalendarPeriod = {
        key: `day:${plainDate.toString()}`,
        unit: 'day',
        from: occurrenceBoundary(plainDate, timezone),
        to: occurrenceBoundary(nextDay, timezone),
    }
    const next: CalendarPeriod = {
        key: `day:${nextDay.toString()}`,
        unit: 'day',
        from: occurrenceBoundary(nextDay, timezone),
        to: occurrenceBoundary(afterNextDay, timezone),
    }
    return { prev, current, next }
}

export function useCalendarPagination({
    view,
    date,
    timezone,
}: {
    view: CalendarViewType
    date: string
    timezone: string
}) {
    const queryClient = useQueryClient()
    const { prev, current, next } = useMemo(
        () => computeCalendarPeriods(view, date, timezone),
        [view, date, timezone],
    )

    const periods = useMemo(() => [prev, current, next], [prev, current, next])

    // Запросы событий для [prev, current, next]
    const eventQueries = useQueries({
        queries: periods.map((p) => ({
            queryKey: [
                'calendar-events',
                p.unit,
                p.key,
                p.from,
                p.to,
                timezone,
            ],
            queryFn: () =>
                api.events.listOccurrences({
                    from: p.from,
                    to: p.to,
                }),
            staleTime: 60 * 1000,
        })),
    })

    // Запросы дедлайнов для [prev, current, next]
    const deadlineQueries = useQueries({
        queries: periods.map((p) => ({
            queryKey: [
                'calendar-deadlines',
                p.unit,
                p.key,
                p.from,
                p.to,
                timezone,
            ],
            queryFn: () =>
                api.deadlines.listOccurrences({
                    from: p.from,
                    to: p.to,
                    limit: 512,
                    withCompleted: true,
                }),
            staleTime: 60 * 1000,
        })),
    })

    // Текущая страница: индекс 1 (current)
    const currentEventQuery = eventQueries[1]
    const currentDeadlineQuery = deadlineQueries[1]

    // Лоадер показывается ТОЛЬКО если данных для текущей страницы еще нет в кэше
    const isCurrentPageLoading = Boolean(
        currentEventQuery?.isLoading || currentDeadlineQuery?.isLoading,
    )

    // Проверяем наличие ошибок на текущей странице
    const error =
        currentEventQuery?.error?.message ??
        currentDeadlineQuery?.error?.message ??
        null

    const eventData0 = eventQueries[0]?.data
    const eventData1 = eventQueries[1]?.data
    const eventData2 = eventQueries[2]?.data

    // Дедуплицированное объединение всех доступных событий из загруженных периодов
    const events = useMemo(() => {
        const map = new Map<string, ResolvedEvent>()
        for (const data of [eventData0, eventData1, eventData2]) {
            if (Array.isArray(data)) {
                for (const ev of data) {
                    const idKey = `${ev.id}:${ev.recurrenceId ?? 'master'}`
                    map.set(idKey, ev)
                }
            }
        }
        return Array.from(map.values())
    }, [eventData0, eventData1, eventData2])

    const deadlineData0 = deadlineQueries[0]?.data
    const deadlineData1 = deadlineQueries[1]?.data
    const deadlineData2 = deadlineQueries[2]?.data

    // Дедуплицированное объединение всех доступных дедлайнов из загруженных периодов
    const deadlines = useMemo(() => {
        const map = new Map<string, ResolvedDeadline>()
        for (const data of [deadlineData0, deadlineData1, deadlineData2]) {
            if (Array.isArray(data)) {
                for (const d of data) {
                    const idKey = `${d.id}:${d.recurrenceId ?? 'master'}`
                    map.set(idKey, d)
                }
            }
        }
        return Array.from(map.values())
    }, [deadlineData0, deadlineData1, deadlineData2])

    // Принудительное обновление для кнопки "Обновить"
    const refetch = useCallback(async () => {
        await Promise.all([
            ...eventQueries.map((q) => q.refetch()),
            ...deadlineQueries.map((q) => q.refetch()),
            queryClient.invalidateQueries({ queryKey: ['masterDeadlines'] }),
        ])
    }, [eventQueries, deadlineQueries, queryClient])

    return {
        events,
        deadlines,
        isCalendarLoading: isCurrentPageLoading,
        error,
        refetch,
    }
}
