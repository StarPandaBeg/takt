import {
    AlertCircle,
    CalendarPlus,
    Check,
    ChevronLeft,
    ChevronRight,
    Flag,
    Loader2,
    Plus,
    Repeat,
    StickyNote,
    Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorBanner } from '../components/common/error-banner'
import { LoadingIndicator } from '../components/common/loading-indicator'
import { DevicePreviewCard } from '../components/dashboard/device-preview-card'
import { DeadlineDialog } from '../components/deadlines/deadline-dialog'
import { EventDialog } from '../components/events/event-dialog'
import { MiniCalendar } from '../components/mini-calendar'
import { NoteDialog } from '../components/notes/note-dialog'
import { PageHeader } from '../components/page-header'
import { useToast } from '../context/use-toast'
import { useDelayedDeadlineCompletion } from '../hooks/use-delayed-deadline-completion'
import { useDelayedNoteCompletion } from '../hooks/use-delayed-note-completion'
import { useApplicationToday } from '../hooks/use-application-today'
import {
    eventTime,
    extractDateString,
    formatDeadlineDue,
    formatLongDate,
    getMonthOccurrenceRange,
    getTodayIso,
    parseIsoDate,
    toIsoDate,
} from '../lib/date'
import type { CreateKind, ResolvedDeadline, ResolvedEvent } from '../types'
import { useTakt } from '../use-app'

export function DashboardPage() {
    const {
        events,
        deadlines,
        masterDeadlines,
        notes,
        settings,
        isLoading,
        error,
        isServerConnected,
        screenRevision,
        refreshAll,
        refreshEvents,
        refreshDeadlines,
        refreshScreen,
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
        createNote,
        toggleNote,
    } = useTakt()
    const toast = useToast()

    const timezone = settings.timezone
    const initialToday = getTodayIso(timezone)
    const [selectedDate, setSelectedDate] = useState(initialToday)
    const [visibleMonth, setVisibleMonth] = useState(() =>
        parseIsoDate(initialToday),
    )
    const [isCalendarLoading, setIsCalendarLoading] = useState(false)
    const calendarRequestRef = useRef(0)

    const loadCalendarMonth = useCallback(
        async (month: Date) => {
            const requestId = ++calendarRequestRef.current
            const range = getMonthOccurrenceRange(
                toIsoDate(month),
                timezone,
            )
            setIsCalendarLoading(true)
            try {
                await Promise.all([
                    refreshEvents(range),
                    refreshDeadlines(range),
                ])
            } catch (err: unknown) {
                if (requestId === calendarRequestRef.current) {
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Не удалось обновить данные календаря',
                    )
                }
            } finally {
                if (requestId === calendarRequestRef.current) {
                    setIsCalendarLoading(false)
                }
            }
        },
        [refreshDeadlines, refreshEvents, timezone, toast],
    )

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadCalendarMonth(visibleMonth)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [loadCalendarMonth, visibleMonth])

    const changeVisibleMonth = (month: Date) => {
        if (
            month.getFullYear() === visibleMonth.getFullYear() &&
            month.getMonth() === visibleMonth.getMonth()
        ) {
            return
        }
        setVisibleMonth(month)
    }
    const today = useApplicationToday(
        timezone,
        (nextToday, previousToday) => {
            if (selectedDate === previousToday) {
                setSelectedDate(nextToday)
                changeVisibleMonth(parseIsoDate(nextToday))
            }
            void refreshAll()
        },
    )
    const [quickMenuOpen, setQuickMenuOpen] = useState(false)
    const [creating, setCreating] = useState<CreateKind | null>(null)
    const [editingEvent, setEditingEvent] = useState<ResolvedEvent | null>(null)
    const [editingDeadline, setEditingDeadline] =
        useState<ResolvedDeadline | null>(null)

    // Фильтрация событий на выбранную дату
    const selectedEvents = useMemo(() => {
        return events
            .filter(
                (event) =>
                    extractDateString(event.start, timezone) === selectedDate,
            )
            .sort((a, b) => a.start.localeCompare(b.start))
    }, [events, selectedDate, timezone])

    // Дни с событиями для подсветки в календаре
    const eventDates = useMemo(
        () =>
            new Set(
                events.map((event) =>
                    extractDateString(event.start, timezone),
                ),
            ),
        [events, timezone],
    )

    // Отложенное завершение заметок на главной с возможностью отмены
    const {
        isCompleting,
        isSubmitting: isNoteSubmitting,
        isReverting: isNoteReverting,
        handleToggleNote,
        handleCancelCompletion,
    } = useDelayedNoteCompletion({
        onComplete: toggleNote,
        delayMs: 5000,
    })

    // Отложенное завершение дедлайнов на главной с возможностью отмены
    const {
        isCompleting: isDeadlineCompleting,
        isSubmitting: isDeadlineSubmitting,
        handleToggleDeadline,
        handleCancelCompletion: handleCancelDeadlineCompletion,
    } = useDelayedDeadlineCompletion({
        onComplete: toggleDeadline,
        delayMs: 5000,
    })

    // Активные дедлайны для дашборда (невыполненные или находящиеся в процессе завершения)
    const dashboardDeadlines = useMemo(() => {
        return deadlines
            .filter((d) => !d.completed || isDeadlineCompleting(d))
            .slice(0, 5)
    }, [deadlines, isDeadlineCompleting])

    // Общее количество дедлайнов (серий и отдельных задач без разворачивания повторов)
    const totalDeadlinesCount = useMemo(() => {
        if (masterDeadlines.length > 0) {
            return masterDeadlines.filter((m) => !m.cancelledAt).length
        }
        return new Set(deadlines.map((d) => d.id)).size
    }, [masterDeadlines, deadlines])

    // На главной отображаются ТОЛЬКО активные заметки (архивные/завершенные скрыты)
    const activeDashboardNotes = useMemo(() => {
        return notes
            .filter(
                (note) =>
                    note.completedAt === null ||
                    isCompleting(note.id) ||
                    isNoteReverting(note.id),
            )
            .slice(0, 5)
    }, [notes, isCompleting, isNoteReverting])

    const openCreate = (kind: CreateKind) => {
        setQuickMenuOpen(false)
        setEditingEvent(null)
        setEditingDeadline(null)
        setCreating(kind)
    }

    const selectDate = (date: string) => {
        setSelectedDate(date)
        changeVisibleMonth(parseIsoDate(date))
    }

    const goToPrevDay = () => {
        const d = parseIsoDate(selectedDate)
        d.setDate(d.getDate() - 1)
        const newDate = toIsoDate(d)
        setSelectedDate(newDate)
        changeVisibleMonth(parseIsoDate(newDate))
    }

    const goToNextDay = () => {
        const d = parseIsoDate(selectedDate)
        d.setDate(d.getDate() + 1)
        const newDate = toIsoDate(d)
        setSelectedDate(newDate)
        changeVisibleMonth(parseIsoDate(newDate))
    }

    const goToToday = () => {
        setSelectedDate(today)
        changeVisibleMonth(parseIsoDate(today))
    }

    return (
        <div className="page dashboard-page">
            <PageHeader
                eyebrow=""
                title="Главная"
                action={
                    <div
                        className="quick-create"
                        onBlur={(event) => {
                            if (
                                !event.currentTarget.contains(
                                    event.relatedTarget,
                                )
                            )
                                setQuickMenuOpen(false)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') setQuickMenuOpen(false)
                        }}
                    >
                        <button
                            className="button button--primary"
                            type="button"
                            aria-expanded={quickMenuOpen}
                            aria-haspopup="menu"
                            onClick={() => setQuickMenuOpen((open) => !open)}
                        >
                            <Plus size={16} /> Создать
                        </button>
                        {quickMenuOpen && (
                            <div className="quick-create__menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => openCreate('event')}
                                >
                                    <CalendarPlus size={16} /> Событие
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => openCreate('deadline')}
                                >
                                    <Flag size={16} /> Дедлайн
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => openCreate('note')}
                                >
                                    <StickyNote size={16} /> Заметку
                                </button>
                            </div>
                        )}
                    </div>
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

            {!isServerConnected && !error && (
                <div className="offline-notice">
                    <AlertCircle size={16} />
                    <span>
                        Нет связи с сервером Takt (http://localhost:3000).
                        Проверьте статус бэкенда.
                    </span>
                </div>
            )}

            {isLoading && !events.length && !deadlines.length ? (
                <LoadingIndicator message="Загрузка данных календаря и задач..." />
            ) : (
                <div className="dashboard-workspace">
                    {/* Колонка 1: Календарь и Заметки */}
                    <div className="dashboard-col dashboard-col--calendar">
                        <article className="dashboard-card calendar-widget">
                            <div className="dashboard-card__header">
                                <h2>Календарь</h2>
                                <div className="dashboard-card__actions">
                                    <Link
                                        className="text-link"
                                        to={`/calendar?date=${selectedDate}`}
                                    >
                                        Весь месяц
                                    </Link>
                                </div>
                            </div>
                            <MiniCalendar
                                today={today}
                                month={visibleMonth}
                                loading={isCalendarLoading}
                                selected={selectedDate}
                                eventDates={eventDates}
                                onSelect={selectDate}
                                onMonthChange={changeVisibleMonth}
                                onToday={() => selectDate(today)}
                            />
                        </article>

                        <article className="dashboard-card notes-widget">
                            <div className="dashboard-card__header">
                                <div>
                                    <h2>Заметки</h2>
                                    <span className="dashboard-card__subtitle">
                                        Активные на сегодня
                                    </span>
                                </div>
                                <div className="dashboard-card__actions">
                                    <Link className="text-link" to="/notes">
                                        Все ({notes.length})
                                    </Link>
                                    <button
                                        className="icon-button"
                                        type="button"
                                        aria-label="Добавить заметку"
                                        title="Добавить заметку"
                                        onClick={() => openCreate('note')}
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="dashboard-notes">
                                {activeDashboardNotes.map((note) => {
                                    const inProcess = isCompleting(note.id)
                                    const isReverting = isNoteReverting(note.id)
                                    const isSubmitting = isNoteSubmitting(
                                        note.id,
                                    )

                                    return (
                                        <div
                                            key={note.id}
                                            className={`dashboard-note-item${inProcess ? ' is-done is-completing' : ''}${isReverting ? ' is-reverting' : ''}`}
                                            onClick={() => {
                                                if (!isReverting) {
                                                    handleToggleNote(note)
                                                }
                                            }}
                                            title={
                                                isReverting
                                                    ? 'Возвращается в активные...'
                                                    : inProcess
                                                      ? 'Нажмите ещё раз, чтобы отменить'
                                                      : 'Нажмите, чтобы отметить заметку'
                                            }
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === 'Enter' ||
                                                    e.key === ' '
                                                ) {
                                                    e.preventDefault()
                                                    if (!isReverting) {
                                                        handleToggleNote(note)
                                                    }
                                                }
                                            }}
                                        >
                                            <button
                                                type="button"
                                                className="note-check-btn"
                                                disabled={isReverting}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleToggleNote(note)
                                                }}
                                                aria-label={
                                                    isReverting
                                                        ? 'Заметка возвращается в активные'
                                                        : inProcess
                                                          ? 'Отменить завершение заметки'
                                                          : 'Отметить заметку выполненной'
                                                }
                                                title={
                                                    isReverting
                                                        ? 'Возвращается в активные...'
                                                        : inProcess
                                                          ? 'Отменить завершение'
                                                          : 'Отметить выполненной'
                                                }
                                            >
                                                {isSubmitting ? (
                                                    <Loader2
                                                        size={14}
                                                        className="spin-animation"
                                                    />
                                                ) : inProcess ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <span className="note-check-empty" />
                                                )}
                                            </button>
                                            <span className="dashboard-note-text">
                                                {note.text}
                                            </span>
                                            {inProcess && (
                                                <button
                                                    type="button"
                                                    className="note-undo-icon-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCancelCompletion(
                                                            note,
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
                                {!activeDashboardNotes.length && (
                                    <div className="compact-empty">
                                        <p>Нет активных заметок.</p>
                                        <button
                                            className="text-link"
                                            type="button"
                                            onClick={() => openCreate('note')}
                                        >
                                            Добавить заметку
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    </div>

                    {/* Колонка 2: Расписание и Дедлайны */}
                    <div className="dashboard-col dashboard-col--agenda">
                        <article className="dashboard-card schedule-widget">
                            <div className="dashboard-card__header">
                                <div className="dashboard-card__header-left">
                                    <h2 className="dashboard-card__title">
                                        Расписание
                                    </h2>
                                    <span className="dashboard-card__subtitle">
                                        {formatLongDate(selectedDate)}
                                    </span>
                                </div>
                                <div className="dashboard-card__actions">
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
                                        className="icon-button"
                                        type="button"
                                        aria-label="Добавить событие"
                                        title="Добавить событие"
                                        onClick={() => openCreate('event')}
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            {selectedEvents.length ? (
                                <div className="timeline">
                                    {selectedEvents.map((event) => (
                                        <button
                                            className="timeline-event"
                                            type="button"
                                            key={`${event.id}-${event.recurrenceId ?? 'master'}`}
                                            onClick={() =>
                                                setEditingEvent(event)
                                            }
                                        >
                                            <span className="timeline-event__time">
                                                {eventTime(event, timezone)}
                                            </span>
                                            <span className="timeline-event__content">
                                                <strong>{event.title}</strong>
                                                {event.description && (
                                                    <small className="timeline-event__desc">
                                                        {event.description}
                                                    </small>
                                                )}
                                            </span>
                                            {event.recurrenceId && (
                                                <span
                                                    className="timeline-event__badge"
                                                    title="Повторяющееся событие"
                                                >
                                                    <Repeat size={13} />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="compact-empty">
                                    <p>На этот день событий нет.</p>
                                    <button
                                        className="text-link"
                                        type="button"
                                        onClick={() => openCreate('event')}
                                    >
                                        Добавить событие
                                    </button>
                                </div>
                            )}
                        </article>

                        <article className="dashboard-card deadlines-widget">
                            <div className="dashboard-card__header">
                                <div>
                                    <h2>Дедлайны</h2>
                                    <span className="dashboard-card__subtitle">
                                        Ближайшие сроки
                                    </span>
                                </div>
                                <div className="dashboard-card__actions">
                                    <Link
                                        className="text-link"
                                        to="/calendar?section=deadlines"
                                    >
                                        Все ({totalDeadlinesCount})
                                    </Link>
                                    <button
                                        className="icon-button"
                                        type="button"
                                        aria-label="Добавить дедлайн"
                                        title="Добавить дедлайн"
                                        onClick={() => openCreate('deadline')}
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="deadline-list">
                                {dashboardDeadlines.map((deadline) => {
                                    const inProcess =
                                        isDeadlineCompleting(deadline)
                                    const isDone =
                                        deadline.completed || inProcess

                                    return (
                                        <div
                                            className={`deadline${isDone ? ' is-complete' : ''}${inProcess ? ' is-completing' : ''}`}
                                            key={`${deadline.id}-${deadline.recurrenceId ?? 'master'}`}
                                        >
                                            <button
                                                className="deadline__check"
                                                type="button"
                                                disabled={isDeadlineSubmitting(
                                                    deadline,
                                                )}
                                                aria-label={`Отметить «${deadline.title}» выполненным`}
                                                onClick={() => {
                                                    handleToggleDeadline(
                                                        deadline,
                                                    )
                                                }}
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
                                                className="deadline__title"
                                                type="button"
                                                onClick={() => {
                                                    if (!inProcess) {
                                                        setEditingDeadline(
                                                            deadline,
                                                        )
                                                    }
                                                }}
                                            >
                                                <span>{deadline.title}</span>
                                                {deadline.visibility &&
                                                    deadline.visibility.hide ===
                                                        'on_complete' && (
                                                        <span
                                                            className="deadline-badge"
                                                            title="Остается на экране до подтверждения выполнения"
                                                        >
                                                            До выполнения
                                                        </span>
                                                    )}
                                            </button>
                                            <div className="deadline__meta">
                                                <time>
                                                    {formatDeadlineDue(
                                                        deadline.due,
                                                        deadline.dueIsDate,
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
                                        </div>
                                    )
                                })}
                                {!dashboardDeadlines.length && (
                                    <div className="compact-empty">
                                        <p>Нет актуальных дедлайнов.</p>
                                        <button
                                            className="text-link"
                                            type="button"
                                            onClick={() =>
                                                openCreate('deadline')
                                            }
                                        >
                                            Создать дедлайн
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    </div>

                    {/* Колонка 3: Экран устройства Takt */}
                    <div className="dashboard-col dashboard-col--device">
                        <DevicePreviewCard
                            isServerConnected={isServerConnected}
                            screenRevision={screenRevision}
                            onRefresh={refreshScreen}
                        />
                    </div>
                </div>
            )}

            {/* Диалоги создания и редактирования */}
            {(creating === 'event' || editingEvent) && (
                <EventDialog
                    timezone={timezone}
                    event={editingEvent ?? undefined}
                    initialDate={selectedDate}
                    onClose={() => {
                        setCreating(null)
                        setEditingEvent(null)
                    }}
                    onCreate={createEvent}
                    onUpdate={updateEvent}
                    onCancel={cancelEvent}
                    onDelete={deleteEvent}
                />
            )}

            {(creating === 'deadline' || editingDeadline) && (
                <DeadlineDialog
                    timezone={timezone}
                    deadline={editingDeadline ?? undefined}
                    initialDate={selectedDate}
                    onClose={() => {
                        setCreating(null)
                        setEditingDeadline(null)
                    }}
                    onCreate={createDeadline}
                    onUpdate={updateDeadline}
                    onCancel={cancelDeadline}
                    onDelete={deleteDeadline}
                />
            )}

            {creating === 'note' && (
                <NoteDialog
                    onClose={() => setCreating(null)}
                    onSave={async (text) => {
                        await createNote(text)
                    }}
                />
            )}
        </div>
    )
}
