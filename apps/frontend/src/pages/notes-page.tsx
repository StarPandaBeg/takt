import {
    Check,
    CheckCircle2,
    Info,
    Loader2,
    Pencil,
    Plus,
    Undo2,
    X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { ErrorBanner } from '../components/common/error-banner'
import { NoteDialog } from '../components/notes/note-dialog'
import { PageHeader } from '../components/page-header'
import { useDelayedNoteCompletion } from '../hooks/use-delayed-note-completion'
import type { Note } from '../types/api'
import { useTakt } from '../use-app'

type NoteFilter = 'active' | 'completed' | 'all'

export function NotesPage() {
    const {
        notes,
        error,
        refreshNotes,
        clearError,
        createNote,
        updateNote,
        toggleNote,
    } = useTakt()

    const [newNoteText, setNewNoteText] = useState('')
    const [filter, setFilter] = useState<NoteFilter>('active')
    const [editingNote, setEditingNote] = useState<Note | null>(null)
    const [inlineEditingId, setInlineEditingId] = useState<number | null>(null)
    const [inlineEditText, setInlineEditText] = useState('')
    const [submitting, setSubmitting] = useState(false)

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
            // Keep the just-completed note in place while undo is available.
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

    return (
        <div className="page notes-page">
            <PageHeader eyebrow="" title="Заметки" />

            {error && (
                <ErrorBanner
                    message={error}
                    onRetry={() => {
                        void refreshNotes()
                    }}
                    onDismiss={clearError}
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
                            (mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    className={
                                        filter === mode ? 'is-active' : ''
                                    }
                                    onClick={() => setFilter(mode)}
                                >
                                    {mode === 'active'
                                        ? `Активные (${notes.filter((n) => !n.completedAt).length})`
                                        : mode === 'completed'
                                          ? `Выполненные (${notes.filter((n) => n.completedAt).length})`
                                          : `Все (${notes.length})`}
                                </button>
                            ),
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
                    {filteredNotes.map((note) => {
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
                                                        startInlineEditing(note)
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
                    })}

                    {!filteredNotes.length && (
                        <p className="simple-note-list__empty">
                            {filter === 'active'
                                ? 'Активных заметок нет.'
                                : filter === 'completed'
                                  ? 'Выполненных заметок пока нет.'
                                  : 'Заметок пока нет.'}
                        </p>
                    )}
                </div>
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
