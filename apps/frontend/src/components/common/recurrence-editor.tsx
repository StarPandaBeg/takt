import { useState } from 'react'
import type { Recurrence, Weekday } from '../../types/api'

interface RecurrenceEditorProps {
    value: Recurrence | null
    onChange: (value: Recurrence | null) => void
    defaultDateStr?: string // YYYY-MM-DD
}

const ALL_WEEKDAYS: { code: Weekday; label: string }[] = [
    { code: 'MO', label: 'Пн' },
    { code: 'TU', label: 'Вт' },
    { code: 'WE', label: 'Ср' },
    { code: 'TH', label: 'Чт' },
    { code: 'FR', label: 'Пт' },
    { code: 'SA', label: 'Сб' },
    { code: 'SU', label: 'Вс' },
]

export function RecurrenceEditor({
    value,
    onChange,
    defaultDateStr,
}: RecurrenceEditorProps) {
    const isEnabled = value !== null

    // Базовые параметры из текущего значения или дефолты
    const frequency = value?.frequency ?? 'daily'
    const interval = value?.interval ?? 1
    const endType =
        value?.count !== undefined
            ? 'count'
            : value?.until !== undefined
              ? 'until'
              : 'never'
    const count = value?.count ?? 10
    const until = value?.until
        ? value.until.slice(0, 10)
        : (defaultDateStr ?? '')

    // Специфичные поля
    const weekdays: Weekday[] =
        value && value.frequency === 'weekly' ? value.weekdays : ['MO']
    const day =
        value && value.frequency === 'monthly-date'
            ? value.day
            : defaultDateStr
              ? Number(defaultDateStr.slice(8, 10))
              : 1
    const monthlyWeekday: Weekday =
        value && value.frequency === 'monthly-weekday' ? value.weekday : 'MO'
    const occurrence =
        value && value.frequency === 'monthly-weekday' ? value.occurrence : 1

    const [collapsed, setCollapsed] = useState(!isEnabled)

    const toggleEnabled = (enabled: boolean) => {
        if (!enabled) {
            onChange(null)
            setCollapsed(true)
        } else {
            setCollapsed(false)
            onChange({
                frequency: 'daily',
                interval: 1,
            })
        }
    }

    const updateRecurrence = (partial: object) => {
        const base = value ?? {
            frequency: 'daily' as const,
            interval: 1,
        }
        const merged: unknown = { ...base, ...partial }
        const updated = merged as Recurrence

        // Нормализация interval
        if (updated.interval && updated.interval <= 1) {
            delete updated.interval
        }

        // Взаимоисключение count и until
        if (endType === 'count') {
            delete updated.until
            updated.count = count
        } else if (endType === 'until' && until) {
            delete updated.count
            updated.until = `${until}T23:59:59.000Z`
        } else {
            delete updated.count
            delete updated.until
        }

        onChange(updated)
    }

    const setFrequency = (newFreq: Recurrence['frequency']) => {
        const common = {
            ...(interval > 1 ? { interval } : {}),
            ...(endType === 'count' ? { count } : {}),
            ...(endType === 'until' && until
                ? { until: `${until}T23:59:59.000Z` }
                : {}),
        }

        switch (newFreq) {
            case 'daily':
                onChange({ frequency: 'daily', ...common })
                break
            case 'weekly':
                onChange({
                    frequency: 'weekly',
                    weekdays: weekdays.length ? weekdays : ['MO'],
                    ...common,
                })
                break
            case 'monthly-date':
                onChange({
                    frequency: 'monthly-date',
                    day: Math.min(31, Math.max(1, day)),
                    ...common,
                })
                break
            case 'monthly-weekday':
                onChange({
                    frequency: 'monthly-weekday',
                    weekday: monthlyWeekday,
                    occurrence,
                    ...common,
                })
                break
            case 'yearly':
                onChange({ frequency: 'yearly', ...common })
                break
        }
    }

    const toggleWeekday = (code: Weekday) => {
        let newDays = weekdays.includes(code)
            ? weekdays.filter((d) => d !== code)
            : [...weekdays, code]
        if (newDays.length === 0) newDays = [code]
        updateRecurrence({ weekdays: newDays })
    }

    const handleEndTypeChange = (type: 'never' | 'count' | 'until') => {
        if (!value) return
        const updated = { ...value }
        if (type === 'never') {
            delete updated.count
            delete updated.until
        } else if (type === 'count') {
            delete updated.until
            updated.count = count || 10
        } else if (type === 'until') {
            delete updated.count
            const fallbackDate = defaultDateStr || '2026-12-31'
            updated.until = `${until || fallbackDate}T23:59:59.000Z`
        }
        onChange(updated)
    }

    return (
        <div className="recurrence-editor field--wide">
            <label className="check-field">
                <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => toggleEnabled(e.target.checked)}
                />
                <span>Повторять регулярно</span>
            </label>

            {isEnabled && !collapsed && (
                <div className="recurrence-editor__body panel panel--nested">
                    <div className="form-grid">
                        <label className="field">
                            <span>Периодичность</span>
                            <select
                                value={frequency}
                                onChange={(e) =>
                                    setFrequency(
                                        e.target
                                            .value as Recurrence['frequency'],
                                    )
                                }
                            >
                                <option value="daily">Каждый день</option>
                                <option value="weekly">
                                    По дням недели (еженедельно)
                                </option>
                                <option value="monthly-date">
                                    Ежемесячно (по числу)
                                </option>
                                <option value="monthly-weekday">
                                    Ежемесячно (по дню недели)
                                </option>
                                <option value="yearly">Каждый год</option>
                            </select>
                        </label>

                        <label className="field">
                            <span>Интервал</span>
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={interval}
                                onChange={(e) =>
                                    updateRecurrence({
                                        interval: Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1,
                                        ),
                                    })
                                }
                            />
                        </label>
                    </div>

                    {frequency === 'weekly' && (
                        <div className="weekdays-selector">
                            <span className="field-label">Дни недели</span>
                            <div className="weekdays-pills">
                                {ALL_WEEKDAYS.map(({ code, label }) => {
                                    const active = weekdays.includes(code)
                                    return (
                                        <button
                                            type="button"
                                            key={code}
                                            className={`weekday-pill ${active ? 'is-active' : ''}`}
                                            onClick={() => toggleWeekday(code)}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {frequency === 'monthly-date' && (
                        <label className="field">
                            <span>Число месяца (1–31)</span>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={day}
                                onChange={(e) =>
                                    updateRecurrence({
                                        day: Math.min(
                                            31,
                                            Math.max(
                                                1,
                                                parseInt(e.target.value, 10) ||
                                                    1,
                                            ),
                                        ),
                                    })
                                }
                            />
                        </label>
                    )}

                    {frequency === 'monthly-weekday' && (
                        <div className="form-grid">
                            <label className="field">
                                <span>Номер недели</span>
                                <select
                                    value={occurrence}
                                    onChange={(e) =>
                                        updateRecurrence({
                                            occurrence: parseInt(
                                                e.target.value,
                                                10,
                                            ),
                                        })
                                    }
                                >
                                    <option value={1}>1-й</option>
                                    <option value={2}>2-й</option>
                                    <option value={3}>3-й</option>
                                    <option value={4}>4-й</option>
                                    <option value={5}>5-й</option>
                                    <option value={-1}>Последний</option>
                                </select>
                            </label>
                            <label className="field">
                                <span>День недели</span>
                                <select
                                    value={monthlyWeekday}
                                    onChange={(e) =>
                                        updateRecurrence({
                                            weekday: e.target.value,
                                        })
                                    }
                                >
                                    {ALL_WEEKDAYS.map(({ code, label }) => (
                                        <option key={code} value={code}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    )}

                    <div className="recurrence-ends">
                        <span className="field-label">Завершение серии</span>
                        <div className="end-type-options">
                            <label className="radio-field">
                                <input
                                    type="radio"
                                    name="recurrence_end"
                                    value="never"
                                    checked={endType === 'never'}
                                    onChange={() =>
                                        handleEndTypeChange('never')
                                    }
                                />
                                <span>Никогда</span>
                            </label>

                            <label className="radio-field">
                                <input
                                    type="radio"
                                    name="recurrence_end"
                                    value="count"
                                    checked={endType === 'count'}
                                    onChange={() =>
                                        handleEndTypeChange('count')
                                    }
                                />
                                <span>После повторений:</span>
                                {endType === 'count' && (
                                    <input
                                        type="number"
                                        min={1}
                                        max={10000}
                                        value={count}
                                        className="small-input"
                                        onChange={(e) =>
                                            updateRecurrence({
                                                count: Math.max(
                                                    1,
                                                    parseInt(
                                                        e.target.value,
                                                        10,
                                                    ) || 1,
                                                ),
                                            })
                                        }
                                    />
                                )}
                            </label>

                            <label className="radio-field">
                                <input
                                    type="radio"
                                    name="recurrence_end"
                                    value="until"
                                    checked={endType === 'until'}
                                    onChange={() =>
                                        handleEndTypeChange('until')
                                    }
                                />
                                <span>До даты:</span>
                                {endType === 'until' && (
                                    <input
                                        type="date"
                                        value={until}
                                        className="small-input"
                                        onChange={(e) => {
                                            const newUntil = e.target.value
                                            if (newUntil) {
                                                updateRecurrence({
                                                    until: `${newUntil}T23:59:59.000Z`,
                                                })
                                            }
                                        }}
                                    />
                                )}
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
