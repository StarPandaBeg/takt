import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Info,
    Loader2,
    Pencil,
    Plus,
    Undo2,
    X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { api } from '../api/client'
import { ErrorBanner } from '../components/common/error-banner'
import { NoteDialog } from '../components/notes/note-dialog'
import { PageHeader } from '../components/page-header'
import { useDelayedNoteCompletion } from '../hooks/use-delayed-note-completion'
import type { Note } from '../types/api'
import { useTakt } from '../use-app'

type NoteFilter = 'active' | 'completed' | 'all'
const PAGE_SIZE = 15

export function NotesPage() {
    const { createNote, updateNote, toggleNote } = useTakt()
    const queryClient = useQueryClient()

    const [page, setPage] = useState(1)
    const [filter, setFilter] = useState<NoteFilter>('active')
    const [newNoteText, setNewNoteText] = useState('')
    const [editingNote, setEditingNote] = useState<Note | null>(null)
    const [inlineEditingId, setInlineEditingId] = useState<number | null>(null)
    const [inlineEditText, setInlineEditText] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [dismissedError, setDismissedError] = useState(false)

    // Параметры для текущего фильтра и страницы
    const queryParams = useMemo(
        () => ({
            page,
            limit: PAGE_SIZE,
            withDone: filter === 'all',
            onlyDone: filter === 'completed',
        }),
        [page, filter],
    )

    // Запрос страницы заметок через React Query
    const {
        data: pageData,
        isLoading,
        error: queryError,
        refetch: refetchNotes,
    } = useQuery({
        queryKey: ['notes', queryParams],
        queryFn: () => api.notes.listWithPagination(queryParams),
        staleTime: 30 * 1000,
    })

    // Запросы счётчиков для кнопок фильтров
    const { data: countActive } = useQuery({
        queryKey: ['notes-count', 'active'],
        queryFn: () =>
            api.notes.listWithPagination({ limit: 1, withDone: false }),
        staleTime: 30 * 1000,
    })
    const { data: countCompleted } = useQuery({
        queryKey: ['notes-count', 'completed'],
        queryFn: () =>
            api.notes.listWithPagination({ limit: 1, onlyDone: true }),
        staleTime: 30 * 1000,
    })
    const { data: countAll } = useQuery({
        queryKey: ['notes-count', 'all'],
        queryFn: () =>
            api.notes.listWithPagination({ limit: 1, withDone: true }),
        staleTime: 30 * 1000,
    })

    const totalCount = pageData?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    // Префетчинг соседних страниц (одна страница вперед, одна назад)
    useEffect(() => {
        if (page < totalPages) {
            void queryClient.prefetchQuery({
                queryKey: ['notes', { ...queryParams, page: page + 1 }],
                queryFn: () =>
                    api.notes.listWithPagination({
                        ...queryParams,
                        page: page + 1,
                    }),
                staleTime: 30 * 1000,
            })
        }
        if (page > 1) {
            void queryClient.prefetchQuery({
                queryKey: ['notes', { ...queryParams, page: page - 1 }],
                queryFn: () =>
                    api.notes.listWithPagination({
                        ...queryParams,
                        page: page - 1,
                    }),
                staleTime: 30 * 1000,
            })
        }
    }, [page, totalPages, queryParams, queryClient])

    const handleFilterChange = (nextFilter: NoteFilter) => {
        setFilter(nextFilter)
        setPage(1)
    }

    const notes = useMemo(() => pageData?.notes ?? [], [pageData?.notes])

    // Мгновенное сохранение с коротким окном для отмены
    const {
        isCompleting,
        isSubmitting,
        isReverting,
        handleToggleNote,
        handleCancelCompletion,
    } = useDelayedNoteCompletion({
        onComplete: toggleNote,
        delayMs: 5000,
    })

    const filteredNotes = useMemo(() => {
        return notes.filter((note) => {
            if (filter === 'active') {
                return (
                    note.completedAt === null ||
                    isCompleting(note.id) ||
                    isReverting(note.id)
                )
            }
            if (filter === 'completed') {
                return (
                    note.completedAt !== null &&
                    !isCompleting(note.id) &&
                    !isReverting(note.id)
                )
            }
            return true
        })
    }, [notes, filter, isCompleting, isReverting])

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault()
        const text = newNoteText.trim()
        if (!text) return

        setSubmitting(true)
        try {
            await createNote(text)
            setNewNoteText('')
            setPage(1)
        } finally {
            setSubmitting(false)
        }
    }

    const startInlineEditing = (note: Note) => {
        setInlineEditingId(note.id)
        setInlineEditText(note.text)
    }

    const saveInlineEditing = async () => {
        if (!inlineEditingId || !inlineEditText.trim()) {
            setInlineEditingId(null)
            return
        }

        setSubmitting(true)
        try {
            await updateNote(inlineEditingId, {
                text: inlineEditText.trim(),
            })
            setInlineEditingId(null)
            setInlineEditText('')
        } finally {
            setSubmitting(false)
        }
    }

    const errorMessage =
        !dismissedError && queryError instanceof Error
            ? queryError.message
            : null

    return (
        <div className="page notes-page">
            <PageHeader eyebrow="" title="Заметки" />

            {errorMessage && (
                <ErrorBanner
                    message={errorMessage}
                    onRetry={() => {
                        void refetchNotes()
                    }}
                    onDismiss={() => setDismissedError(true)}
                />
            )}

            <section className="notes-simple">
                <form
                    className="quick-note"
                    onSubmit={(e) => {
                        void handleCreate(e)
                    }}
                >
                    <input
                        value={newNoteText}
                        maxLength={256}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Добавить короткую заметку (до 256 символов)"
                        aria-label="Текст новой заметки"
                        disabled={submitting}
                    />
                    <button
                        className="button button--primary"
                        type="submit"
                        disabled={submitting || !newNoteText.trim()}
                    >
                        <Plus size={16} /> Добавить
                    </button>
                </form>

                <div className="notes-toolbar">
                    <div
                        className="deadline-filters"
                        role="group"
                        aria-label="Фильтр заметок"
                    >
                        {(['active', 'completed', 'all'] as const).map(
                            (mode) => {
                                const count =
                                    mode === 'active'
                                        ? (countActive?.total ?? 0)
                                        : mode === 'completed'
                                          ? (countCompleted?.total ?? 0)
                                          : (countAll?.total ?? 0)
                                return (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={
                                            filter === mode ? 'is-active' : ''
                                        }
                                        onClick={() => handleFilterChange(mode)}
                                    >
                                        {mode === 'active'
                                            ? `Активные (${count})`
                                            : mode === 'completed'
                                              ? `Выполненные (${count})`
                                              : `Все (${count})`}
                                    </button>
                                )
                            },
                        )}
                    </div>

                    <div className="notes-info-hint">
                        <Info size={14} />
                        <span>
                            Выполненные заметки переносятся в архив и скрываются
                            с экрана устройства.
                        </span>
                    </div>
                </div>

                <div className="simple-note-list">
                    {isLoading ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                padding: '32px 0',
                                color: 'var(--muted)',
                            }}
                        >
                            <Loader2
                                size={18}
                                className="spin-animation"
                                aria-label="Загрузка заметок"
                            />
                            <span>Загрузка заметок…</span>
                        </div>
                    ) : (
                        filteredNotes.map((note) => {
                            const inProcess = isCompleting(note.id)
                            const reverting = isReverting(note.id)
                            const submitting = isSubmitting(note.id)
                            const isDone =
                                !reverting &&
                                (note.completedAt !== null || inProcess)
                            const isInlineEditing = inlineEditingId === note.id

                            return (
                                <div
                                    className={`simple-note ${isDone ? 'is-done' : ''} ${inProcess ? 'is-completing' : ''} ${reverting ? 'is-reverting' : ''}`}
                                    key={note.id}
                                >
                                    {isInlineEditing ? (
                                        <>
                                            <input
                                                autoFocus
                                                value={inlineEditText}
                                                maxLength={256}
                                                onChange={(e) =>
                                                    setInlineEditText(
                                                        e.target.value,
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter')
                                                        void saveInlineEditing()
                                                    if (e.key === 'Escape')
                                                        setInlineEditingId(null)
                                                }}
                                                aria-label="Текст заметки"
                                                disabled={submitting}
                                            />
                                            <div className="simple-note__actions">
                                                <button
                                                    className="icon-button icon-button--ink"
                                                    type="button"
                                                    onClick={() =>
                                                        void saveInlineEditing()
                                                    }
                                                    aria-label="Сохранить"
                                                    disabled={submitting}
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    className="icon-button"
                                                    type="button"
                                                    onClick={() =>
                                                        setInlineEditingId(null)
                                                    }
                                                    aria-label="Отмена"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className="note-status-toggle"
                                                disabled={reverting}
                                                onClick={() => {
                                                    handleToggleNote(note)
                                                }}
                                                title={
                                                    reverting
                                                        ? 'Возвращается в активные...'
                                                        : inProcess
                                                          ? 'Отменить завершение'
                                                          : isDone
                                                            ? 'Вернуть в активные'
                                                            : 'Отметить выполненной'
                                                }
                                                aria-label={
                                                    reverting
                                                        ? 'Заметка возвращается в активные'
                                                        : inProcess
                                                          ? 'Отменить завершение заметки'
                                                          : 'Переключить статус заметки'
                                                }
                                            >
                                                {submitting ? (
                                                    <Loader2
                                                        size={18}
                                                        className="spin-animation"
                                                    />
                                                ) : isDone ? (
                                                    <CheckCircle2 size={18} />
                                                ) : (
                                                    <span className="note-status-empty" />
                                                )}
                                            </button>

                                            <span className="simple-note__text">
                                                {note.text}
                                            </span>

                                            <div className="simple-note__actions">
                                                {inProcess ? (
                                                    <button
                                                        type="button"
                                                        className="note-undo-button"
                                                        onClick={() => {
                                                            handleCancelCompletion(
                                                                note,
                                                            )
                                                        }}
                                                        title="Отменить завершение"
                                                    >
                                                        <Undo2 size={13} />
                                                        <span>Отменить</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="icon-button"
                                                        type="button"
                                                        onClick={() =>
                                                            startInlineEditing(
                                                                note,
                                                            )
                                                        }
                                                        aria-label="Редактировать заметку"
                                                        title="Редактировать текст"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })
                    )}

                    {!isLoading && !filteredNotes.length && (
                        <p className="simple-note-list__empty">
                            {filter === 'active'
                                ? 'Активных заметок нет.'
                                : filter === 'completed'
                                  ? 'Выполненных заметок пока нет.'
                                  : 'Заметок пока нет.'}
                        </p>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="notes-pagination">
                        <div className="notes-pagination__info">
                            Страница {page} из {totalPages} ({totalCount}{' '}
                            {totalCount === 1 ? 'заметка' : 'заметок'})
                        </div>
                        <div className="notes-pagination__controls">
                            <button
                                className="notes-pagination__button"
                                type="button"
                                disabled={page <= 1}
                                onClick={() =>
                                    setPage((p) => Math.max(1, p - 1))
                                }
                                aria-label="Предыдущая страница"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(
                                    (p) =>
                                        p === 1 ||
                                        p === totalPages ||
                                        Math.abs(p - page) <= 1,
                                )
                                .map((p, idx, arr) => {
                                    const prevVal = arr[idx - 1]
                                    const showEllipsis =
                                        prevVal !== undefined && p - prevVal > 1
                                    return (
                                        <span
                                            key={p}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            {showEllipsis && (
                                                <span
                                                    style={{
                                                        padding: '0 4px',
                                                        color: 'var(--muted)',
                                                    }}
                                                >
                                                    …
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                className={`notes-pagination__button ${p === page ? 'is-active' : ''}`}
                                                onClick={() => setPage(p)}
                                            >
                                                {p}
                                            </button>
                                        </span>
                                    )
                                })}
                            <button
                                className="notes-pagination__button"
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() =>
                                    setPage((p) => Math.min(totalPages, p + 1))
                                }
                                aria-label="Следующая страница"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {editingNote && (
                <NoteDialog
                    note={editingNote}
                    onClose={() => setEditingNote(null)}
                    onSave={async (text) => {
                        await updateNote(editingNote.id, { text })
                    }}
                    onToggleDone={toggleNote}
                />
            )}
        </div>
    )
}
