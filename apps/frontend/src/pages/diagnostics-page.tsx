import { useQuery } from '@tanstack/react-query'
import {
    Activity,
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Download,
    FileJson,
    FileText,
    Filter,
    HardDriveDownload,
    LineChart,
    Loader2,
    RefreshCw,
    RotateCcw,
    ServerCog,
    Trash2,
    X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { api } from '../api/client'
import { ConfirmDialog } from '../components/common/confirm-dialog'
import { ErrorBanner } from '../components/common/error-banner'
import { DiagnosticsChartsView } from '../components/diagnostics/diagnostics-charts-view'
import { PageHeader } from '../components/page-header'
import type {
    DiagnosticCoredump,
    DiagnosticLevel,
    DiagnosticRecord,
    DiagnosticRecordsQuery,
    DiagnosticRecordType,
    DiagnosticSortBy,
} from '../types/api'

type DiagnosticsView = 'records' | 'metrics' | 'crashes' | 'boots' | 'coredumps'

interface FilterState {
    from: string
    to: string
    level: '' | DiagnosticLevel
    type: '' | DiagnosticRecordType
    module: string
    source: string
    query: string
    bootId: string
    sequence: string
    firmwareVersion: string
    gitSha: string
    eventType: string
    hasFields: '' | 'true' | 'false'
    sortBy: DiagnosticSortBy
    sortDirection: 'asc' | 'desc'
}

const initialFilters: FilterState = {
    from: '',
    to: '',
    level: '',
    type: '',
    module: '',
    source: '',
    query: '',
    bootId: '',
    sequence: '',
    firmwareVersion: '',
    gitSha: '',
    eventType: '',
    hasFields: '',
    sortBy: 'received_at',
    sortDirection: 'desc',
}

const levels: DiagnosticLevel[] = [
    'TRACE',
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR',
    'CRITICAL',
    'FATAL',
    'VERBOSE',
]

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
})

function optionalText(value: string): string | undefined {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function parseLocalDate(value: string): number | undefined {
    if (value === '') return undefined
    const timestamp = new Date(value).getTime()
    return Number.isNaN(timestamp) ? undefined : timestamp
}

function buildRecordsQuery(
    filters: FilterState,
    view: DiagnosticsView,
    page: number,
    pageSize: number,
): DiagnosticRecordsQuery {
    const sequence = Number.parseInt(filters.sequence, 10)
    return {
        from: parseLocalDate(filters.from),
        to: parseLocalDate(filters.to),
        level: filters.level || undefined,
        type:
            view === 'metrics'
                ? 'metric'
                : view === 'crashes'
                  ? 'event'
                  : filters.type || undefined,
        module: optionalText(filters.module),
        source: optionalText(filters.source),
        query: optionalText(filters.query),
        bootId: optionalText(filters.bootId),
        sequence: Number.isNaN(sequence) ? undefined : sequence,
        firmwareVersion: optionalText(filters.firmwareVersion),
        gitSha: optionalText(filters.gitSha),
        eventType:
            view === 'crashes' ? 'crash' : optionalText(filters.eventType),
        hasFields:
            filters.hasFields === '' ? undefined : filters.hasFields === 'true',
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
        limit: pageSize,
        offset: page * pageSize,
    }
}

function formatTimestamp(value: number | null): string {
    return value === null ? '—' : dateFormatter.format(new Date(value))
}

function formatUptime(value: number | null): string {
    if (value === null) return '—'
    const totalSeconds = Math.floor(value / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours > 0 ? `${hours}ч ` : ''}${minutes > 0 ? `${minutes}м ` : ''}${seconds}с`
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}

function LevelBadge({ level }: { level: DiagnosticLevel | null }) {
    return (
        <span
            className={`diagnostics-level diagnostics-level--${(level ?? 'unknown').toLowerCase()}`}
        >
            {level ?? '—'}
        </span>
    )
}

function RecordDetails({
    record,
    onClose,
}: {
    record: DiagnosticRecord
    onClose: () => void
}) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [onClose])

    return (
        <div className="diagnostics-drawer-backdrop" onMouseDown={onClose}>
            <aside
                className="diagnostics-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="diagnostics-record-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="diagnostics-drawer__header">
                    <div>
                        <span className="eyebrow">Запись #{record.id}</span>
                        <h2 id="diagnostics-record-title">
                            {record.message || 'Диагностическая запись'}
                        </h2>
                    </div>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div className="diagnostics-drawer__body">
                    <dl className="diagnostics-details-grid">
                        <div>
                            <dt>Получено</dt>
                            <dd>{formatTimestamp(record.received_at)}</dd>
                        </div>
                        <div>
                            <dt>Время устройства</dt>
                            <dd>{formatTimestamp(record.timestamp_unix_ms)}</dd>
                        </div>
                        <div>
                            <dt>Уровень / тип</dt>
                            <dd>
                                {record.level ?? '—'} / {record.type}
                            </dd>
                        </div>
                        <div>
                            <dt>Источник / модуль</dt>
                            <dd>
                                {record.source ?? '—'} / {record.module ?? '—'}
                            </dd>
                        </div>
                        <div>
                            <dt>Boot ID</dt>
                            <dd className="diagnostics-mono">
                                {record.boot_id}
                            </dd>
                        </div>
                        <div>
                            <dt>Record ID</dt>
                            <dd className="diagnostics-mono">
                                {record.record_id}
                            </dd>
                        </div>
                        <div>
                            <dt>Sequence / uptime</dt>
                            <dd>
                                {record.sequence} /{' '}
                                {formatUptime(record.uptime_ms)}
                            </dd>
                        </div>
                        <div>
                            <dt>Firmware / Git SHA</dt>
                            <dd className="diagnostics-mono">
                                {record.firmware_version ?? '—'} /{' '}
                                {record.git_sha ?? '—'}
                            </dd>
                        </div>
                    </dl>
                    <section className="diagnostics-json-section">
                        <h3>Дополнительные поля</h3>
                        <pre>{JSON.stringify(record.fields, null, 2)}</pre>
                    </section>
                    <section className="diagnostics-json-section">
                        <h3>Исходные данные</h3>
                        <pre>{JSON.stringify(record, null, 2)}</pre>
                    </section>
                </div>
            </aside>
        </div>
    )
}

export function DiagnosticsPage() {
    const [displayMode, setDisplayMode] = useState<'logs' | 'charts'>('logs')
    const [view, setView] = useState<DiagnosticsView>('records')
    const [draftFilters, setDraftFilters] = useState(initialFilters)
    const [filters, setFilters] = useState(initialFilters)
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(50)
    const [refreshInterval, setRefreshInterval] = useState(0)
    const [selectedRecord, setSelectedRecord] =
        useState<DiagnosticRecord | null>(null)
    const [exporting, setExporting] = useState<'json' | 'csv' | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [showClearConfirmation, setShowClearConfirmation] = useState(false)
    const [isClearing, setIsClearing] = useState(false)
    const [clearResult, setClearResult] = useState<string | null>(null)

    const recordsQuery = useMemo(
        () => buildRecordsQuery(filters, view, page, pageSize),
        [filters, page, pageSize, view],
    )
    const showsRecords = ['records', 'metrics', 'crashes'].includes(view)
    const records = useQuery({
        queryKey: ['diagnostics-records', recordsQuery],
        queryFn: () => api.diagnostics.records(recordsQuery),
        enabled: showsRecords && displayMode === 'logs',
        refetchInterval: refreshInterval || false,
        placeholderData: (previous) => previous,
    })
    const boots = useQuery({
        queryKey: ['diagnostics-boots'],
        queryFn: () => api.diagnostics.boots(),
        enabled: view === 'boots' || displayMode === 'charts',
        refetchInterval: refreshInterval || false,
    })
    const coredumps = useQuery({
        queryKey: ['diagnostics-coredumps', filters.bootId],
        queryFn: () =>
            api.diagnostics.coredumps({
                bootId: optionalText(filters.bootId),
                limit: 100,
            }),
        enabled: view === 'coredumps' && displayMode === 'logs',
        refetchInterval: refreshInterval || false,
    })

    // Запросы для режима «Графики»
    const telemetryQuery: DiagnosticRecordsQuery = useMemo(
        () => ({
            from: parseLocalDate(filters.from),
            to: parseLocalDate(filters.to),
            bootId: optionalText(filters.bootId),
            firmwareVersion: optionalText(filters.firmwareVersion),
            gitSha: optionalText(filters.gitSha),
            hasFields: true,
            sortBy: 'received_at',
            sortDirection: 'asc',
            limit: 500,
        }),
        [
            filters.from,
            filters.to,
            filters.bootId,
            filters.firmwareVersion,
            filters.gitSha,
        ],
    )
    const telemetryRecords = useQuery({
        queryKey: ['diagnostics-telemetry-charts', telemetryQuery],
        queryFn: () => api.diagnostics.records(telemetryQuery),
        enabled: displayMode === 'charts',
        refetchInterval: refreshInterval || false,
    })

    const errorLogsQuery: DiagnosticRecordsQuery = useMemo(
        () => ({
            from: parseLocalDate(filters.from),
            to: parseLocalDate(filters.to),
            bootId: optionalText(filters.bootId),
            level: 'ERROR',
            sortBy: 'received_at',
            sortDirection: 'asc',
            limit: 500,
        }),
        [filters.from, filters.to, filters.bootId],
    )
    const errorRecords = useQuery({
        queryKey: ['diagnostics-errors-charts', errorLogsQuery],
        queryFn: () => api.diagnostics.records(errorLogsQuery),
        enabled: displayMode === 'charts',
        refetchInterval: refreshInterval || false,
    })

    const total = records.data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const activeFilterCount = Object.entries(filters).filter(
        ([key, value]) =>
            !['sortBy', 'sortDirection'].includes(key) && value !== '',
    ).length
    const lastUpdated = Math.max(
        records.dataUpdatedAt,
        boots.dataUpdatedAt,
        coredumps.dataUpdatedAt,
        telemetryRecords.dataUpdatedAt,
        errorRecords.dataUpdatedAt,
    )

    const applyFilters = (event: FormEvent) => {
        event.preventDefault()
        setFilters(draftFilters)
        setPage(0)
    }
    const resetFilters = () => {
        setDraftFilters(initialFilters)
        setFilters(initialFilters)
        setPage(0)
    }
    const selectView = (next: DiagnosticsView) => {
        setView(next)
        setPage(0)
    }
    const selectBoot = (bootId: string) => {
        const next = { ...filters, bootId }
        setFilters(next)
        setDraftFilters(next)
        setView('records')
        setPage(0)
    }
    const handleTimeRangeChange = (from: string, to: string) => {
        const next = { ...filters, from, to }
        setFilters(next)
        setDraftFilters(next)
        setPage(0)
    }
    const handleBootIdChange = (bootId: string) => {
        const next = { ...filters, bootId }
        setFilters(next)
        setDraftFilters(next)
        setPage(0)
    }
    const changeSort = (sortBy: DiagnosticSortBy) => {
        const sortDirection: FilterState['sortDirection'] =
            filters.sortBy === sortBy && filters.sortDirection === 'desc'
                ? 'asc'
                : 'desc'
        const next = { ...filters, sortBy, sortDirection }
        setFilters(next)
        setDraftFilters(next)
        setPage(0)
    }
    const refresh = () => {
        if (displayMode === 'charts') {
            void telemetryRecords.refetch()
            void errorRecords.refetch()
            void boots.refetch()
        } else {
            if (showsRecords) void records.refetch()
            if (view === 'boots') void boots.refetch()
            if (view === 'coredumps') void coredumps.refetch()
        }
    }
    const exportRecords = async (format: 'json' | 'csv') => {
        setExporting(format)
        setActionError(null)
        try {
            const blob = await api.diagnostics.export(
                { ...recordsQuery, limit: undefined, offset: undefined },
                format,
            )
            saveBlob(blob, `takt-diagnostics.${format}`)
        } catch (error: unknown) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Не удалось экспортировать записи',
            )
        } finally {
            setExporting(null)
        }
    }
    const downloadCoredump = async (dump: DiagnosticCoredump) => {
        setActionError(null)
        try {
            const blob = await api.diagnostics.downloadCoredump(dump.id)
            saveBlob(blob, `takt-coredump-${dump.dump_id}.bin`)
        } catch (error: unknown) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Не удалось скачать Core Dump',
            )
        }
    }
    const clearRecords = async () => {
        setIsClearing(true)
        setActionError(null)
        setClearResult(null)
        try {
            const result = await api.diagnostics.clearRecords()
            setPage(0)
            setSelectedRecord(null)
            setClearResult(`Удалено диагностических записей: ${result.deleted}`)
            await Promise.all([records.refetch(), boots.refetch()])
        } catch (error: unknown) {
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Не удалось очистить диагностические записи',
            )
        } finally {
            setIsClearing(false)
        }
    }

    const error =
        records.error ??
        boots.error ??
        coredumps.error ??
        telemetryRecords.error ??
        errorRecords.error

    return (
        <div className="page diagnostics-page">
            <PageHeader
                eyebrow="Устройство"
                title="Диагностика"
                description="Логи, события, метрики, телеметрия и графики устройства Takt"
                action={
                    <div className="diagnostics-header-actions">
                        <label>
                            Автообновление
                            <select
                                value={refreshInterval}
                                onChange={(event) =>
                                    setRefreshInterval(
                                        Number(event.target.value),
                                    )
                                }
                            >
                                <option value={0}>выключено</option>
                                <option value={5000}>5 секунд</option>
                                <option value={15000}>15 секунд</option>
                                <option value={30000}>30 секунд</option>
                                <option value={60000}>1 минута</option>
                            </select>
                        </label>
                        <button
                            className="button button--quiet"
                            type="button"
                            onClick={refresh}
                        >
                            <RefreshCw size={15} /> Обновить
                        </button>
                        <button
                            className="button button--danger"
                            type="button"
                            disabled={isClearing}
                            onClick={() => setShowClearConfirmation(true)}
                        >
                            {isClearing ? (
                                <Loader2 className="spin-animation" size={15} />
                            ) : (
                                <Trash2 size={15} />
                            )}
                            Очистить логи
                        </button>
                    </div>
                }
            />

            <div className="diagnostics-statusbar">
                <span>
                    <Clock3 size={14} /> Последнее обновление:{' '}
                    {lastUpdated === 0
                        ? '—'
                        : dateFormatter.format(new Date(lastUpdated))}
                </span>
                {displayMode === 'charts' ? (
                    <strong>
                        {(
                            telemetryRecords.data?.records.length ?? 0
                        ).toLocaleString('ru-RU')}{' '}
                        снимков телеметрии
                    </strong>
                ) : (
                    showsRecords && (
                        <strong>{total.toLocaleString('ru-RU')} записей</strong>
                    )
                )}
            </div>

            <div
                className="diagnostics-mode-toggle"
                role="tablist"
                aria-label="Режим отображения"
            >
                <button
                    type="button"
                    className={displayMode === 'logs' ? 'is-active' : ''}
                    onClick={() => setDisplayMode('logs')}
                    role="tab"
                    aria-selected={displayMode === 'logs'}
                >
                    <FileText size={15} /> Логи и события
                </button>
                <button
                    type="button"
                    className={displayMode === 'charts' ? 'is-active' : ''}
                    onClick={() => setDisplayMode('charts')}
                    role="tab"
                    aria-selected={displayMode === 'charts'}
                >
                    <LineChart size={15} /> Графики
                </button>
            </div>

            {error instanceof Error && (
                <ErrorBanner message={error.message} onRetry={refresh} />
            )}
            {actionError && (
                <ErrorBanner
                    message={actionError}
                    onDismiss={() => setActionError(null)}
                />
            )}
            {clearResult && (
                <div className="diagnostics-success" role="status">
                    {clearResult}
                    <button
                        type="button"
                        onClick={() => setClearResult(null)}
                        aria-label="Закрыть уведомление"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {displayMode === 'charts' && (
                <>
                    <form
                        className="diagnostics-filters"
                        onSubmit={applyFilters}
                    >
                        <div className="diagnostics-filters__heading">
                            <div>
                                <Filter size={17} />
                                <strong>Фильтры диапазона</strong>
                                {activeFilterCount > 0 && (
                                    <span>{activeFilterCount}</span>
                                )}
                            </div>
                            <button
                                className="text-link"
                                type="button"
                                onClick={resetFilters}
                            >
                                <RotateCcw size={14} /> Сбросить всё
                            </button>
                        </div>
                        <div className="diagnostics-filter-grid">
                            <label>
                                От
                                <input
                                    type="datetime-local"
                                    value={draftFilters.from}
                                    onChange={(event) =>
                                        setDraftFilters({
                                            ...draftFilters,
                                            from: event.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                До
                                <input
                                    type="datetime-local"
                                    value={draftFilters.to}
                                    onChange={(event) =>
                                        setDraftFilters({
                                            ...draftFilters,
                                            to: event.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                Boot ID
                                <input
                                    value={draftFilters.bootId}
                                    onChange={(event) =>
                                        setDraftFilters({
                                            ...draftFilters,
                                            bootId: event.target.value,
                                        })
                                    }
                                    placeholder="Все загрузки"
                                />
                            </label>
                            <label>
                                Firmware
                                <input
                                    value={draftFilters.firmwareVersion}
                                    onChange={(event) =>
                                        setDraftFilters({
                                            ...draftFilters,
                                            firmwareVersion: event.target.value,
                                        })
                                    }
                                    placeholder="Версия прошивки"
                                />
                            </label>
                            <label>
                                Git SHA
                                <input
                                    value={draftFilters.gitSha}
                                    onChange={(event) =>
                                        setDraftFilters({
                                            ...draftFilters,
                                            gitSha: event.target.value,
                                        })
                                    }
                                    placeholder="Хэш коммита"
                                />
                            </label>
                        </div>
                        <div className="diagnostics-filters__actions">
                            <button
                                className="button button--primary"
                                type="submit"
                            >
                                Применить фильтры
                            </button>
                        </div>
                    </form>

                    {telemetryRecords.isLoading && !telemetryRecords.data ? (
                        <div className="diagnostics-state">
                            <Loader2 className="spin-animation" size={28} />
                            <span>
                                Загрузка данных телеметрии для графиков…
                            </span>
                        </div>
                    ) : (
                        <DiagnosticsChartsView
                            records={telemetryRecords.data?.records ?? []}
                            boots={boots.data?.boots ?? []}
                            allRecords={errorRecords.data?.records ?? []}
                            fromFilter={filters.from}
                            toFilter={filters.to}
                            bootIdFilter={filters.bootId}
                            onTimeRangeChange={handleTimeRangeChange}
                            onBootIdChange={handleBootIdChange}
                        />
                    )}
                </>
            )}

            {displayMode === 'logs' && (
                <>
                    <nav
                        className="diagnostics-tabs"
                        aria-label="Раздел диагностики"
                    >
                        {(
                            [
                                ['records', FileJson, 'Все записи'],
                                ['metrics', Activity, 'Метрики'],
                                ['crashes', AlertTriangle, 'Сбои'],
                                ['boots', ServerCog, 'Загрузки'],
                                ['coredumps', HardDriveDownload, 'Core Dump'],
                            ] as const
                        ).map(([value, Icon, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={view === value ? 'is-active' : ''}
                                onClick={() => selectView(value)}
                            >
                                <Icon size={16} /> {label}
                            </button>
                        ))}
                    </nav>

                    {showsRecords && (
                        <>
                            <form
                                className="diagnostics-filters"
                                onSubmit={applyFilters}
                            >
                                <div className="diagnostics-filters__heading">
                                    <div>
                                        <Filter size={17} />
                                        <strong>Фильтры</strong>
                                        {activeFilterCount > 0 && (
                                            <span>{activeFilterCount}</span>
                                        )}
                                    </div>
                                    <button
                                        className="text-link"
                                        type="button"
                                        onClick={resetFilters}
                                    >
                                        <RotateCcw size={14} /> Сбросить всё
                                    </button>
                                </div>
                                <div className="diagnostics-filter-grid">
                                    <label>
                                        От
                                        <input
                                            type="datetime-local"
                                            value={draftFilters.from}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    from: event.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        До
                                        <input
                                            type="datetime-local"
                                            value={draftFilters.to}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    to: event.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Уровень
                                        <select
                                            value={draftFilters.level}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    level: event.target
                                                        .value as FilterState['level'],
                                                })
                                            }
                                        >
                                            <option value="">Все</option>
                                            {levels.map((level) => (
                                                <option key={level}>
                                                    {level}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Тип
                                        <select
                                            value={draftFilters.type}
                                            disabled={view !== 'records'}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    type: event.target
                                                        .value as FilterState['type'],
                                                })
                                            }
                                        >
                                            <option value="">Все</option>
                                            <option value="log">log</option>
                                            <option value="event">event</option>
                                            <option value="metric">
                                                metric
                                            </option>
                                        </select>
                                    </label>
                                    <label>
                                        Модуль
                                        <input
                                            value={draftFilters.module}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    module: event.target.value,
                                                })
                                            }
                                            placeholder="wifi"
                                        />
                                    </label>
                                    <label>
                                        Источник
                                        <input
                                            value={draftFilters.source}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    source: event.target.value,
                                                })
                                            }
                                            placeholder="esp_log"
                                        />
                                    </label>
                                    <label className="diagnostics-filter--wide">
                                        Поиск в сообщении
                                        <input
                                            value={draftFilters.query}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    query: event.target.value,
                                                })
                                            }
                                            placeholder="Текст сообщения"
                                        />
                                    </label>
                                    <label>
                                        Boot ID
                                        <input
                                            value={draftFilters.bootId}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    bootId: event.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Sequence
                                        <input
                                            type="number"
                                            min="0"
                                            value={draftFilters.sequence}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    sequence:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Firmware
                                        <input
                                            value={draftFilters.firmwareVersion}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    firmwareVersion:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Git SHA
                                        <input
                                            value={draftFilters.gitSha}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    gitSha: event.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Тип события
                                        <input
                                            value={draftFilters.eventType}
                                            disabled={view === 'crashes'}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    eventType:
                                                        event.target.value,
                                                })
                                            }
                                            placeholder="crash"
                                        />
                                    </label>
                                    <label>
                                        Доп. поля
                                        <select
                                            value={draftFilters.hasFields}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    hasFields: event.target
                                                        .value as FilterState['hasFields'],
                                                })
                                            }
                                        >
                                            <option value="">Любые</option>
                                            <option value="true">Есть</option>
                                            <option value="false">Нет</option>
                                        </select>
                                    </label>
                                    <label>
                                        Сортировка
                                        <select
                                            value={draftFilters.sortBy}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    sortBy: event.target
                                                        .value as DiagnosticSortBy,
                                                })
                                            }
                                        >
                                            <option value="received_at">
                                                Получено
                                            </option>
                                            <option value="timestamp">
                                                Время устройства
                                            </option>
                                            <option value="uptime">
                                                Uptime
                                            </option>
                                            <option value="sequence">
                                                Sequence
                                            </option>
                                            <option value="level">
                                                Уровень
                                            </option>
                                            <option value="module">
                                                Модуль
                                            </option>
                                            <option value="type">Тип</option>
                                            <option value="firmware_version">
                                                Firmware
                                            </option>
                                        </select>
                                    </label>
                                    <label>
                                        Направление
                                        <select
                                            value={draftFilters.sortDirection}
                                            onChange={(event) =>
                                                setDraftFilters({
                                                    ...draftFilters,
                                                    sortDirection: event.target
                                                        .value as
                                                        'asc' | 'desc',
                                                })
                                            }
                                        >
                                            <option value="desc">
                                                По убыванию
                                            </option>
                                            <option value="asc">
                                                По возрастанию
                                            </option>
                                        </select>
                                    </label>
                                </div>
                                <div className="diagnostics-filters__actions">
                                    <button
                                        className="button button--primary"
                                        type="submit"
                                    >
                                        Применить фильтры
                                    </button>
                                    <button
                                        className="button button--quiet"
                                        type="button"
                                        disabled={exporting !== null}
                                        onClick={() =>
                                            void exportRecords('json')
                                        }
                                    >
                                        <Download size={14} /> JSON
                                    </button>
                                    <button
                                        className="button button--quiet"
                                        type="button"
                                        disabled={exporting !== null}
                                        onClick={() =>
                                            void exportRecords('csv')
                                        }
                                    >
                                        <Download size={14} /> CSV
                                    </button>
                                </div>
                            </form>

                            {view === 'metrics' && records.data && (
                                <div className="diagnostics-metrics-grid">
                                    {records.data.records.map((record) => (
                                        <button
                                            key={record.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedRecord(record)
                                            }
                                        >
                                            <span>
                                                {record.module ?? 'system'}
                                            </span>
                                            <strong>{record.message}</strong>
                                            <code>
                                                {JSON.stringify(record.fields)}
                                            </code>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <section className="diagnostics-table-panel">
                                {records.isLoading ? (
                                    <div className="diagnostics-state">
                                        <Loader2 className="spin-animation" />
                                        Загрузка диагностики…
                                    </div>
                                ) : records.data?.records.length === 0 ? (
                                    <div className="diagnostics-state">
                                        <FileJson size={30} />
                                        <strong>Записи не найдены</strong>
                                        <span>
                                            Измените фильтры или период поиска.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="diagnostics-table-wrap">
                                        <table className="diagnostics-table">
                                            <thead>
                                                <tr>
                                                    <SortableHeader
                                                        label="Время"
                                                        field="received_at"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                    <SortableHeader
                                                        label="Уровень"
                                                        field="level"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                    <SortableHeader
                                                        label="Тип"
                                                        field="type"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                    <SortableHeader
                                                        label="Подсистема"
                                                        field="module"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                    <th>Сообщение</th>
                                                    <SortableHeader
                                                        label="Uptime"
                                                        field="uptime"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                    <th>Boot ID</th>
                                                    <SortableHeader
                                                        label="Seq."
                                                        field="sequence"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                    <SortableHeader
                                                        label="Firmware"
                                                        field="firmware_version"
                                                        filters={filters}
                                                        onSort={changeSort}
                                                    />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records.data?.records.map(
                                                    (record) => (
                                                        <tr
                                                            key={record.id}
                                                            onClick={() =>
                                                                setSelectedRecord(
                                                                    record,
                                                                )
                                                            }
                                                        >
                                                            <td>
                                                                {formatTimestamp(
                                                                    record.received_at,
                                                                )}
                                                            </td>
                                                            <td>
                                                                <LevelBadge
                                                                    level={
                                                                        record.level
                                                                    }
                                                                />
                                                            </td>
                                                            <td>
                                                                <span className="diagnostics-type">
                                                                    {
                                                                        record.type
                                                                    }
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {record.module ??
                                                                    '—'}
                                                            </td>
                                                            <td
                                                                className="diagnostics-message"
                                                                title={
                                                                    record.message ??
                                                                    ''
                                                                }
                                                            >
                                                                {record.message ||
                                                                    '—'}
                                                            </td>
                                                            <td>
                                                                {formatUptime(
                                                                    record.uptime_ms,
                                                                )}
                                                            </td>
                                                            <td className="diagnostics-mono diagnostics-boot-id">
                                                                {record.boot_id}
                                                            </td>
                                                            <td>
                                                                {
                                                                    record.sequence
                                                                }
                                                            </td>
                                                            <td className="diagnostics-mono">
                                                                {record.firmware_version ??
                                                                    '—'}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className="diagnostics-pagination">
                                    <label>
                                        На странице
                                        <select
                                            value={pageSize}
                                            onChange={(event) => {
                                                setPageSize(
                                                    Number(event.target.value),
                                                )
                                                setPage(0)
                                            }}
                                        >
                                            {[25, 50, 100, 200].map((size) => (
                                                <option key={size}>
                                                    {size}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <span>
                                        {total === 0 ? 0 : page * pageSize + 1}–
                                        {Math.min((page + 1) * pageSize, total)}{' '}
                                        из {total}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page === 0}
                                        onClick={() =>
                                            setPage((value) => value - 1)
                                        }
                                        aria-label="Предыдущая страница"
                                    >
                                        <ChevronLeft size={17} />
                                    </button>
                                    <strong>
                                        {page + 1} / {totalPages}
                                    </strong>
                                    <button
                                        type="button"
                                        disabled={page + 1 >= totalPages}
                                        onClick={() =>
                                            setPage((value) => value + 1)
                                        }
                                        aria-label="Следующая страница"
                                    >
                                        <ChevronRight size={17} />
                                    </button>
                                </div>
                            </section>
                        </>
                    )}

                    {view === 'boots' && (
                        <BootHistory
                            loading={boots.isLoading}
                            boots={boots.data?.boots ?? []}
                            onSelect={selectBoot}
                        />
                    )}

                    {view === 'coredumps' && (
                        <>
                            <div className="diagnostics-inline-filter">
                                <label>
                                    Boot ID
                                    <input
                                        value={draftFilters.bootId}
                                        placeholder="Все загрузки"
                                        onChange={(event) =>
                                            setDraftFilters({
                                                ...draftFilters,
                                                bootId: event.target.value,
                                            })
                                        }
                                    />
                                </label>
                                <button
                                    className="button button--primary"
                                    type="button"
                                    onClick={() =>
                                        setFilters({
                                            ...filters,
                                            bootId: draftFilters.bootId,
                                        })
                                    }
                                >
                                    Применить
                                </button>
                                {filters.bootId && (
                                    <button
                                        className="button button--quiet"
                                        type="button"
                                        onClick={() => {
                                            setFilters({
                                                ...filters,
                                                bootId: '',
                                            })
                                            setDraftFilters({
                                                ...draftFilters,
                                                bootId: '',
                                            })
                                        }}
                                    >
                                        Сбросить
                                    </button>
                                )}
                            </div>
                            <CoredumpList
                                loading={coredumps.isLoading}
                                coredumps={coredumps.data?.coredumps ?? []}
                                onDownload={(dump) =>
                                    void downloadCoredump(dump)
                                }
                            />
                        </>
                    )}
                </>
            )}

            {selectedRecord && (
                <RecordDetails
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
            {showClearConfirmation && (
                <ConfirmDialog
                    title="Очистить все диагностические логи?"
                    message="Все логи, события и метрики будут безвозвратно удалены из SQLite. Сохранённые Core Dump останутся доступны."
                    confirmLabel="Удалить все логи"
                    onConfirm={() => void clearRecords()}
                    onClose={() => setShowClearConfirmation(false)}
                />
            )}
        </div>
    )
}

function SortableHeader({
    label,
    field,
    filters,
    onSort,
}: {
    label: string
    field: DiagnosticSortBy
    filters: FilterState
    onSort: (field: DiagnosticSortBy) => void
}) {
    const active = filters.sortBy === field
    return (
        <th>
            <button type="button" onClick={() => onSort(field)}>
                {label}
                {active &&
                    (filters.sortDirection === 'desc' ? (
                        <ArrowDown size={12} />
                    ) : (
                        <ArrowUp size={12} />
                    ))}
            </button>
        </th>
    )
}

function BootHistory({
    loading,
    boots,
    onSelect,
}: {
    loading: boolean
    boots: Awaited<ReturnType<typeof api.diagnostics.boots>>['boots']
    onSelect: (bootId: string) => void
}) {
    if (loading)
        return (
            <div className="diagnostics-state">
                <Loader2 className="spin-animation" />
                Загрузка истории…
            </div>
        )
    if (boots.length === 0)
        return (
            <div className="diagnostics-state">
                <ServerCog size={30} />
                <strong>Загрузок пока нет</strong>
            </div>
        )
    return (
        <section className="diagnostics-list-panel">
            <div className="diagnostics-table-wrap">
                <table className="diagnostics-table">
                    <thead>
                        <tr>
                            <th>Boot ID</th>
                            <th>Устройство</th>
                            <th>Firmware</th>
                            <th>Первый пакет</th>
                            <th>Последний пакет</th>
                            <th>Записей</th>
                        </tr>
                    </thead>
                    <tbody>
                        {boots.map((boot) => (
                            <tr
                                key={`${boot.device_id}:${boot.boot_id}`}
                                onClick={() => onSelect(boot.boot_id)}
                            >
                                <td className="diagnostics-mono">
                                    {boot.boot_id}
                                </td>
                                <td>{boot.device_id}</td>
                                <td className="diagnostics-mono">
                                    {boot.firmware_version ?? '—'}
                                </td>
                                <td>
                                    {formatTimestamp(boot.first_received_at)}
                                </td>
                                <td>
                                    {formatTimestamp(boot.last_received_at)}
                                </td>
                                <td>{boot.record_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

function CoredumpList({
    loading,
    coredumps,
    onDownload,
}: {
    loading: boolean
    coredumps: DiagnosticCoredump[]
    onDownload: (dump: DiagnosticCoredump) => void
}) {
    if (loading)
        return (
            <div className="diagnostics-state">
                <Loader2 className="spin-animation" />
                Загрузка Core Dump…
            </div>
        )
    if (coredumps.length === 0)
        return (
            <div className="diagnostics-state">
                <HardDriveDownload size={30} />
                <strong>Core Dump не найдены</strong>
            </div>
        )
    return (
        <section className="diagnostics-list-panel">
            <div className="diagnostics-table-wrap">
                <table className="diagnostics-table">
                    <thead>
                        <tr>
                            <th>Получен</th>
                            <th>Dump ID</th>
                            <th>Boot ID</th>
                            <th>Firmware</th>
                            <th>Размер</th>
                            <th>SHA-256</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {coredumps.map((dump) => (
                            <tr key={dump.id}>
                                <td>{formatTimestamp(dump.received_at)}</td>
                                <td className="diagnostics-mono">
                                    {dump.dump_id}
                                </td>
                                <td className="diagnostics-mono">
                                    {dump.boot_id}
                                </td>
                                <td>{dump.firmware_version ?? '—'}</td>
                                <td>
                                    {(dump.file_size / 1024).toFixed(1)} KiB
                                </td>
                                <td className="diagnostics-mono diagnostics-sha">
                                    {dump.sha256}
                                </td>
                                <td>
                                    <button
                                        className="button button--quiet button--small"
                                        type="button"
                                        onClick={() => onDownload(dump)}
                                    >
                                        <Download size={14} /> Скачать
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
