import { Trash2, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
    buildIsoDateTime,
    extractDateString,
    extractTimeString,
} from '../../lib/date'
import type {
    CancelEventPayload,
    CreateEventPayload,
    Recurrence,
    ResolvedEvent,
    UpdateEventPayload,
    UpdateScope,
} from '../../types/api'
import { ConfirmDialog } from '../common/confirm-dialog'
import { Modal } from '../common/modal'
import { RecurrenceEditor } from '../common/recurrence-editor'
import { ScopeModal } from '../common/scope-modal'

interface EventDialogProps {
    timezone: string
    event?: ResolvedEvent
    initialDate: string // YYYY-MM-DD
    initialStart?: string // HH:mm
    initialEnd?: string // HH:mm
    initialAllDay?: boolean
    onClose: () => void
    onCreate: (payload: CreateEventPayload) => Promise<void>
    onUpdate: (id: number, payload: UpdateEventPayload) => Promise<void>
    onCancel: (id: number, payload: CancelEventPayload) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

export function EventDialog({
    timezone,
    event,
    initialDate,
    initialStart,
    initialEnd,
    initialAllDay,
    onClose,
    onCreate,
    onUpdate,
    onCancel,
    onDelete,
}: EventDialogProps) {
    const isEdit = Boolean(event)
    const isRecurringInstance = Boolean(event?.recurrenceId)

    const [title, setTitle] = useState(event?.title ?? '')
    const [description, setDescription] = useState(event?.description ?? '')
    const [date, setDate] = useState(() =>
        event ? extractDateString(event.start, timezone) : initialDate,
    )
    const [allDay, setAllDay] = useState(
        event?.allDay ?? initialAllDay ?? false,
    )
    const [start, setStart] = useState(() =>
        event
            ? extractTimeString(event.start, timezone)
            : (initialStart ?? '10:00'),
    )
    const [end, setEnd] = useState(() =>
        event && event.end
            ? extractTimeString(event.end, timezone)
            : (initialEnd ?? ''),
    )
    const [recurrence, setRecurrence] = useState<Recurrence | null>(null)

    // Вторичные диалоги выбора scope и подтверждения действий
    const [showSaveScopeModal, setShowSaveScopeModal] = useState(false)
    const [showCancelScopeModal, setShowCancelScopeModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const validateForm = (): {
        startIso: string
        endIso: string | null
    } | null => {
        if (!title.trim()) {
            setFormError('Укажите название события')
            return null
        }

        const startIso = buildIsoDateTime(date, start, allDay, timezone)
        const endIso =
            !allDay && end
                ? buildIsoDateTime(date, end, false, timezone)
                : null

        if (endIso && endIso < startIso) {
            setFormError('Время окончания не может быть раньше времени начала')
            return null
        }

        setFormError(null)
        return { startIso, endIso }
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const validated = validateForm()
        if (!validated) return

        // Если это повторяющееся событие — спрашиваем scope во второй модалке
        if (isEdit && isRecurringInstance) {
            setShowSaveScopeModal(true)
            return
        }

        // Обычное событие сохраняем сразу
        void executeSave('series')
    }

    const executeSave = async (chosenScope: UpdateScope) => {
        const validated = validateForm()
        if (!validated) return

        setSubmitting(true)
        setFormError(null)

        try {
            if (!event) {
                // Создание нового события
                const payload: CreateEventPayload = {
                    title: title.trim(),
                    description: description.trim() || null,
                    start: validated.startIso,
                    end: validated.endIso,
                    timezone: timezone || null,
                    allDay,
                    recurrence: recurrence ?? undefined,
                }
                await onCreate(payload)
            } else {
                // Обновление существующего события
                const updatePayload: UpdateEventPayload = {
                    scope: isRecurringInstance ? chosenScope : 'series',
                    recurrenceId:
                        isRecurringInstance && chosenScope !== 'series'
                            ? (event.recurrenceId ?? undefined)
                            : undefined,
                    changes: {
                        title: title.trim(),
                        description: description.trim() || null,
                        start: validated.startIso,
                        end: validated.endIso,
                        timezone: timezone || null,
                        allDay,
                        ...(chosenScope !== 'occurrence' ? { recurrence } : {}),
                    },
                }
                await onUpdate(event.id, updatePayload)
            }
            setShowSaveScopeModal(false)
            onClose()
        } catch (err: unknown) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось сохранить событие',
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleSoftCancel = async (chosenScope: UpdateScope) => {
        if (!event) return
        setSubmitting(true)
        try {
            await onCancel(event.id, {
                scope: isRecurringInstance ? chosenScope : 'series',
                recurrenceId:
                    isRecurringInstance && chosenScope !== 'series'
                        ? (event.recurrenceId ?? undefined)
                        : undefined,
            })
            setShowCancelScopeModal(false)
            setShowCancelConfirm(false)
            onClose()
        } catch (err: unknown) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось отменить событие',
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleHardDelete = async () => {
        if (!event) return
        setSubmitting(true)
        try {
            await onDelete(event.id)
            setShowDeleteConfirm(false)
            onClose()
        } catch (err: unknown) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось удалить событие',
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Modal
                title={isEdit ? 'Редактировать событие' : 'Новое событие'}
                onClose={onClose}
            >
                <form
                    className="form"
                    onSubmit={(e) => {
                        handleSubmit(e)
                    }}
                >
                    {formError && (
                        <div className="form-error-text field--wide">
                            {formError}
                        </div>
                    )}

                    {/* Секция 1: Основная информация */}
                    <div className="dialog-section field--wide">
                        <h4 className="dialog-section__title">
                            Основная информация
                        </h4>
                        <label className="field field--wide">
                            <span>Название</span>
                            <input
                                autoFocus
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Например, встреча с командой"
                            />
                        </label>

                        <label className="field field--wide">
                            <span>
                                Описание <i>необязательно</i>
                            </span>
                            <textarea
                                rows={2}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Заметки или детали встречи"
                            />
                        </label>
                    </div>

                    {/* Секция 2: Время проведения */}
                    <div className="dialog-section field--wide">
                        <h4 className="dialog-section__title">
                            Время проведения
                        </h4>

                        <label className="check-field">
                            <input
                                type="checkbox"
                                checked={allDay}
                                onChange={(e) => setAllDay(e.target.checked)}
                            />
                            <span>Весь день</span>
                        </label>

                        {!allDay ? (
                            <div className="form-row-datetime">
                                <label className="field">
                                    <span>Дата</span>
                                    <input
                                        type="date"
                                        required
                                        value={date}
                                        onChange={(e) =>
                                            setDate(e.target.value)
                                        }
                                    />
                                </label>
                                <label className="field">
                                    <span>Начало</span>
                                    <input
                                        type="time"
                                        required
                                        value={start}
                                        onChange={(e) =>
                                            setStart(e.target.value)
                                        }
                                    />
                                </label>
                                <label className="field">
                                    <span>
                                        Конец <i>необяз.</i>
                                    </span>
                                    <input
                                        type="time"
                                        value={end}
                                        onChange={(e) => setEnd(e.target.value)}
                                    />
                                </label>
                            </div>
                        ) : (
                            <label className="field">
                                <span>Дата</span>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </label>
                        )}
                    </div>

                    {/* Секция 3: Повторение */}
                    {(!isEdit || !isRecurringInstance) && (
                        <div className="dialog-section field--wide">
                            <h4 className="dialog-section__title">
                                Регулярность
                            </h4>
                            <RecurrenceEditor
                                value={recurrence}
                                onChange={setRecurrence}
                                defaultDateStr={date}
                            />
                        </div>
                    )}

                    <div className="form__actions field--wide">
                        {isEdit && (
                            <div className="form__danger-actions">
                                <button
                                    className="button button--quiet button--danger"
                                    type="button"
                                    onClick={() => {
                                        if (isRecurringInstance) {
                                            setShowCancelScopeModal(true)
                                        } else {
                                            setShowCancelConfirm(true)
                                        }
                                    }}
                                    title="Мягкая отмена (рекомендуется)"
                                >
                                    <XCircle size={15} /> Отменить
                                </button>
                                <button
                                    className="button button--quiet button--danger"
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    title="Полное удаление из базы данных"
                                >
                                    <Trash2 size={15} /> Удалить
                                </button>
                            </div>
                        )}
                        <span />
                        <button
                            className="button button--quiet"
                            type="button"
                            disabled={submitting}
                            onClick={onClose}
                        >
                            Отмена
                        </button>
                        <button
                            className="button button--primary"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Вторая модалка: выбор Scope при сохранении повторяющегося события */}
            {showSaveScopeModal && (
                <ScopeModal
                    entityName="событие"
                    actionType="save"
                    actionLabel="Применить изменения"
                    initialScope="occurrence"
                    isSubmitting={submitting}
                    onConfirm={(scope) => {
                        void executeSave(scope)
                    }}
                    onClose={() => setShowSaveScopeModal(false)}
                />
            )}

            {/* Вторая модалка: выбор Scope при отмене повторяющегося события */}
            {showCancelScopeModal && (
                <ScopeModal
                    entityName="событие"
                    actionType="cancel"
                    actionLabel="Отменить"
                    initialScope="occurrence"
                    isSubmitting={submitting}
                    onConfirm={(scope) => {
                        void handleSoftCancel(scope)
                    }}
                    onClose={() => setShowCancelScopeModal(false)}
                />
            )}

            {/* Подтверждение отмены разового события */}
            {showCancelConfirm && (
                <ConfirmDialog
                    title="Отменить событие"
                    message="Вы уверены, что хотите отменить это событие?"
                    confirmLabel="Отменить событие"
                    onConfirm={() => {
                        void handleSoftCancel('series')
                    }}
                    onClose={() => setShowCancelConfirm(false)}
                />
            )}

            {/* Подтверждение жесткого удаления из базы */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Удалить событие"
                    message="Удалить запись события и все связанные данные из базы данных без возможности восстановления?"
                    confirmLabel="Удалить навсегда"
                    onConfirm={() => {
                        void handleHardDelete()
                    }}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    )
}
