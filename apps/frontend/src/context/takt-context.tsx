import {
    Fragment,
    useCallback,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react'
import { api } from '../api/client'
import { getOccurrenceRange } from '../lib/date'
import type {
    ApplicationSettings,
    CancelDeadlinePayload,
    CancelEventPayload,
    CreateDeadlinePayload,
    CreateEventPayload,
    DeadlineEntity,
    Note,
    ResolvedDeadline,
    ResolvedEvent,
    UpdateDeadlinePayload,
    UpdateEventPayload,
    UpdateNotePayload,
} from '../types/api'
import { TaktContext } from './takt-context-base'
import { useToast } from './use-toast'

export function TaktProvider({ children }: PropsWithChildren) {
    const toast = useToast()
    const [events, setEvents] = useState<ResolvedEvent[]>([])
    const [deadlines, setDeadlines] = useState<ResolvedDeadline[]>([])
    const [masterDeadlines, setMasterDeadlines] = useState<DeadlineEntity[]>([])
    const [notes, setNotes] = useState<Note[]>([])
    const [settings, setSettings] = useState<ApplicationSettings | null>(null)
    const timezoneRef = useRef('UTC')

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isServerConnected, setIsServerConnected] = useState(true)
    const [screenRevision, setScreenRevision] = useState(() => Date.now())

    const refreshScreen = useCallback(() => {
        setScreenRevision((revision) => revision + 1)
    }, [])

    const fetchSettings = useCallback(async () => {
        const data = await api.settings.get()
        timezoneRef.current = data.timezone
        setSettings(data)
        return data
    }, [])

    const fetchNotes = useCallback(async () => {
        try {
            const data = await api.notes.list({ limit: 128, withDone: true })
            setNotes(data)
        } catch (err: unknown) {
            console.error('Failed to load notes:', err)
            throw err
        }
    }, [])

    const fetchEvents = useCallback(async () => {
        try {
            const dateRange = getOccurrenceRange(timezoneRef.current)
            const data = await api.events.listOccurrences({
                from: dateRange.from,
                to: dateRange.to,
                limit: 512,
            })
            setEvents(data)
        } catch (err: unknown) {
            console.error('Failed to load events:', err)
            throw err
        }
    }, [])

    const fetchDeadlines = useCallback(async () => {
        try {
            const dateRange = getOccurrenceRange(timezoneRef.current)
            const [occurrences, masters] = await Promise.all([
                api.deadlines.listOccurrences({
                    from: dateRange.from,
                    limit: 512,
                    withCompleted: true,
                }),
                api.deadlines.list({
                    withCompleted: true,
                    limit: 512,
                }),
            ])
            setDeadlines(occurrences)
            setMasterDeadlines(masters)
        } catch (err: unknown) {
            console.error('Failed to load deadlines:', err)
            throw err
        }
    }, [])

    const refreshAll = useCallback(async () => {
        setIsLoading(true)
        try {
            await fetchSettings()
            await Promise.all([fetchEvents(), fetchDeadlines(), fetchNotes()])
            setIsServerConnected(true)
            setError(null)
        } catch (err: unknown) {
            setIsServerConnected(false)
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось загрузить данные с сервера Takt',
            )
        } finally {
            setIsLoading(false)
        }
    }, [fetchSettings, fetchEvents, fetchDeadlines, fetchNotes])

    // Первоначальная загрузка и подписка на SSE
    useEffect(() => {
        const timer = setTimeout(() => {
            void refreshAll()
        }, 0)

        const unsubscribe = api.screens.subscribe(
            () => {
                setScreenRevision((revision) => revision + 1)
                // При получении изменения экрана обновляем данные
                void fetchSettings()
                    .then(() =>
                        Promise.all([
                            fetchEvents(),
                            fetchDeadlines(),
                            fetchNotes(),
                        ]),
                    )
                    .catch((err) =>
                        console.warn('SSE auto-refresh failed:', err),
                    )
            },
            () => {
                // При ошибке соединения с SSE не паникуем, сервер может быть перезапущен
            },
        )

        return () => {
            clearTimeout(timer)
            unsubscribe()
        }
    }, [refreshAll, fetchSettings, fetchEvents, fetchDeadlines, fetchNotes])

    const clearError = useCallback(() => setError(null), [])

    // --- Мутации событий ---
    const createEvent = useCallback(
        async (payload: CreateEventPayload) => {
            try {
                await api.events.create(payload)
                toast.success('Событие добавлено')
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при создании события'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchEvents, toast],
    )

    const updateEvent = useCallback(
        async (id: number, payload: UpdateEventPayload) => {
            try {
                await api.events.update(id, payload)
                toast.success('Событие сохранено')
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при обновлении события'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchEvents, toast],
    )

    const cancelEvent = useCallback(
        async (id: number, payload: CancelEventPayload) => {
            try {
                await api.events.cancel(id, payload)
                toast.success('Событие отменено')
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при отмене события'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchEvents, toast],
    )

    const deleteEvent = useCallback(
        async (id: number) => {
            try {
                await api.events.delete(id)
                toast.success('Событие удалено')
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при удалении события'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchEvents, toast],
    )

    // --- Мутации дедлайнов ---
    const createDeadline = useCallback(
        async (payload: CreateDeadlinePayload) => {
            try {
                await api.deadlines.create(payload)
                toast.success('Дедлайн добавлен')
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при создании дедлайна'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchDeadlines, toast],
    )

    const updateDeadline = useCallback(
        async (id: number, payload: UpdateDeadlinePayload) => {
            try {
                await api.deadlines.update(id, payload)
                toast.success('Дедлайн обновлен')
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при обновлении дедлайна'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchDeadlines, toast],
    )

    const toggleDeadline = useCallback(
        async (deadline: ResolvedDeadline) => {
            const nextCompleted = !deadline.completed
            const nowIso = new Date().toISOString()

            // Оптимистичное обновление дедлайнов в интерфейсе
            setDeadlines((prev) =>
                prev.map((d) =>
                    d.id === deadline.id &&
                    d.recurrenceId === deadline.recurrenceId
                        ? {
                              ...d,
                              completed: nextCompleted,
                              completedAt: nextCompleted ? nowIso : null,
                          }
                        : d,
                ),
            )
            setMasterDeadlines((prev) =>
                prev.map((m) => {
                    if (m.id !== deadline.id) return m
                    if (!m.recurrence) {
                        return {
                            ...m,
                            completedAt: nextCompleted ? nowIso : null,
                        }
                    }
                    const completions = (m.completions || []).filter(
                        (c) => c.recurrenceId !== deadline.recurrenceId,
                    )
                    if (nextCompleted && deadline.recurrenceId) {
                        completions.push({
                            recurrenceId: deadline.recurrenceId,
                            completedAt: nowIso,
                        })
                    }
                    return { ...m, completions }
                }),
            )
            try {
                await api.deadlines.setCompletion(deadline.id, {
                    recurrenceId: deadline.recurrenceId ?? undefined,
                    completed: nextCompleted,
                })
                await fetchDeadlines()
                toast.success(
                    nextCompleted
                        ? 'Дедлайн выполнен'
                        : 'Дедлайн возвращен в активные',
                )
            } catch (err: unknown) {
                await fetchDeadlines()
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при изменении статуса дедлайна'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchDeadlines, toast],
    )

    const cancelDeadline = useCallback(
        async (id: number, payload: CancelDeadlinePayload) => {
            try {
                await api.deadlines.cancel(id, payload)
                toast.success('Дедлайн отменен')
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при отмене дедлайна'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchDeadlines, toast],
    )

    const deleteDeadline = useCallback(
        async (id: number) => {
            try {
                await api.deadlines.delete(id)
                toast.success('Дедлайн удален')
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при удалении дедлайна'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchDeadlines, toast],
    )

    // --- Мутации заметок ---
    const createNote = useCallback(
        async (text: string) => {
            try {
                await api.notes.create({ text })
                toast.success('Заметка добавлена')
                await fetchNotes()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при создании заметки'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchNotes, toast],
    )

    const updateNote = useCallback(
        async (id: number, payload: UpdateNotePayload) => {
            try {
                await api.notes.update(id, payload)
                toast.success('Заметка обновлена')
                await fetchNotes()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при обновлении заметки'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchNotes, toast],
    )

    const toggleNote = useCallback(
        async (note: Note) => {
            const isCompleted = note.completedAt !== null
            const nextCompletedAt = isCompleted
                ? null
                : new Date().toISOString()

            // Оптимистичное обновление заметок
            setNotes((prev) =>
                prev.map((n) =>
                    n.id === note.id
                        ? { ...n, completedAt: nextCompletedAt }
                        : n,
                ),
            )
            try {
                if (isCompleted) {
                    await api.notes.markUndone(note.id)
                } else {
                    await api.notes.markDone(note.id)
                }
                await fetchNotes()
                toast.success(
                    isCompleted ? 'Заметка возвращена' : 'Заметка выполнена',
                )
            } catch (err: unknown) {
                await fetchNotes()
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при изменении статуса заметки'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchNotes, toast],
    )

    const deleteNote = useCallback(
        async (id: number) => {
            setNotes((prev) =>
                prev.map((n) =>
                    n.id === id
                        ? { ...n, completedAt: new Date().toISOString() }
                        : n,
                ),
            )
            toast.success('Заметка завершена')

            try {
                await api.notes.markDone(id)
                await fetchNotes()
            } catch (err: unknown) {
                await fetchNotes()
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при завершении заметки'
                setError(message)
                toast.error(message)
                throw err
            }
        },
        [fetchNotes, toast],
    )

    if (settings === null) {
        return error === null ? null : <div role="alert">{error}</div>
    }

    return (
        <TaktContext.Provider
            value={{
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
                refreshEvents: fetchEvents,
                refreshDeadlines: fetchDeadlines,
                refreshNotes: fetchNotes,
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
                updateNote,
                toggleNote,
                deleteNote,
            }}
        >
            <Fragment key={settings.timezone}>{children}</Fragment>
        </TaktContext.Provider>
    )
}
