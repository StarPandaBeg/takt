import { useState } from 'react'
import type { UpdateScope } from '../../types/api'
import { Modal } from './modal'

interface ScopeModalProps {
    title?: string
    description?: string
    actionLabel?: string
    actionType?: 'save' | 'cancel'
    entityName?: 'событие' | 'дедлайн'
    initialScope?: UpdateScope
    onConfirm: (scope: UpdateScope) => void
    onClose: () => void
    isSubmitting?: boolean
}

export function ScopeModal({
    title,
    description,
    actionLabel = 'Применить',
    actionType = 'save',
    entityName = 'событие',
    initialScope = 'occurrence',
    onConfirm,
    onClose,
    isSubmitting = false,
}: ScopeModalProps) {
    const [selectedScope, setSelectedScope] =
        useState<UpdateScope>(initialScope)

    const isCancel = actionType === 'cancel'
    const defaultTitle = isCancel
        ? `Отмена повторяющегося ${entityName === 'событие' ? 'события' : 'дедлайна'}`
        : `Изменение повторяющегося ${entityName === 'событие' ? 'события' : 'дедлайна'}`

    const defaultDescription = isCancel
        ? `Выберите, какую часть серии необходимо отменить:`
        : `Это ${entityName} входит в регулярную серию. К каким экземплярам применить изменения?`

    const options: {
        scope: UpdateScope
        label: string
        sublabel: string
    }[] = isCancel
        ? [
              {
                  scope: 'occurrence',
                  label: 'Только этот экземпляр',
                  sublabel:
                      'Отменит только выбранную дату. Остальные повторы сохранятся.',
              },
              {
                  scope: 'this_and_future',
                  label: 'Этот и последующие',
                  sublabel:
                      'Завершит серию перед этой датой. Будущие повторы будут отменены.',
              },
              {
                  scope: 'series',
                  label: 'Вся серия целиком',
                  sublabel:
                      'Отменит регулярную запись и все связанные повторы.',
              },
          ]
        : [
              {
                  scope: 'occurrence',
                  label: 'Только это вхождение',
                  sublabel:
                      'Изменения коснутся только выбранной даты (остальные дни серии не изменятся).',
              },
              {
                  scope: 'this_and_future',
                  label: 'Это и все последующие',
                  sublabel:
                      'Разделит серию: создаст новое расписание, начиная с этой даты.',
              },
              {
                  scope: 'series',
                  label: 'Вся серия',
                  sublabel:
                      'Обновит базовое правило для всех экземпляров серии.',
              },
          ]

    return (
        <Modal title={title ?? defaultTitle} onClose={onClose}>
            <div className="scope-dialog-content">
                <p className="scope-dialog-description">
                    {description ?? defaultDescription}
                </p>

                <div className="scope-dialog-options" role="radiogroup">
                    {options.map((opt) => (
                        <label
                            key={opt.scope}
                            className={`scope-dialog-option ${selectedScope === opt.scope ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="scope_selection"
                                value={opt.scope}
                                checked={selectedScope === opt.scope}
                                onChange={() => setSelectedScope(opt.scope)}
                            />
                            <div className="scope-dialog-option__text">
                                <strong>{opt.label}</strong>
                                <span>{opt.sublabel}</span>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="form__actions form__actions--end">
                    <button
                        type="button"
                        className="button button--quiet"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Назад
                    </button>
                    <button
                        type="button"
                        className={`button ${isCancel ? 'button--danger' : 'button--primary'}`}
                        disabled={isSubmitting}
                        onClick={() => onConfirm(selectedScope)}
                    >
                        {isSubmitting
                            ? 'Выполняется...'
                            : (actionLabel ??
                              (isCancel ? 'Отменить' : 'Сохранить'))}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
