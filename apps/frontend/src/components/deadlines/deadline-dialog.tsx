import { Trash2, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
    buildIsoDateTime,
    extractDateString,
    extractTimeString,
} from '../../lib/date'
import type {
    CancelDeadlinePayload,
    CreateDeadlinePayload,
    DeadlineVisibility,
    Recurrence,
    ResolvedDeadline,
    UpdateDeadlinePayload,
    UpdateScope,
} from '../../types/api'
import { ConfirmDialog } from '../common/confirm-dialog'
import { Modal } from '../common/modal'
import { RecurrenceEditor } from '../common/recurrence-editor'
import { ScopeModal } from '../common/scope-modal'
import { VisibilityEditor } from '../common/visibility-editor'

interface DeadlineDialogProps {
    timezone: string
    deadline?: ResolvedDeadline
    initialDate: string // YYYY-MM-DD
    onClose: () => void
    onCreate: (payload: CreateDeadlinePayload) => Promise<void>
    onUpdate: (id: number, payload: UpdateDeadlinePayload) => Promise<void>
    onCancel: (id: number, payload: CancelDeadlinePayload) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

export function DeadlineDialog({
    timezone,
    deadline,
    initialDate,
    onClose,
    onCreate,
    onUpdate,
    onCancel,
    onDelete,
}: DeadlineDialogProps) {
    const isEdit = Boolean(deadline)
    const isRecurringInstance = Boolean(deadline?.recurrenceId)

    const [title, setTitle] = useState(deadline?.title ?? '')
    const [description, setDescription] = useState(deadline?.description ?? '')
    const [date, setDate] = useState(() =>
        deadline ? extractDateString(deadline.due, timezone) : initialDate,
    )
    const [dueIsDate, setDueIsDate] = useState(deadline?.dueIsDate ?? true)
    const [time, setTime] = useState(() =>
        deadline ? extractTimeString(deadline.due, timezone) : '18:00',
    )
    const [visibility, setVisibility] = useState<DeadlineVisibility>(() =>
        deadline?.visibility
            ? deadline.visibility
            : { show: { type: 'always' }, hide: 'on_due' },
    )
    const [recurrence, setRecurrence] = useState<Recurrence | null>(null)
    const [completed, setCompleted] = useState(deadline?.completed ?? false)

    // Вторичные диалоги
    const [showSaveScopeModal, setShowSaveScopeModal] = useState(false)
    const [showCancelScopeModal, setShowCancelScopeModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const validateForm = (): string | null => {
        if (!title.trim()) {
            setFormError('Укажите название дедлайна')
            return null
        }
        setFormError(null)
        return buildIsoDateTime(date, time, dueIsDate, timezone)
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const dueIso = validateForm()
        if (!dueIso) return

        // Если это повторяющийся дедлайн — спрашиваем scope во второй модалке
        if (isEdit && isRecurringInstance) {
            setShowSaveScopeModal(true)
            return
        }

        // Обычный дедлайн сохраняем сразу
        void executeSave('series')
    }

    const executeSave = async (chosenScope: UpdateScope) => {
        const dueIso = validateForm()
        if (!dueIso) return

        setSubmitting(true)
        setFormError(null)

        try {
            if (!deadline) {
                // Создание
                const payload: CreateDeadlinePayload = {
                    title: title.trim(),
                    description: description.trim() || null,
                    due: dueIso,
                    dueIsDate,
                    timezone,
                    completed: recurrence ? false : completed,
                    visibility,
                    recurrence: recurrence ?? undefined,
                }
                await onCreate(payload)
            } else {
                // Обновление
                const payload: UpdateDeadlinePayload = {
                    scope: isRecurringInstance ? chosenScope : 'series',
                    recurrenceId:
                        isRecurringInstance && chosenScope !== 'series'
                            ? (deadline.recurrenceId ?? undefined)
                            : undefined,
                    changes: {
                        title: title.trim(),
                        description: description.trim() || null,
                        due: dueIso,
                        dueIsDate,
                        timezone,
                        ...(chosenScope !== 'occurrence'
                            ? { recurrence, visibility }
                            : {}),
                    },
                }
                await onUpdate(deadline.id, payload)
            }
            setShowSaveScopeModal(false)
            onClose()
        } catch (err: unknown) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось сохранить дедлайн',
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleSoftCancel = async (chosenScope: UpdateScope) => {
        if (!deadline) return
        setSubmitting(true)
        try {
            await onCancel(deadline.id, {
                scope: isRecurringInstance ? chosenScope : 'series',
                recurrenceId:
                    isRecurringInstance && chosenScope !== 'series'
                        ? (deadline.recurrenceId ?? undefined)
                        : undefined,
            })
            setShowCancelScopeModal(false)
            setShowCancelConfirm(false)
            onClose()
        } catch (err: unknown) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось отменить дедлайн',
            )
        } finally {
            setSubmitting(false)
        }
    }

    const handleHardDelete = async () => {
        if (!deadline) return
        setSubmitting(true)
        try {
            await onDelete(deadline.id)
            setShowDeleteConfirm(false)
            onClose()
        } catch (err: unknown) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось удалить дедлайн',
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Modal
                title={isEdit ? 'Редактировать дедлайн' : 'Новый дедлайн'}
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
                                placeholder="Что нужно закончить"
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
                                placeholder="Подробности или критерии готовности"
                            />
                        </label>
                    </div>

                    {/* Секция 2: Срок и время */}
                    <div className="dialog-section field--wide">
                        <h4 className="dialog-section__title">
                            Срок выполнения
                        </h4>

                        <div className="form-grid align-center">
                            <label className="check-field">
                                <input
                                    type="checkbox"
                                    checked={dueIsDate}
                                    onChange={(e) =>
                                        setDueIsDate(e.target.checked)
                                    }
                                />
                                <span>Весь день (без точного времени)</span>
                            </label>

                            {!isEdit && !recurrence && (
                                <label className="check-field">
                                    <input
                                        type="checkbox"
                                        checked={completed}
                                        onChange={(e) =>
                                            setCompleted(e.target.checked)
                                        }
                                    />
                                    <span>Уже выполнен</span>
                                </label>
                            )}
                        </div>

                        {!dueIsDate ? (
                            <div className="form-row-deadline">
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
                                    <span>Время</span>
                                    <input
                                        type="time"
                                        required
                                        value={time}
                                        onChange={(e) =>
                                            setTime(e.target.value)
                                        }
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

                    {/* Секция 4: Настройки отображения на экране */}
                    {(!isEdit || !isRecurringInstance) && (
                        <div className="dialog-section field--wide">
                            <h4 className="dialog-section__title">
                                Отображение на e-ink экране
                            </h4>
                            <VisibilityEditor
                                value={visibility}
                                onChange={setVisibility}
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
                                    title="Полное удаление из базы"
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

            {/* Вторая модалка: выбор Scope при сохранении повторяющегося дедлайна */}
            {showSaveScopeModal && (
                <ScopeModal
                    entityName="дедлайн"
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

            {/* Вторая модалка: выбор Scope при отмене повторяющегося дедлайна */}
            {showCancelScopeModal && (
                <ScopeModal
                    entityName="дедлайн"
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

            {/* Подтверждение отмены разового дедлайна */}
            {showCancelConfirm && (
                <ConfirmDialog
                    title="Отменить дедлайн"
                    message="Вы уверены, что хотите отменить этот дедлайн?"
                    confirmLabel="Отменить дедлайн"
                    onConfirm={() => {
                        void handleSoftCancel('series')
                    }}
                    onClose={() => setShowCancelConfirm(false)}
                />
            )}

            {/* Подтверждение жесткого удаления из базы */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Удалить дедлайн"
                    message="Удалить базовую запись дедлайна, все исключения и отметки выполнения из базы данных?"
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
