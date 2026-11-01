import type { DeadlineVisibility } from '../../types/api'

interface VisibilityEditorProps {
    value: DeadlineVisibility
    onChange: (value: DeadlineVisibility) => void
}

export function VisibilityEditor({ value, onChange }: VisibilityEditorProps) {
    const showType = value.show.type
    const showDays = value.show.type === 'before' ? value.show.days : 3
    const hidePolicy = value.hide

    const handleShowTypeChange = (type: 'always' | 'before') => {
        if (type === 'always') {
            onChange({
                ...value,
                show: { type: 'always' },
            })
        } else {
            onChange({
                ...value,
                show: { type: 'before', days: showDays || 3 },
            })
        }
    }

    const handleShowDaysChange = (days: number) => {
        onChange({
            ...value,
            show: { type: 'before', days: Math.max(1, days) },
        })
    }

    const handleHidePolicyChange = (hide: 'on_due' | 'on_complete') => {
        onChange({
            ...value,
            hide,
        })
    }

    return (
        <div className="visibility-editor field--wide">
            <div className="visibility-editor__body">
                {/* Группа 1: Появление на экране */}
                <div className="visibility-section">
                    <span className="visibility-section__title">
                        Когда показывать на устройстве:
                    </span>
                    <div className="visibility-options">
                        <label
                            className={`visibility-card-radio ${showType === 'always' ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="visibility_show"
                                checked={showType === 'always'}
                                onChange={() => handleShowTypeChange('always')}
                            />
                            <div className="visibility-card-radio__content">
                                <span className="visibility-card-radio__label">
                                    Всегда
                                </span>
                                <span className="visibility-card-radio__hint">
                                    Дедлайн постоянно виден в списке на экране
                                    устройства
                                </span>
                            </div>
                        </label>

                        <label
                            className={`visibility-card-radio ${showType === 'before' ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="visibility_show"
                                checked={showType === 'before'}
                                onChange={() => handleShowTypeChange('before')}
                            />
                            <div className="visibility-card-radio__content">
                                <span className="visibility-card-radio__label">
                                    Заранее до срока
                                </span>
                                <span className="visibility-card-radio__hint">
                                    Появится на экране за{' '}
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={showDays}
                                        className="visibility-days-input"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            const days =
                                                parseInt(e.target.value, 10) ||
                                                1
                                            handleShowDaysChange(days)
                                            if (showType !== 'before') {
                                                handleShowTypeChange('before')
                                            }
                                        }}
                                    />{' '}
                                    дн. до наступления
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Группа 2: Скрытие с экрана */}
                <div className="visibility-section">
                    <span className="visibility-section__title">
                        Когда скрывать с устройства:
                    </span>
                    <div className="visibility-options">
                        <label
                            className={`visibility-card-radio ${hidePolicy === 'on_due' ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="visibility_hide"
                                checked={hidePolicy === 'on_due'}
                                onChange={() =>
                                    handleHidePolicyChange('on_due')
                                }
                            />
                            <div className="visibility-card-radio__content">
                                <span className="visibility-card-radio__label">
                                    В день наступления срока
                                </span>
                                <span className="visibility-card-radio__hint">
                                    Автоматически скроется с экрана после
                                    указанной даты
                                </span>
                            </div>
                        </label>

                        <label
                            className={`visibility-card-radio ${hidePolicy === 'on_complete' ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="visibility_hide"
                                checked={hidePolicy === 'on_complete'}
                                onChange={() =>
                                    handleHidePolicyChange('on_complete')
                                }
                            />
                            <div className="visibility-card-radio__content">
                                <span className="visibility-card-radio__label">
                                    Только после выполнения
                                </span>
                                <span className="visibility-card-radio__hint">
                                    Остается на экране и напоминает о себе, пока
                                    вы не отметите его
                                </span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}
