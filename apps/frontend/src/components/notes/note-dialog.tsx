import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Note } from '../../types/api'
import { Modal } from '../common/modal'

interface NoteDialogProps {
    note?: Note
    onClose: () => void
    onSave: (text: string) => Promise<void>
    onToggleDone?: (note: Note) => Promise<void>
}

export function NoteDialog({
    note,
    onClose,
    onSave,
    onToggleDone,
}: NoteDialogProps) {
    const isEdit = Boolean(note)
    const [text, setText] = useState(note?.text ?? '')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const trimmed = text.trim()
        if (!trimmed) {
            setError('Введите текст заметки')
            return
        }
        if (trimmed.length > 256) {
            setError('Длина заметки не может превышать 256 символов')
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            await onSave(trimmed)
            onClose()
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось сохранить заметку',
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggle = async () => {
        if (!note || !onToggleDone) return
        setSubmitting(true)
        try {
            await onToggleDone(note)
            onClose()
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось изменить статус заметки',
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            title={isEdit ? 'Редактировать заметку' : 'Новая заметка'}
            onClose={onClose}
        >
            <form
                className="form"
                onSubmit={(e) => {
                    void handleSubmit(e)
                }}
            >
                {error && (
                    <div className="form-error-text field--wide">{error}</div>
                )}

                <label className="field field--wide">
                    <span>Текст (до 256 символов)</span>
                    <textarea
                        autoFocus
                        required
                        rows={3}
                        maxLength={256}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Короткая заметка или мысль"
                    />
                    <div className="field-hint">
                        {text.length} / 256 символов
                    </div>
                </label>

                <div className="form__actions field--wide">
                    {isEdit && onToggleDone && (
                        <button
                            className="button button--quiet"
                            type="button"
                            onClick={() => {
                                void handleToggle()
                            }}
                            disabled={submitting}
                        >
                            {note?.completedAt ? (
                                <>
                                    <RotateCcw size={16} /> Вернуть в активные
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} /> Отметить
                                    выполненной
                                </>
                            )}
                        </button>
                    )}
                    <span />
                    <button
                        className="button button--quiet"
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Отмена
                    </button>
                    <button
                        className="button button--primary"
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting
                            ? 'Сохранение...'
                            : isEdit
                              ? 'Сохранить'
                              : 'Добавить'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
