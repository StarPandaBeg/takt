import {
    Activity,
    Calendar,
    Cpu,
    HardDrive,
    Layers,
    ShieldAlert,
    Wifi,
} from 'lucide-react'
import { useMemo } from 'react'
import type { DiagnosticBoot, DiagnosticRecord } from '../../types/api'
import { SummaryCards } from './summary-cards'
import {
    computeSummaryMetrics,
    formatResetReason,
    processTelemetryRecords,
} from './telemetry-processor'
import { TimeSeriesChart } from './time-series-chart'
import type { ChartSeries } from './types'

interface DiagnosticsChartsViewProps {
    records: DiagnosticRecord[]
    boots: DiagnosticBoot[]
    allRecords?: DiagnosticRecord[]
    fromFilter: string
    toFilter: string
    bootIdFilter: string
    onTimeRangeChange: (from: string, to: string) => void
    onBootIdChange: (bootId: string) => void
}

function toLocalIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const h = pad(date.getHours())
    const min = pad(date.getMinutes())
    return `${y}-${m}-${d}T${h}:${min}`
}

function bytesToKiB(bytes: number | null | undefined): number | null {
    if (bytes === null || bytes === undefined) return null
    return Math.round((bytes / 1024) * 10) / 10
}

function bytesToMiB(bytes: number | null | undefined): number | null {
    if (bytes === null || bytes === undefined) return null
    return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

function msToSeconds(ms: number | null | undefined): number | null {
    if (ms === null || ms === undefined) return null
    return Math.round((ms / 1000) * 100) / 100
}

function msToHours(ms: number | null | undefined): number | null {
    if (ms === null || ms === undefined) return null
    return Math.round((ms / 3600000) * 10) / 10
}

export function DiagnosticsChartsView({
    records,
    boots,
    allRecords = [],
    fromFilter,
    toFilter,
    bootIdFilter,
    onTimeRangeChange,
    onBootIdChange,
}: DiagnosticsChartsViewProps) {
    // 1. Нормализация и расчет производных метрик
    const points = useMemo(() => processTelemetryRecords(records), [records])

    // 2. Расчет ключевых KPI сводки
    const summary = useMemo(
        () =>
            computeSummaryMetrics(
                points,
                allRecords.length > 0 ? allRecords : records,
                boots,
            ),
        [points, allRecords, records, boots],
    )

    // Быстрые пресеты времени
    const setQuickRange = (hours: number | null) => {
        if (hours === null) {
            onTimeRangeChange('', '')
            return
        }
        const now = new Date()
        const from = new Date(now.getTime() - hours * 3600 * 1000)
        onTimeRangeChange(toLocalIso(from), toLocalIso(now))
    }

    // --- Серии графиков ---

    // Память: Heap
    const heapSeries: ChartSeries[] = [
        {
            id: 'free_heap',
            name: 'Free Heap',
            color: '#687c67', // sage
            unit: 'KiB',
            getValue: (p) => bytesToKiB(p.metrics.free_heap),
            formatter: (v) => `${v.toLocaleString('ru-RU')} KiB`,
        },
        {
            id: 'min_free_heap',
            name: 'Min Free Heap',
            color: '#c97f36', // amber
            unit: 'KiB',
            getValue: (p) => bytesToKiB(p.metrics.minimum_free_heap),
            formatter: (v) => `${v.toLocaleString('ru-RU')} KiB`,
        },
        {
            id: 'largest_block',
            name: 'Largest Free Block',
            color: '#607c87', // blue
            unit: 'KiB',
            getValue: (p) => bytesToKiB(p.metrics.largest_free_block),
            formatter: (v) => `${v.toLocaleString('ru-RU')} KiB`,
        },
    ]

    // Память: PSRAM
    const psramSeries: ChartSeries[] = [
        {
            id: 'free_psram',
            name: 'Free PSRAM',
            color: '#785b88',
            unit: 'MiB',
            type: 'area',
            getValue: (p) => bytesToMiB(p.metrics.free_psram),
            formatter: (v) => `${v} MiB`,
        },
    ]

    // Память: Heap Fragmentation
    const fragmentationSeries: ChartSeries[] = [
        {
            id: 'heap_frag',
            name: 'Heap Fragmentation',
            color: '#b94339',
            unit: '%',
            getValue: (p) => p.heap_fragmentation_pct,
            formatter: (v) => `${v}%`,
        },
    ]

    // Система: Температура CPU
    const cpuTempSeries: ChartSeries[] = [
        {
            id: 'cpu_temp',
            name: 'CPU Temperature',
            color: '#b94339',
            unit: '°C',
            getValue: (p) =>
                p.metrics.cpu_temperature_valid !== 0
                    ? p.metrics.cpu_temperature_c
                    : null,
            formatter: (v) => `${v.toFixed(1)} °C`,
        },
    ]

    // Система: Stack Watermark
    const stackSeries: ChartSeries[] = [
        {
            id: 'stack_watermark',
            name: 'Min Stack Watermark',
            color: '#687c67',
            unit: 'Bytes',
            getValue: (p) => p.metrics.minimum_stack_watermark,
            formatter: (v) => `${v} B`,
        },
    ]

    // Система: Uptime
    const uptimeSeries: ChartSeries[] = [
        {
            id: 'uptime',
            name: 'Uptime',
            color: '#607c87',
            unit: 'часов',
            type: 'area',
            getValue: (p) => msToHours(p.uptime_ms),
            formatter: (v) => `${v} ч`,
        },
    ]

    // Сеть: Wi-Fi RSSI
    const rssiSeries: ChartSeries[] = [
        {
            id: 'wifi_rssi',
            name: 'Wi-Fi RSSI',
            color: '#607c87',
            unit: 'dBm',
            getValue: (p) => p.metrics.wifi_rssi,
            formatter: (v) => `${v} dBm`,
        },
    ]

    // Сеть: HTTP Requests
    const httpRequestsSeries: ChartSeries[] = [
        {
            id: 'http_requests_total',
            name: 'Всего запросов (накопленно)',
            color: '#687c67',
            unit: 'запр.',
            getValue: (p) => p.metrics.http_requests,
        },
        {
            id: 'http_req_per_min',
            name: 'Запросов в минуту',
            color: '#9d5647',
            unit: 'запр/мин',
            type: 'bar',
            getValue: (p) => p.http_requests_per_min,
            formatter: (v) => `${v}/мин`,
        },
    ]

    // Сеть: HTTP Errors & Timeouts
    const httpErrorsSeries: ChartSeries[] = [
        {
            id: 'http_errors',
            name: 'HTTP Ошибки',
            color: '#b94339',
            unit: 'ошибок',
            getValue: (p) => p.metrics.http_errors,
        },
        {
            id: 'http_timeouts',
            name: 'HTTP Таймауты',
            color: '#c97f36',
            unit: 'таймаутов',
            getValue: (p) => p.metrics.http_timeouts,
        },
        {
            id: 'http_errors_per_min',
            name: 'Ошибок в минуту',
            color: '#b94339',
            unit: 'ош/мин',
            type: 'bar',
            getValue: (p) => p.http_errors_per_min,
            formatter: (v) => `${v}/мин`,
        },
    ]

    // Сеть: HTTP Error Rate (%)
    const httpErrorRateSeries: ChartSeries[] = [
        {
            id: 'http_error_rate',
            name: 'HTTP Error Rate',
            color: '#b94339',
            unit: '%',
            getValue: (p) => p.http_error_rate_pct,
            formatter: (v) => `${v}%`,
        },
    ]

    // Синхронизация: Длительность
    const syncDurationSeries: ChartSeries[] = [
        {
            id: 'sync_duration',
            name: 'Sync Duration',
            color: '#687c67',
            unit: 'с',
            getValue: (p) => msToSeconds(p.metrics.sync_duration_ms),
            formatter: (v) => `${v} с`,
        },
    ]

    // Синхронизация: Успешные & Rate
    const syncSuccessesSeries: ChartSeries[] = [
        {
            id: 'sync_successes',
            name: 'Успешные синхронизации',
            color: '#607c87',
            unit: 'шт',
            getValue: (p) => p.metrics.sync_successes,
        },
        {
            id: 'syncs_per_hour',
            name: 'Синхронизаций в час',
            color: '#687c67',
            unit: 'в час',
            type: 'bar',
            getValue: (p) => p.syncs_per_hour,
            formatter: (v) => `${v}/ч`,
        },
    ]

    // E-paper: Обновления
    const epaperUpdatesSeries: ChartSeries[] = [
        {
            id: 'epaper_updates',
            name: 'Всего обновлений',
            color: '#252724',
            unit: 'шт',
            getValue: (p) => p.metrics.epaper_updates,
        },
    ]

    // E-paper: Full vs Partial
    const epaperFullPartialSeries: ChartSeries[] = [
        {
            id: 'epaper_full',
            name: 'Full Updates',
            color: '#9d5647',
            unit: 'шт',
            getValue: (p) => p.metrics.epaper_full_updates,
        },
        {
            id: 'epaper_partial',
            name: 'Partial Updates',
            color: '#687c67',
            unit: 'шт',
            getValue: (p) => p.metrics.epaper_partial_updates,
        },
    ]

    // E-paper: Partial Ratio (%)
    const epaperRatioSeries: ChartSeries[] = [
        {
            id: 'epaper_partial_ratio',
            name: 'Partial Ratio',
            color: '#687c67',
            unit: '%',
            type: 'area',
            getValue: (p) => p.partial_update_ratio_pct,
            formatter: (v) => `${v}%`,
        },
    ]

    // E-paper: Длительность обновления
    const epaperDurationSeries: ChartSeries[] = [
        {
            id: 'epaper_duration',
            name: 'E-paper Duration',
            color: '#607c87',
            unit: 'с',
            getValue: (p) => msToSeconds(p.metrics.epaper_duration_ms),
            formatter: (v) => `${v} с`,
        },
    ]

    // Надёжность: Потерянные записи
    const lostRecordsSeries: ChartSeries[] = [
        {
            id: 'storage_lost',
            name: 'Lost Records (Всего)',
            color: '#b94339',
            unit: 'шт',
            getValue: (p) => p.metrics.storage_lost_records,
        },
        {
            id: 'lost_delta',
            name: 'Прирост потерь (Δ)',
            color: '#c97f36',
            unit: 'шт',
            type: 'bar',
            getValue: (p) => p.lost_records_delta,
        },
    ]

    // Извлечение истории перезагрузок с причинами (Reset Reasons)
    const resetEvents = useMemo(() => {
        const events: {
            bootId: string
            timestamp: number
            reason?: number
            firmware?: string | null
            sequence: number
            uptimeMs: number | null
        }[] = []

        const seenBootIds = new Set<string>()

        // Сначала берем первую точку каждого boot_id из телеметрии
        for (const pt of points) {
            if (!seenBootIds.has(pt.boot_id)) {
                seenBootIds.add(pt.boot_id)
                events.push({
                    bootId: pt.boot_id,
                    timestamp: pt.timestamp,
                    reason: pt.metrics.reset_reason,
                    firmware: pt.firmware_version,
                    sequence: pt.sequence,
                    uptimeMs: pt.uptime_ms,
                })
            }
        }

        // Также добавляем boots, если их нет в точках
        for (const b of boots) {
            if (!seenBootIds.has(b.boot_id)) {
                seenBootIds.add(b.boot_id)
                events.push({
                    bootId: b.boot_id,
                    timestamp: b.first_received_at,
                    firmware: b.firmware_version,
                    sequence: 0,
                    uptimeMs: null,
                })
            }
        }

        return events.sort((a, b) => b.timestamp - a.timestamp)
    }, [points, boots])

    return (
        <div className="takt-diagnostics-charts">
            {/* Панель быстрого диапазона времени */}
            <div className="takt-charts-toolbar">
                <div className="takt-charts-quick-ranges">
                    <span className="takt-charts-quick-ranges__label">
                        <Calendar size={14} /> Период:
                    </span>
                    <button
                        type="button"
                        className="takt-quick-btn"
                        onClick={() => setQuickRange(1)}
                    >
                        1 час
                    </button>
                    <button
                        type="button"
                        className="takt-quick-btn"
                        onClick={() => setQuickRange(6)}
                    >
                        6 часов
                    </button>
                    <button
                        type="button"
                        className="takt-quick-btn"
                        onClick={() => setQuickRange(24)}
                    >
                        24 часа
                    </button>
                    <button
                        type="button"
                        className="takt-quick-btn"
                        onClick={() => setQuickRange(24 * 3)}
                    >
                        3 дня
                    </button>
                    <button
                        type="button"
                        className="takt-quick-btn"
                        onClick={() => setQuickRange(24 * 7)}
                    >
                        7 дней
                    </button>
                    <button
                        type="button"
                        className="takt-quick-btn"
                        onClick={() => setQuickRange(null)}
                    >
                        Всё время
                    </button>
                    {(fromFilter || toFilter) && (
                        <span className="eyebrow" style={{ marginLeft: 8 }}>
                            Интервал: {fromFilter || '…'} — {toFilter || '…'}
                        </span>
                    )}
                </div>

                {bootIdFilter && (
                    <div className="takt-charts-boot-badge">
                        <span>Фильтр Boot: {bootIdFilter.slice(0, 10)}…</span>
                        <button
                            type="button"
                            onClick={() => onBootIdChange('')}
                            title="Снять фильтр по Boot ID"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>

            {/* Карточки ключевых показателей (KPI & производные метрики) */}
            <SummaryCards summary={summary} />

            {/* Секция 1: Память */}
            <section className="takt-charts-section">
                <div className="takt-charts-section__header">
                    <div className="takt-charts-section__title-wrap">
                        <HardDrive
                            size={18}
                            className="takt-charts-section__icon"
                        />
                        <div>
                            <h2>Память (SRAM & PSRAM)</h2>
                            <p className="takt-charts-section__desc">
                                Контроль утечек оперативной памяти, фрагментации
                                кучи и внешнего пула PSRAM (8 MB)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="takt-charts-grid takt-charts-grid--2col">
                    <TimeSeriesChart
                        title="Free Heap, Minimum Free Heap & Largest Free Block"
                        description="Динамика свободной кучи, исторического минимума с момента загрузки и наибольшего непрерывного блока"
                        points={points}
                        series={heapSeries}
                        formatY={(v) => `${v.toLocaleString('ru-RU')} KiB`}
                    />
                    <TimeSeriesChart
                        title="Heap Fragmentation (%)"
                        description="Степень фрагментации кучи (1 - Largest Block / Free Heap) × 100%. Рост выше 40% опасен сбоями аллокации"
                        points={points}
                        series={fragmentationSeries}
                        yMin={0}
                        yMax={100}
                        thresholds={[
                            { value: 45, label: 'Порог 45%', color: '#b94339' },
                            { value: 25, label: 'Норма 25%', color: '#c97f36' },
                        ]}
                        formatY={(v) => `${v}%`}
                    />
                    <TimeSeriesChart
                        title="Free PSRAM (Внешняя память)"
                        description="Доступный объём внешней псевдостатической памяти PSRAM для кадровых буферов e-paper"
                        points={points}
                        series={psramSeries}
                        formatY={(v) => `${v} MiB`}
                    />
                </div>
            </section>

            {/* Секция 2: Система */}
            <section className="takt-charts-section">
                <div className="takt-charts-section__header">
                    <div className="takt-charts-section__title-wrap">
                        <Cpu size={18} className="takt-charts-section__icon" />
                        <div>
                            <h2>Система & FreeRTOS</h2>
                            <p className="takt-charts-section__desc">
                                Температура процессора ESP32-S3, минимальный
                                запас стека задач и время непрерывной работы
                            </p>
                        </div>
                    </div>
                </div>

                <div className="takt-charts-grid takt-charts-grid--3col">
                    <TimeSeriesChart
                        title="CPU Temperature"
                        description="Внутренний датчик температуры чипа ESP32-S3 (°C)"
                        points={points}
                        series={cpuTempSeries}
                        thresholds={[
                            {
                                value: 70,
                                label: 'Нагрев 70°C',
                                color: '#b94339',
                            },
                        ]}
                        formatY={(v) => `${v.toFixed(0)} °C`}
                    />
                    <TimeSeriesChart
                        title="Minimum Stack Watermark"
                        description="Минимальный свободный остаток стека FreeRTOS. Значения < 256 B требуют расширения стека задачи"
                        points={points}
                        series={stackSeries}
                        thresholds={[
                            {
                                value: 300,
                                label: 'Порог 300 B',
                                color: '#b94339',
                            },
                        ]}
                        formatY={(v) => `${v} B`}
                    />
                    <TimeSeriesChart
                        title="Uptime (Время непрерывной работы)"
                        description="Непрерывное время работы устройства в часах. Сброс графика обозначает перезапуск устройства"
                        points={points}
                        series={uptimeSeries}
                        yMin={0}
                        formatY={(v) => `${v} ч`}
                    />
                </div>
            </section>

            {/* Секция 3: Сеть Wi-Fi & HTTP */}
            <section className="takt-charts-section">
                <div className="takt-charts-section__header">
                    <div className="takt-charts-section__title-wrap">
                        <Wifi size={18} className="takt-charts-section__icon" />
                        <div>
                            <h2>Сеть Wi-Fi & HTTP</h2>
                            <p className="takt-charts-section__desc">
                                Мощность беспроводного сигнала, частота сетевых
                                запросов к серверу и процент ошибок
                            </p>
                        </div>
                    </div>
                </div>

                <div className="takt-charts-grid takt-charts-grid--2col">
                    <TimeSeriesChart
                        title="Wi-Fi RSSI (Уровень сигнала)"
                        description="Мощность сигнала Wi-Fi (dBm). Значения ниже -80 dBm приводят к потерям пакетов и таймаутам"
                        points={points}
                        series={rssiSeries}
                        thresholds={[
                            {
                                value: -65,
                                label: 'Отлично (-65)',
                                color: '#687c67',
                                lineStyle: 'solid',
                            },
                            {
                                value: -78,
                                label: 'Слабый (-78)',
                                color: '#c97f36',
                            },
                            {
                                value: -85,
                                label: 'Критично (-85)',
                                color: '#b94339',
                            },
                        ]}
                        formatY={(v) => `${v} dBm`}
                    />
                    <TimeSeriesChart
                        title="HTTP Requests (Всего & Поток/мин)"
                        description="Счётчик отправленных устройством HTTP запросов и интенсивность обмена в минуту"
                        points={points}
                        series={httpRequestsSeries}
                    />
                    <TimeSeriesChart
                        title="HTTP Errors & Timeouts"
                        description="Ошибки соединения, сбои DNS, таймауты и скорость появления ошибок в минуту"
                        points={points}
                        series={httpErrorsSeries}
                    />
                    <TimeSeriesChart
                        title="HTTP Error Rate (%)"
                        description="Процент неудачных HTTP запросов. Должен стремиться к 0%"
                        points={points}
                        series={httpErrorRateSeries}
                        yMin={0}
                        yMax={100}
                        thresholds={[
                            {
                                value: 5,
                                label: '5% предупреждение',
                                color: '#c97f36',
                            },
                            {
                                value: 15,
                                label: '15% критично',
                                color: '#b94339',
                            },
                        ]}
                        formatY={(v) => `${v}%`}
                    />
                </div>
            </section>

            {/* Секция 4: Синхронизация */}
            <section className="takt-charts-section">
                <div className="takt-charts-section__header">
                    <div className="takt-charts-section__title-wrap">
                        <Activity
                            size={18}
                            className="takt-charts-section__icon"
                        />
                        <div>
                            <h2>Синхронизация данных</h2>
                            <p className="takt-charts-section__desc">
                                Длительность сеансов загрузки расписания и
                                количество успешных синхронизаций с сервером
                            </p>
                        </div>
                    </div>
                </div>

                <div className="takt-charts-grid takt-charts-grid--2col">
                    <TimeSeriesChart
                        title="Sync Duration (Продолжительность)"
                        description="Время полного цикла опроса и применения синхронизации (в секундах)"
                        points={points}
                        series={syncDurationSeries}
                        formatY={(v) => `${v} с`}
                    />
                    <TimeSeriesChart
                        title="Sync Successes & Частота в час"
                        description="Успешные синхронизации календаря и заметок, а также средняя частота в час"
                        points={points}
                        series={syncSuccessesSeries}
                    />
                </div>
            </section>

            {/* Секция 5: E-paper дисплей */}
            <section className="takt-charts-section">
                <div className="takt-charts-section__header">
                    <div className="takt-charts-section__title-wrap">
                        <Layers
                            size={18}
                            className="takt-charts-section__icon"
                        />
                        <div>
                            <h2>E-paper дисплей (GDEY075T7)</h2>
                            <p className="takt-charts-section__desc">
                                Анализ циклов перерисовки экрана, соотношение
                                полных и быстрых частичных обновлений
                            </p>
                        </div>
                    </div>
                </div>

                <div className="takt-charts-grid takt-charts-grid--2col">
                    <TimeSeriesChart
                        title="Full Updates vs Partial Updates"
                        description="Сравнение полных перерисовок (очистка экрана от остаточного изображения) и быстрых частичных обновлений"
                        points={points}
                        series={epaperFullPartialSeries}
                    />
                    <TimeSeriesChart
                        title="Partial Update Ratio (%)"
                        description="Доля частичных обновлений в общем числе перерисовок дисплея"
                        points={points}
                        series={epaperRatioSeries}
                        yMin={0}
                        yMax={100}
                        formatY={(v) => `${v}%`}
                    />
                    <TimeSeriesChart
                        title="E-paper Duration (Время перерисовки)"
                        description="Аппаратное время вывода кадра контроллером DESPI-C02 на экран (в секундах)"
                        points={points}
                        series={epaperDurationSeries}
                        formatY={(v) => `${v} с`}
                    />
                    <TimeSeriesChart
                        title="Всего обновлений экрана"
                        description="Суммарное количество циклов перерисовки дисплея с момента старта"
                        points={points}
                        series={epaperUpdatesSeries}
                    />
                </div>
            </section>

            {/* Секция 6: Надёжность и сбои */}
            <section className="takt-charts-section">
                <div className="takt-charts-section__header">
                    <div className="takt-charts-section__title-wrap">
                        <ShieldAlert
                            size={18}
                            className="takt-charts-section__icon"
                        />
                        <div>
                            <h2>Надёжность, перезагрузки & сбои</h2>
                            <p className="takt-charts-section__desc">
                                Причины перезапуска ESP-IDF, распределение
                                ошибок по подсистемам и потери записей в
                                хранилище
                            </p>
                        </div>
                    </div>
                </div>

                <div className="takt-charts-grid takt-charts-grid--2col">
                    {/* Потери записей */}
                    <TimeSeriesChart
                        title="Lost Records & Прирост потерь (Δ)"
                        description="Количество потерянных диагностических записей при переполнении буфера SPIFFS флеш-памяти"
                        points={points}
                        series={lostRecordsSeries}
                    />

                    {/* Распределение ошибок по подсистемам */}
                    <div className="takt-chart-card">
                        <header className="takt-chart-card__header">
                            <div>
                                <h3 className="takt-chart-card__title">
                                    Распределение ошибок по подсистемам
                                </h3>
                                <p className="takt-chart-card__description">
                                    Количество событий ERROR и CRITICAL,
                                    сгруппированных по модулям устройства
                                </p>
                            </div>
                        </header>
                        <div className="takt-error-distribution-wrap">
                            {Object.keys(summary.errorCountByModule).length ===
                            0 ? (
                                <div className="takt-chart-empty">
                                    <span>
                                        В выбранном периоде ошибок не
                                        зарегистрировано
                                    </span>
                                </div>
                            ) : (
                                <div className="takt-error-module-list">
                                    {Object.entries(summary.errorCountByModule)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([mod, count]) => {
                                            const totalErr =
                                                summary.totalErrorLogs +
                                                    summary.totalCriticalLogs ||
                                                1
                                            const pct = Math.round(
                                                (count / totalErr) * 100,
                                            )
                                            return (
                                                <div
                                                    key={mod}
                                                    className="takt-error-module-row"
                                                >
                                                    <div className="takt-error-module-row__info">
                                                        <strong>{mod}</strong>
                                                        <span>
                                                            {count} событий (
                                                            {pct}%)
                                                        </span>
                                                    </div>
                                                    <div className="takt-error-module-row__bar-bg">
                                                        <div
                                                            className="takt-error-module-row__bar-fill"
                                                            style={{
                                                                width: `${pct}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* История перезагрузок с кодами Reset Reasons */}
                <div className="takt-chart-card takt-mt-16">
                    <header className="takt-chart-card__header">
                        <div>
                            <h3 className="takt-chart-card__title">
                                История перезапусков устройства & Reset Reasons
                            </h3>
                            <p className="takt-chart-card__description">
                                Расшифровка аппаратных и программных причин
                                сброса ядра ESP32-S3 (esp_reset_reason_t)
                            </p>
                        </div>
                        <span className="eyebrow">
                            Всего сессий: {resetEvents.length}
                        </span>
                    </header>
                    <div className="takt-reset-history-table-wrap">
                        {resetEvents.length === 0 ? (
                            <div className="takt-chart-empty">
                                <span>Нет записей о перезагрузках</span>
                            </div>
                        ) : (
                            <table className="diagnostics-table">
                                <thead>
                                    <tr>
                                        <th>Время старта</th>
                                        <th>Boot ID</th>
                                        <th>Причина сброса (ESP-IDF)</th>
                                        <th>Описание</th>
                                        <th>Firmware</th>
                                        <th>Действие</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resetEvents.slice(0, 15).map((evt) => {
                                        const reasonInfo = formatResetReason(
                                            evt.reason,
                                        )
                                        const isSelected =
                                            bootIdFilter === evt.bootId
                                        return (
                                            <tr
                                                key={evt.bootId}
                                                className={
                                                    isSelected
                                                        ? 'is-selected'
                                                        : ''
                                                }
                                            >
                                                <td>
                                                    {new Date(
                                                        evt.timestamp,
                                                    ).toLocaleString('ru-RU')}
                                                </td>
                                                <td className="diagnostics-mono">
                                                    {evt.bootId}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`takt-badge takt-badge--${reasonInfo.severity}`}
                                                    >
                                                        {reasonInfo.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {reasonInfo.description}
                                                </td>
                                                <td className="diagnostics-mono">
                                                    {evt.firmware ?? '—'}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="button button--quiet button--small"
                                                        onClick={() =>
                                                            onBootIdChange(
                                                                isSelected
                                                                    ? ''
                                                                    : evt.bootId,
                                                            )
                                                        }
                                                    >
                                                        {isSelected
                                                            ? 'Сбросить фильтр'
                                                            : 'Изолировать Boot'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
