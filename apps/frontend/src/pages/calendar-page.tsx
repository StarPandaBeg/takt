import FullCalendar, { type CalendarRef } from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import ruLocale from '@fullcalendar/react/locales/ru'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Loader2,
    PanelRight,
    PanelRightClose,
    Plus,
    RefreshCw,
    Repeat,
    Trash2,
    Undo2,
} from 'lucide-react'
import {
    useCallback,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import { useSearchParams } from 'react-router-dom'

import { ConfirmDialog } from '../components/common/confirm-dialog'
import { ErrorBanner } from '../components/common/error-banner'
import { DeadlineDialog } from '../components/deadlines/deadline-dialog'
import { EventDialog } from '../components/events/event-dialog'
import { PageHeader } from '../components/page-header'
import { useToast } from '../context/use-toast'
import { useApplicationToday } from '../hooks/use-application-today'
import { useCalendarPagination } from '../hooks/use-calendar-pagination'
import { useDelayedDeadlineCompletion } from '../hooks/use-delayed-deadline-completion'
import {
    buildIsoDateTime,
    eventTime,
    extractDateString,
    extractTimeString,
    formatDeadlineDue,
    formatLongDate,
    formatMonth,
    getTodayIso,
    parseIsoDate,
    toIsoDate,
} from '../lib/date'
import { formatRecurrenceRule } from '../lib/recurrence-format'
import type {
    DeadlineEntity,
    ResolvedDeadline,
    ResolvedEvent,
} from '../types/api'
import { useTakt } from '../use-app'

type Section = 'calendar' | 'deadlines'
type DeadlineFilter = 'all' | 'active' | 'completed'
type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

interface EventDraft {
    date: string
    start?: string
    end?: string
    allDay: boolean
}

function timeFromDate(date: Date, timezone: string) {
    return extractTimeString(date.toISOString(), timezone)
}

const mobileCalendarQuery = '(max-width: 820px)'

function subscribeToMobileCalendar(onStoreChange: () => void): () => void {
    const media = window.matchMedia(mobileCalendarQuery)
    media.addEventListener('change', onStoreChange)
    return () => media.removeEventListener('change', onStoreChange)
}

function getMobileCalendarSnapshot(): boolean {
    return window.matchMedia(mobileCalendarQuery).matches
}

function calendarDateTimeToUtc(
    value: string,
    allDay: boolean,
    timezone: string,
): string {
    const date = value.slice(0, 10)
    const time = allDay ? null : value.slice(11, 16)
    return buildIsoDateTime(date, time, allDay, timezone)
}

export function CalendarPage() {
    const {
        masterDeadlines,
        settings,
        error: taktError,
        refreshAll,
        clearError,
        createEvent,
        updateEvent,
        cancelEvent,
        deleteEvent,
        createDeadline,
        updateDeadline,
        toggleDeadline,
        cancelDeadline,
        deleteDeadline,
    } = useTakt()
    const toast = useToast()
    const timezone = settings.timezone
    const [params] = useSearchParams()
    const initialToday = getTodayIso(timezone)
    const initialDate = params.get('date') ?? initialToday
    const [selectedDate, setSelectedDate] = useState(initialDate)
    const [activeCalendarDate, setActiveCalendarDate] = useState(initialDate)
    const [calendarTitle, setCalendarTitle] = useState(() =>
        formatMonth(parseIsoDate(initialDate)),
    )
    const [calendarView, setCalendarView] =
        useState<CalendarView>('dayGridMonth')

    const {
        events,
        deadlines,
        isCalendarLoading,
        error: calendarPaginationError,
        refetch: refetchCalendar,
    } = useCalendarPagination({
        view: calendarView,
        date: activeCalendarDate,
        timezone,
    })

    const [isRefreshing, setIsRefreshing] = useState(false)
    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true)
        try {
            await refetchCalendar()
            clearError()
        } catch (err: unknown) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Не удалось обновить данные календаря',
            )
        } finally {
            setIsRefreshing(false)
        }
    }, [clearError, refetchCalendar, toast])

    const isMobileCalendar = useSyncExternalStore(
        subscribeToMobileCalendar,
        getMobileCalendarSnapshot,
        () => false,
    )
    const calendarRef = useRef<CalendarRef>(null)
    const schedulePanelRef = useRef<HTMLElement>(null)
    const lastClickRef = useRef<{
        dateStr: string
        timestamp: number
    } | null>(null)
    const error = taktError ?? calendarPaginationError
    const today = useApplicationToday(timezone, (nextToday, previousToday) => {
        if (selectedDate === previousToday) {
            setSelectedDate(nextToday)
            calendarRef.current?.getApi().gotoDate(nextToday)
        }
        void refreshAll()
    })
    const sectionParam = params.get('section')
    const [userSection, setUserSection] = useState<Section | null>(null)
    const section: Section =
        userSection ?? (sectionParam === 'deadlines' ? 'deadlines' : 'calendar')
    const setSection = (next: Section) => setUserSection(next)

    const [showDeadlines, setShowDeadlines] = useState(true)
    const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all')
    const [expandedSeriesIds, setExpandedSeriesIds] = useState<Set<number>>(
        () => new Set(),
    )

    const toggleSeriesExpand = (id: number) => {
        setExpandedSeriesIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const [editingEvent, setEditingEvent] = useState<ResolvedEvent | null>(null)
    const [eventDraft, setEventDraft] = useState<EventDraft | null>(null)
    const [editingDeadline, setEditingDeadline] = useState<
        ResolvedDeadline | 'new' | null
    >(null)
    const [deletingEventId, setDeletingEventId] = useState<number | null>(null)

    // Отложенное завершение дедлайнов с возможностью отмены
    const {
        isCompleting: isDeadlineCompleting,
        isSubmitting: isDeadlineSubmitting,
        handleToggleDeadline,
        handleCancelCompletion: handleCancelDeadlineCompletion,
    } = useDelayedDeadlineCompletion({
        onComplete: toggleDeadline,
        delayMs: 5000,
    })

    const [scheduleWidth, setScheduleWidth] = useState<number>(() => {
        if (typeof window === 'undefined') return 340
        const saved = localStorage.getItem('takt_cal_schedule_width')
        if (saved) {
            const parsed = Number.parseInt(saved, 10)
            if (!Number.isNaN(parsed) && parsed >= 240 && parsed <= 600) {
                return parsed
            }
        }
        return 340
    })
    const [isScheduleVisible, setIsScheduleVisible] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true
        return localStorage.getItem('takt_cal_schedule_visible') !== 'false'
    })

    const toggleScheduleVisible = () => {
        setIsScheduleVisible((prev) => {
            const next = !prev
            localStorage.setItem('takt_cal_schedule_visible', String(next))
            return next
        })
    }

    const handleSplitterPointerDown = (e: React.PointerEvent) => {
        e.preventDefault()
        const startX = e.clientX
        const startWidth = scheduleWidth
        const onPointerMove = (moveEvent: PointerEvent) => {
            const delta = startX - moveEvent.clientX
            const newWidth = Math.min(600, Math.max(240, startWidth + delta))
            setScheduleWidth(newWidth)
            localStorage.setItem('takt_cal_schedule_width', String(newWidth))
        }
        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('pointerup', onPointerUp)
        }
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
    }

    const goToPrevDay = () => {
        const d = parseIsoDate(selectedDate)
        d.setDate(d.getDate() - 1)
        const nextIso = toIsoDate(d)
        setSelectedDate(nextIso)
        calendarRef.current?.getApi().gotoDate(nextIso)
    }

    const goToNextDay = () => {
        const d = parseIsoDate(selectedDate)
        d.setDate(d.getDate() + 1)
        const nextIso = toIsoDate(d)
        setSelectedDate(nextIso)
        calendarRef.current?.getApi().gotoDate(nextIso)
    }

    const goToToday = () => {
        setSelectedDate(today)
        calendarRef.current?.getApi().gotoDate(today)
    }

    const scrollToSelectedDay = () => {
        schedulePanelRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }

    const moveCalendarEntry = async (info: {
        event: {
            allDay: boolean
            startStr: string
            endStr: string
            extendedProps: Record<string, unknown>
        }
        revert: () => void
    }) => {
        if (isMobileCalendar) {
            info.revert()
            return
        }

        const { event } = info
        const start = calendarDateTimeToUtc(
            event.startStr,
            event.allDay,
            timezone,
        )
        const ext = event.extendedProps

        try {
            if (ext.kind === 'event') {
                const raw = ext.rawEvent as ResolvedEvent
                const scope = raw.recurrenceId ? 'occurrence' : 'series'
                await updateEvent(raw.id, {
                    scope,
                    ...(raw.recurrenceId
                        ? { recurrenceId: raw.recurrenceId }
                        : {}),
                    changes: {
                        start,
                        end:
                            raw.end === null || event.endStr.length === 0
                                ? null
                                : calendarDateTimeToUtc(
                                      event.endStr,
                                      event.allDay,
                                      timezone,
                                  ),
                        allDay: event.allDay,
                        timezone,
                    },
                })
                return
            }

            if (ext.kind === 'deadline') {
                const raw = ext.rawDeadline as ResolvedDeadline
                const scope = raw.recurrenceId ? 'occurrence' : 'series'
                await updateDeadline(raw.id, {
                    scope,
                    ...(raw.recurrenceId
                        ? { recurrenceId: raw.recurrenceId }
                        : {}),
                    changes: {
                        due: start,
                        dueIsDate: event.allDay,
                        timezone,
                    },
                })
            }
        } catch {
            info.revert()
        }
    }

    // Преобразование событий и дедлайнов в формат FullCalendar
    const calendarEvents = useMemo(() => {
        const mappedEvents = events.map((event) => {
            const dateStr = extractDateString(event.start, timezone)
            return {
                id: `event:${event.id}:${event.recurrenceId ?? 'master'}`,
                title: event.title,
                start: event.allDay ? dateStr : event.start,
                ...(event.end && !event.allDay ? { end: event.end } : {}),
                allDay: event.allDay,
                extendedProps: {
                    kind: 'event' as const,
                    rawEvent: event,
                },
            }
        })

        if (!showDeadlines) return mappedEvents

        const mappedDeadlines = deadlines.map((deadline) => {
            const dateStr = extractDateString(deadline.due, timezone)
            return {
                id: `deadline:${deadline.id}:${deadline.recurrenceId ?? 'master'}`,
                title: deadline.title,
                start: deadline.dueIsDate ? dateStr : deadline.due,
                allDay: deadline.dueIsDate,
                classNames: [
                    'deadline-calendar-event',
                    ...(deadline.completed ? ['is-complete'] : []),
                ],
                extendedProps: {
                    kind: 'deadline' as const,
                    rawDeadline: deadline,
                },
            }
        })

        return [...mappedEvents, ...mappedDeadlines]
    }, [events, deadlines, showDeadlines, timezone])

    // События и дедлайны выбранного дня
    const selectedEvents = useMemo(() => {
        return events
            .filter(
                (event) =>
                    extractDateString(event.start, timezone) === selectedDate,
            )
            .sort((a, b) => a.start.localeCompare(b.start))
    }, [events, selectedDate, timezone])

    const selectedDeadlines = useMemo(() => {
        return deadlines.filter(
            (deadline) =>
                extractDateString(deadline.due, timezone) === selectedDate,
        )
    }, [deadlines, selectedDate, timezone])

    // Группировка дедлайнов по сериям для вкладки списка дедлайнов
    const groupedDeadlines = useMemo(() => {
        if (section !== 'deadlines') return []

        const masterMap = new Map<number, DeadlineEntity>()
        for (const m of masterDeadlines) {
            masterMap.set(m.id, m)
        }

        // Если в occurrences есть дедлайн, не присутствующий в masterMap (фоллбэк)
        for (const d of deadlines) {
            if (!masterMap.has(d.id)) {
                masterMap.set(d.id, {
                    id: d.id,
                    title: d.title,
                    description: d.description,
                    due: d.due,
                    dueIsDate: d.dueIsDate,
                    timezone: d.timezone,
                    cancelledAt: null,
                    createdAt: d.due,
                    updatedAt: d.due,
                    recurrence: null,
                    visibility: d.visibility,
                    completedAt: d.completed ? (d.completedAt ?? d.due) : null,
                    completions: [],
                    exceptions: [],
                })
            }
        }

        const items: Array<{
            id: number
            type: 'single' | 'series'
            title: string
            description: string | null
            ruleText: string | null
            isOverdue: boolean
            isComplete: boolean
            activeOccurrence: ResolvedDeadline
            masterAsResolved: ResolvedDeadline
            upcomingOccurrences: ResolvedDeadline[]
            totalOccurrencesCount: number
        }> = []

        for (const master of masterMap.values()) {
            if (master.cancelledAt) continue

            // Исключенные (отмененные пользователем) вхождения
            const cancelledRecurrenceIds = new Set(
                (master.exceptions || [])
                    .filter((e) => e.status === 'cancelled')
                    .map((e) => e.recurrenceId),
            )

            // Валидные вхождения (исключая отмененные)
            const occurrences = deadlines
                .filter((d) => d.id === master.id)
                .filter(
                    (d) =>
                        !d.recurrenceId ||
                        !cancelledRecurrenceIds.has(d.recurrenceId),
                )
                .sort((a, b) => a.due.localeCompare(b.due))

            const masterAsResolved: ResolvedDeadline = {
                id: master.id,
                title: master.title,
                description: master.description,
                due: master.due,
                dueIsDate: master.dueIsDate,
                timezone: master.timezone,
                completed: Boolean(master.completedAt),
                completedAt: master.completedAt,
                recurrenceId: null,
                visibility: master.visibility,
            }

            const isSeries = Boolean(master.recurrence)

            if (!isSeries) {
                const activeOccurrence = occurrences[0] ?? masterAsResolved
                const isComplete =
                    Boolean(master.completedAt) || activeOccurrence.completed
                const isOverdue =
                    !isComplete &&
                    extractDateString(activeOccurrence.due, timezone) < today

                items.push({
                    id: master.id,
                    type: 'single',
                    title: activeOccurrence.title || master.title,
                    description:
                        activeOccurrence.description ?? master.description,
                    ruleText: null,
                    isOverdue,
                    isComplete,
                    activeOccurrence,
                    masterAsResolved,
                    upcomingOccurrences: [],
                    totalOccurrencesCount: 1,
                })
            } else {
                const ruleText = formatRecurrenceRule(master.recurrence)

                // Разделяем вхождения на просроченные невыполненные, будущие невыполненные и выполненные
                const overdueUncompleted = occurrences.filter(
                    (o) =>
                        !o.completed &&
                        extractDateString(o.due, timezone) < today,
                )
                const upcomingUncompleted = occurrences.filter(
                    (o) =>
                        !o.completed &&
                        extractDateString(o.due, timezone) >= today,
                )
                const completedOccurrences = occurrences.filter(
                    (o) => o.completed,
                )
                const lastCompleted =
                    completedOccurrences.length > 0
                        ? completedOccurrences[completedOccurrences.length - 1]
                        : null

                let isComplete: boolean
                let activeOccurrence: ResolvedDeadline

                if (overdueUncompleted.length > 0) {
                    // 1. Приоритет: есть просроченные невыполненные долги
                    activeOccurrence = overdueUncompleted[0]
                    isComplete = false
                } else if (upcomingUncompleted.length > 0) {
                    // 2. Есть невыполненные вхождения на сегодня или в будущем
                    const nextUncompleted = upcomingUncompleted[0]

                    // Если шаг за текущий период уже выполнен, а следующий срок еще не наступил
                    if (
                        lastCompleted &&
                        extractDateString(lastCompleted.due, timezone) <=
                            today &&
                        extractDateString(nextUncompleted.due, timezone) > today
                    ) {
                        isComplete = true
                        activeOccurrence = lastCompleted
                    } else {
                        isComplete = false
                        activeOccurrence = nextUncompleted
                    }
                } else if (lastCompleted) {
                    // 3. Все запланированные вхождения серии выполнены
                    activeOccurrence = lastCompleted
                    isComplete = true
                } else {
                    // 4. Фоллбэк
                    activeOccurrence = masterAsResolved
                    isComplete = Boolean(master.completedAt)
                }

                const isOverdue =
                    !isComplete &&
                    extractDateString(activeOccurrence.due, timezone) < today

                // До 6 ближайших вхождений для раскрывающегося списка повторов
                const activeIdx = occurrences.indexOf(activeOccurrence)
                const startIdx = Math.max(0, activeIdx)
                const upcomingOccurrences = occurrences.slice(
                    startIdx,
                    startIdx + 6,
                )

                items.push({
                    id: master.id,
                    type: 'series',
                    title: master.title,
                    description: master.description,
                    ruleText,
                    isOverdue,
                    isComplete,
                    activeOccurrence,
                    masterAsResolved,
                    upcomingOccurrences,
                    totalOccurrencesCount: occurrences.length,
                })
            }
        }

        // Сортировка: сначала активные (невыполненные), затем выполненные
        items.sort((a, b) => {
            const aDone = a.isComplete || a.activeOccurrence.completed
            const bDone = b.isComplete || b.activeOccurrence.completed
            if (aDone !== bDone) {
                return aDone ? 1 : -1
            }
            return a.activeOccurrence.due.localeCompare(b.activeOccurrence.due)
        })

        return items
    }, [masterDeadlines, deadlines, today, timezone, section])

    // Фильтрация сгруппированных дедлайнов (строго по рассчитанному статусу выполнения)
    const filteredGroupedDeadlines = useMemo(() => {
        if (section !== 'deadlines') return []
        return groupedDeadlines.filter((item) => {
            const isDone = item.isComplete || item.activeOccurrence.completed
            if (deadlineFilter === 'active') {
                return !isDone
            }
            if (deadlineFilter === 'completed') {
                return isDone
            }
            return true
        })
    }, [groupedDeadlines, deadlineFilter, section])

    // Точные счётчики дедлайнов (строго соответствуют количеству элементов в каждом фильтре)
    const deadlineCounts = useMemo(() => {
        if (section !== 'deadlines') {
            return { all: masterDeadlines.length, active: 0, completed: 0 }
        }
        let all = 0
        let active = 0
        let completed = 0

        for (const item of groupedDeadlines) {
            all += 1
            const isDone = item.isComplete || item.activeOccurrence.completed
            if (isDone) {
                completed += 1
            } else {
                active += 1
            }
        }

        return { all, active, completed }
    }, [groupedDeadlines, masterDeadlines.length, section])

    const openEventDraft = (draft: EventDraft) => {
        setSelectedDate(draft.date)
        setEditingEvent(null)
        setEventDraft(draft)
    }

    const moveCalendar = (direction: 'prev' | 'next') => {
        const calendarApi = calendarRef.current?.getApi()
        if (!calendarApi) return
        calendarApi[direction]()
    }

    const goToday = () => {
        const calendarApi = calendarRef.current?.getApi()
        calendarApi?.today()
    }

    const changeView = (view: CalendarView) => {
        calendarRef.current?.getApi().changeView(view, selectedDate)
        setCalendarView(view)
    }

    return (
        <div
            className={`page calendar-page ${section === 'calendar' ? 'is-calendar-view' : 'is-deadlines-view'}`}
        >
            <PageHeader
                eyebrow=""
                title="Календарь"
                action={
                    <button
                        className="button"
                        type="button"
                        disabled={isCalendarLoading || isRefreshing}
                        onClick={() => {
                            void handleRefresh()
                        }}
                    >
                        {isCalendarLoading || isRefreshing ? (
                            <Loader2
                                size={16}
                                className="spin-animation"
                                aria-hidden="true"
                            />
                        ) : (
                            <RefreshCw size={16} aria-hidden="true" />
                        )}
                        {isCalendarLoading || isRefreshing
                            ? 'Обновление…'
                            : 'Обновить'}
                    </button>
                }
            />

            {error && (
                <ErrorBanner
                    message={error}
                    onRetry={() => {
                        void refreshAll()
                    }}
                    onDismiss={clearError}
                />
            )}

            <div className="calendar-section-tabs" role="tablist">
                <button
                    className={section === 'calendar' ? 'is-active' : ''}
                    type="button"
                    role="tab"
                    aria-selected={section === 'calendar'}
                    onClick={() => setSection('calendar')}
                >
                    Календарь
                </button>
                <button
                    className={section === 'deadlines' ? 'is-active' : ''}
                    type="button"
                    role="tab"
                    aria-selected={section === 'deadlines'}
                    onClick={() => setSection('deadlines')}
                >
                    Все дедлайны ({deadlineCounts.all})
                </button>
            </div>

            {section === 'calendar' ? (
                <section
                    className={`calendar-workspace ${!isScheduleVisible ? 'is-collapsed' : ''}`}
                    style={
                        isScheduleVisible
                            ? {
                                  gridTemplateColumns: `minmax(0, 1fr) 8px ${scheduleWidth}px`,
                              }
                            : undefined
                    }
                >
                    <div className="calendar-main-column">
                        <header className="calendar-controls">
                            <div className="calendar-controls__nav">
                                <button
                                    className="icon-button"
                                    type="button"
                                    onClick={() => moveCalendar('prev')}
                                    aria-label="Предыдущий период"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    className="icon-button"
                                    type="button"
                                    onClick={() => moveCalendar('next')}
                                    aria-label="Следующий период"
                                >
                                    <ChevronRight size={20} />
                                </button>
                                <button
                                    className="button button--quiet button--small"
                                    type="button"
                                    onClick={goToday}
                                >
                                    Сегодня
                                </button>
                            </div>
                            <h2>{calendarTitle}</h2>
                            <div className="calendar-controls__right">
                                <label className="deadline-visibility">
                                    <input
                                        type="checkbox"
                                        checked={showDeadlines}
                                        onChange={(event) =>
                                            setShowDeadlines(
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    Дедлайны
                                </label>
                                <div
                                    className="view-switcher"
                                    role="group"
                                    aria-label="Режим календаря"
                                >
                                    {(
                                        [
                                            ['dayGridMonth', 'Месяц'],
                                            ['timeGridWeek', 'Неделя'],
                                            ['timeGridDay', 'День'],
                                        ] as const
                                    ).map(([view, label]) => (
                                        <button
                                            key={view}
                                            className={
                                                calendarView === view
                                                    ? 'is-active'
                                                    : ''
                                            }
                                            type="button"
                                            onClick={() => changeView(view)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="icon-button icon-button--ghost calendar-controls__toggle-schedule"
                                    type="button"
                                    onClick={toggleScheduleVisible}
                                    title={
                                        isScheduleVisible
                                            ? 'Скрыть расписание дня'
                                            : 'Показать расписание дня'
                                    }
                                    aria-label={
                                        isScheduleVisible
                                            ? 'Скрыть расписание дня'
                                            : 'Показать расписание дня'
                                    }
                                >
                                    {isScheduleVisible ? (
                                        <PanelRightClose size={17} />
                                    ) : (
                                        <PanelRight size={17} />
                                    )}
                                </button>
                            </div>
                        </header>

                        <div
                            className={`full-calendar-viewport${isCalendarLoading || isRefreshing ? ' is-loading' : ''}`}
                            aria-busy={isCalendarLoading || isRefreshing}
                        >
                            {(isCalendarLoading || isRefreshing) && (
                                <div className="calendar-loading-overlay">
                                    <Loader2
                                        size={20}
                                        className="spin-animation"
                                        aria-hidden="true"
                                    />
                                    <span>Загрузка данных…</span>
                                </div>
                            )}
                            <FullCalendar
                                ref={calendarRef}
                                timeZone={timezone}
                                plugins={[
                                    dayGridPlugin,
                                    timeGridPlugin,
                                    interactionPlugin,
                                    classicThemePlugin,
                                ]}
                                locale={ruLocale}
                                initialView="dayGridMonth"
                                initialDate={initialDate}
                                now={today}
                                headerToolbar={false}
                                firstDay={1}
                                height="100%"
                                expandRows
                                dayMaxEvents={isMobileCalendar ? false : 3}
                                moreLinkText={(count) => `+ ещё ${count}`}
                                nowIndicator
                                allDayText="Весь день"
                                slotMinTime="07:00:00"
                                slotMaxTime="23:00:00"
                                slotDuration="00:30:00"
                                events={calendarEvents}
                                eventStartEditable={!isMobileCalendar}
                                eventDurationEditable={false}
                                eventDrop={(info) => {
                                    void moveCalendarEntry(info)
                                }}
                                {...(isMobileCalendar
                                    ? {
                                          eventContent: (info) => (
                                              <span
                                                  className="mobile-calendar-dot"
                                                  aria-label={info.event.title}
                                                  title={info.event.title}
                                              />
                                          ),
                                      }
                                    : {})}
                                datesSet={(info) => {
                                    setCalendarTitle(info.view.title)
                                    const view = info.view.type as CalendarView
                                    setCalendarView(view)
                                    const nextDate = toIsoDate(
                                        info.view.currentStart,
                                    )
                                    setActiveCalendarDate(nextDate)
                                    setSelectedDate(nextDate)
                                }}
                                dayCellClass={(info) =>
                                    toIsoDate(info.date) === selectedDate
                                        ? 'is-selected-day'
                                        : ''
                                }
                                dayHeaderClass={(info) =>
                                    toIsoDate(info.date) === selectedDate
                                        ? 'is-selected-day'
                                        : ''
                                }
                                dateClick={(info) => {
                                    const date = info.dateStr.slice(0, 10)
                                    setSelectedDate(date)
                                    calendarRef.current?.getApi().unselect()

                                    const now = Date.now()
                                    const isDoubleClick =
                                        info.jsEvent.detail >= 2 ||
                                        (lastClickRef.current &&
                                            lastClickRef.current.dateStr ===
                                                info.dateStr &&
                                            now -
                                                lastClickRef.current.timestamp <
                                                350)

                                    if (isDoubleClick && !isMobileCalendar) {
                                        lastClickRef.current = null
                                        openEventDraft({
                                            date,
                                            start: info.allDay
                                                ? undefined
                                                : timeFromDate(
                                                      info.date,
                                                      timezone,
                                                  ),
                                            allDay: info.allDay,
                                        })
                                    } else {
                                        lastClickRef.current = {
                                            dateStr: info.dateStr,
                                            timestamp: now,
                                        }
                                        if (
                                            isMobileCalendar &&
                                            schedulePanelRef.current
                                        ) {
                                            scrollToSelectedDay()
                                        }
                                    }
                                }}
                                eventClick={(info) => {
                                    const ext = info.event.extendedProps
                                    if (isMobileCalendar) {
                                        const raw =
                                            ext.kind === 'deadline'
                                                ? (
                                                      ext.rawDeadline as ResolvedDeadline
                                                  ).due
                                                : (
                                                      ext.rawEvent as ResolvedEvent
                                                  ).start
                                        setSelectedDate(
                                            extractDateString(raw, timezone),
                                        )
                                        scrollToSelectedDay()
                                        return
                                    }
                                    if (ext.kind === 'deadline') {
                                        const raw =
                                            ext.rawDeadline as ResolvedDeadline
                                        setSelectedDate(
                                            extractDateString(
                                                raw.due,
                                                timezone,
                                            ),
                                        )
                                        setEditingDeadline(raw)
                                        return
                                    }
                                    if (ext.kind === 'event') {
                                        const raw =
                                            ext.rawEvent as ResolvedEvent
                                        setSelectedDate(
                                            extractDateString(
                                                raw.start,
                                                timezone,
                                            ),
                                        )
                                        setEditingEvent(raw)
                                    }
                                }}
                            />
                            {isCalendarLoading && (
                                <div
                                    className="calendar-loading-overlay"
                                    role="status"
                                    aria-live="polite"
                                >
                                    <Loader2
                                        size={28}
                                        className="spin-animation"
                                        aria-hidden="true"
                                    />
                                    <span>Загрузка календаря…</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {isScheduleVisible && (
                        <div
                            className="calendar-splitter"
                            role="separator"
                            aria-orientation="vertical"
                            title="Потяните для изменения ширины или дважды кликните для скрытия"
                            onPointerDown={handleSplitterPointerDown}
                            onDoubleClick={toggleScheduleVisible}
                        >
                            <div className="calendar-splitter__handle" />
                        </div>
                    )}

                    {isScheduleVisible && (
                        <aside
                            ref={schedulePanelRef}
                            className="selected-day-panel"
                            style={{ width: `${scheduleWidth}px` }}
                        >
                            <header className="selected-day-panel__header">
                                <div>
                                    <span>Выбранный день</span>
                                    <h2>{formatLongDate(selectedDate)}</h2>
                                </div>
                                <div className="selected-day-panel__header-actions">
                                    <div className="schedule-widget__day-nav">
                                        <button
                                            className="icon-button icon-button--compact"
                                            type="button"
                                            onClick={goToPrevDay}
                                            aria-label="Предыдущий день"
                                            title="Предыдущий день"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button
                                            className={`schedule-today-pill ${selectedDate === today ? 'is-active' : ''}`}
                                            type="button"
                                            onClick={goToToday}
                                            title="Сегодня"
                                        >
                                            Сегодня
                                        </button>
                                        <button
                                            className="icon-button icon-button--compact"
                                            type="button"
                                            onClick={goToNextDay}
                                            aria-label="Следующий день"
                                            title="Следующий день"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                    <button
                                        className="icon-button icon-button--ink"
                                        type="button"
                                        onClick={() =>
                                            openEventDraft({
                                                date: selectedDate,
                                                allDay: false,
                                            })
                                        }
                                        aria-label="Добавить событие"
                                        title="Добавить событие"
                                    >
                                        <Plus size={19} />
                                    </button>
                                    <button
                                        className="icon-button icon-button--ghost"
                                        type="button"
                                        onClick={toggleScheduleVisible}
                                        aria-label="Скрыть расписание"
                                        title="Скрыть расписание"
                                    >
                                        <PanelRightClose size={17} />
                                    </button>
                                </div>
                            </header>
                            <div className="selected-day-panel__content">
                                {selectedEvents.map((event) => (
                                    <div
                                        className="selected-day-event"
                                        key={`${event.id}-${event.recurrenceId ?? 'master'}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditingEvent(event)
                                            }
                                        >
                                            <time>
                                                {eventTime(event, timezone)}
                                            </time>
                                            <strong>{event.title}</strong>
                                            {event.recurrenceId && (
                                                <span
                                                    className="event-repeat-tag"
                                                    title="Повторяющееся событие"
                                                >
                                                    <Repeat size={12} />
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            className="icon-button icon-button--danger"
                                            type="button"
                                            onClick={() =>
                                                setDeletingEventId(event.id)
                                            }
                                            aria-label={`Удалить «${event.title}»`}
                                            title="Удалить событие"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {!selectedEvents.length && (
                                    <div className="compact-empty">
                                        <p>Событий нет.</p>
                                        <button
                                            className="text-link"
                                            type="button"
                                            onClick={() =>
                                                openEventDraft({
                                                    date: selectedDate,
                                                    allDay: false,
                                                })
                                            }
                                        >
                                            Добавить событие
                                        </button>
                                    </div>
                                )}

                                {selectedDeadlines.length > 0 && (
                                    <div className="selected-day-deadlines">
                                        <h3>Дедлайны на этот день</h3>
                                        {selectedDeadlines.map((deadline) => {
                                            const inProcess =
                                                isDeadlineCompleting(deadline)
                                            const isDone =
                                                deadline.completed || inProcess

                                            return (
                                                <div
                                                    className={`selected-day-deadline${
                                                        isDone
                                                            ? ' is-complete'
                                                            : ''
                                                    }`}
                                                    key={`${deadline.id}-${deadline.recurrenceId ?? 'master'}`}
                                                >
                                                    <button
                                                        className="deadline__check"
                                                        type="button"
                                                        disabled={isDeadlineSubmitting(
                                                            deadline,
                                                        )}
                                                        onClick={() => {
                                                            handleToggleDeadline(
                                                                deadline,
                                                            )
                                                        }}
                                                        aria-label={`Изменить статус «${deadline.title}»`}
                                                    >
                                                        {isDeadlineSubmitting(
                                                            deadline,
                                                        ) ? (
                                                            <Loader2
                                                                size={13}
                                                                className="spin-animation"
                                                            />
                                                        ) : isDone ? (
                                                            <Check size={15} />
                                                        ) : null}
                                                    </button>
                                                    <button
                                                        className="selected-day-deadline__title"
                                                        type="button"
                                                        onClick={() => {
                                                            if (!inProcess) {
                                                                setEditingDeadline(
                                                                    deadline,
                                                                )
                                                            }
                                                        }}
                                                    >
                                                        {deadline.title}
                                                    </button>
                                                    {inProcess && (
                                                        <button
                                                            type="button"
                                                            className="deadline-undo-icon-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleCancelDeadlineCompletion(
                                                                    deadline,
                                                                )
                                                            }}
                                                            title="Отменить завершение"
                                                            aria-label="Отменить завершение"
                                                        >
                                                            <Undo2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}
                </section>
            ) : (
                <section className="all-deadlines">
                    <div className="all-deadlines__toolbar">
                        <div
                            className="deadline-filters"
                            role="group"
                            aria-label="Фильтр дедлайнов"
                        >
                            {(['all', 'active', 'completed'] as const).map(
                                (filter) => (
                                    <button
                                        key={filter}
                                        className={
                                            deadlineFilter === filter
                                                ? 'is-active'
                                                : ''
                                        }
                                        type="button"
                                        onClick={() =>
                                            setDeadlineFilter(filter)
                                        }
                                    >
                                        {filter === 'all'
                                            ? `Все (${deadlineCounts.all})`
                                            : filter === 'active'
                                              ? `Активные (${deadlineCounts.active})`
                                              : `Выполненные (${deadlineCounts.completed})`}
                                    </button>
                                ),
                            )}
                        </div>
                        <button
                            className="button button--primary"
                            type="button"
                            onClick={() => setEditingDeadline('new')}
                        >
                            <Plus size={16} /> Новый дедлайн
                        </button>
                    </div>

                    <div className="all-deadlines__list">
                        {filteredGroupedDeadlines.map((item) => {
                            const isSeries = item.type === 'series'
                            const isExpanded = expandedSeriesIds.has(item.id)
                            const inProcess = isDeadlineCompleting(
                                item.activeOccurrence,
                            )
                            const isItemDone =
                                item.isComplete ||
                                item.activeOccurrence.completed ||
                                inProcess

                            return (
                                <div
                                    className={`deadline-item${isItemDone ? ' is-complete' : ''}`}
                                    key={`deadline-${item.id}`}
                                >
                                    <div className="deadline-item__main">
                                        <button
                                            className="deadline__check"
                                            type="button"
                                            disabled={isDeadlineSubmitting(
                                                item.activeOccurrence,
                                            )}
                                            onClick={() => {
                                                handleToggleDeadline(
                                                    item.activeOccurrence,
                                                )
                                            }}
                                            aria-label={`Отметить «${item.title}»`}
                                            title={
                                                isItemDone
                                                    ? 'Срок выполнен'
                                                    : 'Отметить выполненным'
                                            }
                                        >
                                            {isDeadlineSubmitting(
                                                item.activeOccurrence,
                                            ) ? (
                                                <Loader2
                                                    size={13}
                                                    className="spin-animation"
                                                />
                                            ) : isItemDone ? (
                                                <Check size={15} />
                                            ) : null}
                                        </button>

                                        <button
                                            className="deadline-item__content"
                                            type="button"
                                            onClick={() => {
                                                if (!inProcess) {
                                                    setEditingDeadline(
                                                        isSeries
                                                            ? item.masterAsResolved
                                                            : item.activeOccurrence,
                                                    )
                                                }
                                            }}
                                            title={
                                                isSeries
                                                    ? 'Нажмите, чтобы настроить серию дедлайна'
                                                    : 'Редактировать дедлайн'
                                            }
                                        >
                                            <div className="deadline-item__title-row">
                                                <strong className="deadline-item__title">
                                                    {item.title}
                                                </strong>
                                                {isSeries && item.ruleText && (
                                                    <span className="deadline-badge deadline-badge--recurrence">
                                                        <Repeat size={12} />
                                                        {item.ruleText}
                                                    </span>
                                                )}
                                            </div>
                                            {item.description && (
                                                <span className="deadline-item__desc">
                                                    {item.description}
                                                </span>
                                            )}
                                        </button>

                                        <div className="deadline-item__params">
                                            {item.isOverdue && (
                                                <span className="deadline-badge deadline-badge--warning">
                                                    Просрочен
                                                </span>
                                            )}
                                            {item.activeOccurrence.visibility &&
                                                item.activeOccurrence.visibility
                                                    .hide === 'on_complete' && (
                                                    <span
                                                        className="deadline-badge"
                                                        title="Остается на экране до подтверждения выполнения"
                                                    >
                                                        До выполнения
                                                    </span>
                                                )}
                                            {item.activeOccurrence.visibility &&
                                                item.activeOccurrence.visibility
                                                    .show.type === 'before' && (
                                                    <span
                                                        className="deadline-badge"
                                                        title={`Появляется на экране за ${item.activeOccurrence.visibility.show.days} дн. до срока`}
                                                    >
                                                        Показ за{' '}
                                                        {
                                                            item
                                                                .activeOccurrence
                                                                .visibility.show
                                                                .days
                                                        }{' '}
                                                        дн.
                                                    </span>
                                                )}
                                            <time className="deadline-item__due">
                                                {formatDeadlineDue(
                                                    item.activeOccurrence.due,
                                                    item.activeOccurrence
                                                        .dueIsDate,
                                                    timezone,
                                                )}
                                            </time>
                                            {inProcess && (
                                                <button
                                                    type="button"
                                                    className="deadline-undo-icon-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCancelDeadlineCompletion(
                                                            item.activeOccurrence,
                                                        )
                                                    }}
                                                    title="Отменить завершение"
                                                    aria-label="Отменить завершение"
                                                >
                                                    <Undo2 size={13} />
                                                </button>
                                            )}
                                        </div>

                                        {isSeries ? (
                                            <button
                                                className="deadline-item__toggle-btn"
                                                type="button"
                                                onClick={() =>
                                                    toggleSeriesExpand(item.id)
                                                }
                                                aria-expanded={isExpanded}
                                                title="Показать повторы серии"
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        <span>Скрыть</span>
                                                        <ChevronUp size={14} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>
                                                            Повторы (
                                                            {
                                                                item
                                                                    .upcomingOccurrences
                                                                    .length
                                                            }
                                                            )
                                                        </span>
                                                        <ChevronDown
                                                            size={14}
                                                        />
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <div style={{ width: 84 }} />
                                        )}
                                    </div>

                                    {/* Раскрывающийся список отдельных повторов для серии */}
                                    {isSeries && isExpanded && (
                                        <div className="deadline-item__sublist">
                                            {item.upcomingOccurrences.map(
                                                (occ) => {
                                                    const occInProcess =
                                                        isDeadlineCompleting(
                                                            occ,
                                                        )
                                                    const occDone =
                                                        occ.completed ||
                                                        occInProcess
                                                    const isOccOverdue =
                                                        !occDone &&
                                                        extractDateString(
                                                            occ.due,
                                                            timezone,
                                                        ) < today

                                                    return (
                                                        <div
                                                            className={`deadline-subitem${occDone ? ' is-complete' : ''}`}
                                                            key={`occ-${occ.id}-${occ.recurrenceId ?? occ.due}`}
                                                        >
                                                            <button
                                                                className="deadline__check"
                                                                type="button"
                                                                disabled={isDeadlineSubmitting(
                                                                    occ,
                                                                )}
                                                                onClick={() => {
                                                                    handleToggleDeadline(
                                                                        occ,
                                                                    )
                                                                }}
                                                                aria-label={`Отметить срок на ${occ.due}`}
                                                            >
                                                                {isDeadlineSubmitting(
                                                                    occ,
                                                                ) ? (
                                                                    <Loader2
                                                                        size={
                                                                            12
                                                                        }
                                                                        className="spin-animation"
                                                                    />
                                                                ) : occDone ? (
                                                                    <Check
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                ) : null}
                                                            </button>

                                                            <button
                                                                className="deadline-subitem__btn"
                                                                type="button"
                                                                onClick={() => {
                                                                    if (
                                                                        !occInProcess
                                                                    ) {
                                                                        setEditingDeadline(
                                                                            occ,
                                                                        )
                                                                    }
                                                                }}
                                                                title="Редактировать это конкретное вхождение"
                                                            >
                                                                <strong>
                                                                    {occ.title}
                                                                </strong>
                                                                {isOccOverdue && (
                                                                    <span className="deadline-badge deadline-badge--warning">
                                                                        Просрочен
                                                                    </span>
                                                                )}
                                                            </button>

                                                            <div className="deadline__meta">
                                                                <time>
                                                                    {formatDeadlineDue(
                                                                        occ.due,
                                                                        occ.dueIsDate,
                                                                        timezone,
                                                                    )}
                                                                </time>
                                                                {occInProcess && (
                                                                    <button
                                                                        type="button"
                                                                        className="deadline-undo-icon-btn"
                                                                        onClick={(
                                                                            e,
                                                                        ) => {
                                                                            e.stopPropagation()
                                                                            handleCancelDeadlineCompletion(
                                                                                occ,
                                                                            )
                                                                        }}
                                                                        title="Отменить завершение"
                                                                        aria-label="Отменить завершение"
                                                                    >
                                                                        <Undo2
                                                                            size={
                                                                                13
                                                                            }
                                                                        />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                },
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {!filteredGroupedDeadlines.length && (
                            <div className="compact-empty">
                                <p>В этом списке пока нет дедлайнов.</p>
                                <button
                                    className="text-link"
                                    type="button"
                                    onClick={() => setEditingDeadline('new')}
                                >
                                    Создать новый дедлайн
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Диалоги */}
            {(eventDraft || editingEvent) && (
                <EventDialog
                    timezone={timezone}
                    event={editingEvent ?? undefined}
                    initialDate={
                        eventDraft?.date ??
                        (editingEvent
                            ? extractDateString(editingEvent.start, timezone)
                            : selectedDate)
                    }
                    initialStart={eventDraft?.start}
                    initialEnd={eventDraft?.end}
                    initialAllDay={eventDraft?.allDay}
                    onClose={() => {
                        setEventDraft(null)
                        setEditingEvent(null)
                        calendarRef.current?.getApi().unselect()
                    }}
                    onCreate={createEvent}
                    onUpdate={updateEvent}
                    onCancel={cancelEvent}
                    onDelete={deleteEvent}
                />
            )}

            {editingDeadline && (
                <DeadlineDialog
                    timezone={timezone}
                    deadline={
                        editingDeadline === 'new' ? undefined : editingDeadline
                    }
                    initialDate={selectedDate}
                    onClose={() => setEditingDeadline(null)}
                    onCreate={createDeadline}
                    onUpdate={updateDeadline}
                    onCancel={cancelDeadline}
                    onDelete={deleteDeadline}
                />
            )}

            {deletingEventId !== null && (
                <ConfirmDialog
                    title="Удалить событие"
                    message="Удалить это событие из базы данных?"
                    confirmLabel="Удалить"
                    onConfirm={() => {
                        void (async () => {
                            await deleteEvent(deletingEventId)
                            setDeletingEventId(null)
                        })()
                    }}
                    onClose={() => setDeletingEventId(null)}
                />
            )}
        </div>
    )
}
