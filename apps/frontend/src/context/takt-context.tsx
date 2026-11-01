import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react'
import { api } from '../api/client'
import type {
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

export function TaktProvider({ children }: PropsWithChildren) {
    const [events, setEvents] = useState<ResolvedEvent[]>([])
    const [deadlines, setDeadlines] = useState<ResolvedDeadline[]>([])
    const [masterDeadlines, setMasterDeadlines] = useState<DeadlineEntity[]>([])
    const [notes, setNotes] = useState<Note[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isServerConnected, setIsServerConnected] = useState(true)
    const [screenRevision, setScreenRevision] = useState(() => Date.now())

    const refreshScreen = useCallback(() => {
        setScreenRevision(Date.now())
    }, [])

    // Диапазон дат для occurrences (по умолчанию текущий год +/- 1 год)
    const dateRange = useRef({
        from: '2026-01-01T00:00:00.000Z',
        to: '2027-01-01T00:00:00.000Z',
    })

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
            const data = await api.events.listOccurrences({
                from: dateRange.current.from,
                to: dateRange.current.to,
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
            const [occurrences, masters] = await Promise.all([
                api.deadlines.listOccurrences({
                    from: dateRange.current.from,
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
    }, [fetchEvents, fetchDeadlines, fetchNotes])

    // Первоначальная загрузка и подписка на SSE
    useEffect(() => {
        const timer = setTimeout(() => {
            void refreshAll()
        }, 0)

        const unsubscribe = api.screens.subscribe(
            () => {
                setScreenRevision(Date.now())
                // При получении изменения экрана обновляем данные
                void Promise.all([
                    fetchEvents(),
                    fetchDeadlines(),
                    fetchNotes(),
                ]).catch((err) => console.warn('SSE auto-refresh failed:', err))
            },
            () => {
                // При ошибке соединения с SSE не паникуем, сервер может быть перезапущен
            },
        )

        return () => {
            clearTimeout(timer)
            unsubscribe()
        }
    }, [refreshAll, fetchEvents, fetchDeadlines, fetchNotes])

    const clearError = useCallback(() => setError(null), [])

    // --- Мутации событий ---
    const createEvent = useCallback(
        async (payload: CreateEventPayload) => {
            try {
                await api.events.create(payload)
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при создании события'
                setError(message)
                throw err
            }
        },
        [fetchEvents],
    )

    const updateEvent = useCallback(
        async (id: number, payload: UpdateEventPayload) => {
            try {
                await api.events.update(id, payload)
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при обновлении события'
                setError(message)
                throw err
            }
        },
        [fetchEvents],
    )

    const cancelEvent = useCallback(
        async (id: number, payload: CancelEventPayload) => {
            try {
                await api.events.cancel(id, payload)
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при отмене события'
                setError(message)
                throw err
            }
        },
        [fetchEvents],
    )

    const deleteEvent = useCallback(
        async (id: number) => {
            try {
                await api.events.delete(id)
                await fetchEvents()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при удалении события'
                setError(message)
                throw err
            }
        },
        [fetchEvents],
    )

    // --- Мутации дедлайнов ---
    const createDeadline = useCallback(
        async (payload: CreateDeadlinePayload) => {
            try {
                await api.deadlines.create(payload)
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при создании дедлайна'
                setError(message)
                throw err
            }
        },
        [fetchDeadlines],
    )

    const updateDeadline = useCallback(
        async (id: number, payload: UpdateDeadlinePayload) => {
            try {
                await api.deadlines.update(id, payload)
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при обновлении дедлайна'
                setError(message)
                throw err
            }
        },
        [fetchDeadlines],
    )

    const toggleDeadline = useCallback(
        async (deadline: ResolvedDeadline) => {
            try {
                const nextCompleted = !deadline.completed
                await api.deadlines.setCompletion(deadline.id, {
                    recurrenceId: deadline.recurrenceId ?? undefined,
                    completed: nextCompleted,
                })
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при изменении статуса дедлайна'
                setError(message)
                throw err
            }
        },
        [fetchDeadlines],
    )

    const cancelDeadline = useCallback(
        async (id: number, payload: CancelDeadlinePayload) => {
            try {
                await api.deadlines.cancel(id, payload)
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при отмене дедлайна'
                setError(message)
                throw err
            }
        },
        [fetchDeadlines],
    )

    const deleteDeadline = useCallback(
        async (id: number) => {
            try {
                await api.deadlines.delete(id)
                await fetchDeadlines()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при удалении дедлайна'
                setError(message)
                throw err
            }
        },
        [fetchDeadlines],
    )

    // --- Мутации заметок ---
    const createNote = useCallback(
        async (text: string) => {
            try {
                await api.notes.create({ text })
                await fetchNotes()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при создании заметки'
                setError(message)
                throw err
            }
        },
        [fetchNotes],
    )

    const updateNote = useCallback(
        async (id: number, payload: UpdateNotePayload) => {
            try {
                await api.notes.update(id, payload)
                await fetchNotes()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при обновлении заметки'
                setError(message)
                throw err
            }
        },
        [fetchNotes],
    )

    const toggleNote = useCallback(
        async (note: Note) => {
            try {
                if (note.completedAt !== null) {
                    await api.notes.markUndone(note.id)
                } else {
                    await api.notes.markDone(note.id)
                }
                await fetchNotes()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при изменении статуса заметки'
                setError(message)
                throw err
            }
        },
        [fetchNotes],
    )

    const deleteNote = useCallback(
        async (id: number) => {
            try {
                // По API.md в notes нет DELETE эндпоинта: заметки помечаются как выполненные (markDone)
                await api.notes.markDone(id)
                await fetchNotes()
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Ошибка при завершении заметки'
                setError(message)
                throw err
            }
        },
        [fetchNotes],
    )

    return (
        <TaktContext.Provider
            value={{
                events,
                deadlines,
                masterDeadlines,
                notes,
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
            {children}
        </TaktContext.Provider>
    )
}
