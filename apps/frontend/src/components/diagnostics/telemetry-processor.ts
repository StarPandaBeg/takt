import type { DiagnosticBoot, DiagnosticRecord } from '../../types/api'
import type { SummaryMetrics, TelemetryPoint, TelemetrySnapshot } from './types'

export const RESET_REASONS: Record<
    number,
    { name: string; description: string; severity: 'normal' | 'warn' | 'error' }
> = {
    1: {
        name: 'POWERON',
        description: 'Включение питания (холодный старт)',
        severity: 'normal',
    },
    2: {
        name: 'EXT',
        description: 'Внешний аппаратный сброс (Reset pin)',
        severity: 'warn',
    },
    3: {
        name: 'SW',
        description: 'Программный перезапуск (esp_restart)',
        severity: 'normal',
    },
    4: {
        name: 'PANIC',
        description: 'Сбой ядра / исключение процессора',
        severity: 'error',
    },
    5: {
        name: 'INT_WDT',
        description: 'Сторожевой таймер прерываний (Interrupt WDT)',
        severity: 'error',
    },
    6: {
        name: 'TASK_WDT',
        description: 'Сторожевой таймер задачи FreeRTOS (Task WDT)',
        severity: 'error',
    },
    7: {
        name: 'WDT',
        description: 'Аппаратный сторожевой таймер',
        severity: 'error',
    },
    8: {
        name: 'DEEPSLEEP',
        description: 'Пробуждение из глубокого сна',
        severity: 'normal',
    },
    9: {
        name: 'BROWNOUT',
        description: 'Падение напряжения питания (Brownout)',
        severity: 'error',
    },
    10: {
        name: 'SDIO',
        description: 'Сброс через интерфейс SDIO',
        severity: 'warn',
    },
    11: {
        name: 'SW_CPU',
        description: 'Программный сброс ядра CPU',
        severity: 'warn',
    },
}

export function formatResetReason(reason?: number): {
    label: string
    description: string
    severity: 'normal' | 'warn' | 'error'
} {
    if (reason === undefined || reason === null) {
        return {
            label: 'Неизвестно',
            description: 'Причина перезагрузки не указана',
            severity: 'warn',
        }
    }
    const found = RESET_REASONS[reason]
    if (found) {
        return {
            label: `${found.name} (${reason})`,
            description: found.description,
            severity: found.severity,
        }
    }
    return {
        label: `Код ${reason}`,
        description: 'Специфическая причина перезагрузки',
        severity: 'warn',
    }
}

export function extractSnapshot(
    record: DiagnosticRecord,
): TelemetrySnapshot | null {
    let raw: Record<string, unknown> | null = null
    if (
        record.fields &&
        typeof record.fields === 'object' &&
        Object.keys(record.fields).length > 0
    ) {
        raw = record.fields
    } else if (
        'fields_json' in record &&
        typeof (record as { fields_json?: unknown }).fields_json === 'string'
    ) {
        try {
            raw = JSON.parse(
                (record as { fields_json: string }).fields_json,
            ) as Record<string, unknown>
        } catch {
            raw = null
        }
    }

    if (!raw) return null

    // Проверяем, есть ли хотя бы одно поле телеметрии
    const hasMetricKey =
        'free_heap' in raw ||
        'cpu_temperature_c' in raw ||
        'wifi_rssi' in raw ||
        'http_requests' in raw ||
        'epaper_updates' in raw ||
        'sync_duration_ms' in raw ||
        'storage_lost_records' in raw ||
        'reset_reason' in raw ||
        'minimum_stack_watermark' in raw

    if (!hasMetricKey) return null

    const asNumber = (val: unknown): number | undefined =>
        typeof val === 'number' && !Number.isNaN(val) ? val : undefined

    return {
        reset_reason: asNumber(raw.reset_reason),
        free_heap: asNumber(raw.free_heap),
        minimum_free_heap: asNumber(raw.minimum_free_heap),
        largest_free_block: asNumber(raw.largest_free_block),
        free_psram: asNumber(raw.free_psram),
        cpu_temperature_c: asNumber(raw.cpu_temperature_c),
        cpu_temperature_valid: asNumber(raw.cpu_temperature_valid),
        minimum_stack_watermark: asNumber(raw.minimum_stack_watermark),
        wifi_rssi: asNumber(raw.wifi_rssi),
        http_requests: asNumber(raw.http_requests),
        http_errors: asNumber(raw.http_errors),
        http_timeouts: asNumber(raw.http_timeouts),
        sync_successes: asNumber(raw.sync_successes),
        sync_duration_ms: asNumber(raw.sync_duration_ms),
        epaper_updates: asNumber(raw.epaper_updates),
        epaper_duration_ms: asNumber(raw.epaper_duration_ms),
        epaper_full_updates: asNumber(raw.epaper_full_updates),
        epaper_partial_updates: asNumber(raw.epaper_partial_updates),
        storage_lost_records: asNumber(raw.storage_lost_records),
    }
}

/**
 * Обрабатывает сырые записи диагностики и возвращает упорядоченный список точек телеметрии с производными метриками.
 * Корректно разделяет точки по boot_id и начинает расчет накопительных метрик заново.
 */
export function processTelemetryRecords(
    records: DiagnosticRecord[],
): TelemetryPoint[] {
    const rawPoints: TelemetryPoint[] = []

    for (const record of records) {
        const snapshot = extractSnapshot(record)
        if (!snapshot) continue

        const timestamp =
            record.timestamp_unix_ms && record.timestamp_unix_ms > 0
                ? record.timestamp_unix_ms
                : record.received_at

        rawPoints.push({
            id: record.id,
            timestamp,
            uptime_ms: record.uptime_ms,
            boot_id: record.boot_id,
            sequence: record.sequence,
            firmware_version: record.firmware_version,
            git_sha: record.git_sha,
            metrics: snapshot,
        })
    }

    // Сортировка по времени по возрастанию
    rawPoints.sort((a, b) => a.timestamp - b.timestamp)

    // Расчет производных метрик
    const result: TelemetryPoint[] = []

    for (let i = 0; i < rawPoints.length; i++) {
        const curr = rawPoints[i]
        const prev = i > 0 ? rawPoints[i - 1] : null

        // 1. Фрагментация Heap (%) = (1 - largest_free_block / free_heap) * 100
        let heap_fragmentation_pct: number | null = null
        if (
            curr.metrics.free_heap !== undefined &&
            curr.metrics.free_heap > 0 &&
            curr.metrics.largest_free_block !== undefined
        ) {
            const frag =
                (1 - curr.metrics.largest_free_block / curr.metrics.free_heap) *
                100
            heap_fragmentation_pct = Math.max(
                0,
                Math.min(100, Math.round(frag * 10) / 10),
            )
        }

        // 2. Partial Update Ratio (%)
        let partial_update_ratio_pct: number | null = null
        if (
            curr.metrics.epaper_partial_updates !== undefined &&
            curr.metrics.epaper_updates !== undefined &&
            curr.metrics.epaper_updates > 0
        ) {
            const ratio =
                (curr.metrics.epaper_partial_updates /
                    curr.metrics.epaper_updates) *
                100
            partial_update_ratio_pct = Math.max(
                0,
                Math.min(100, Math.round(ratio * 10) / 10),
            )
        } else if (
            curr.metrics.epaper_full_updates !== undefined &&
            curr.metrics.epaper_partial_updates !== undefined
        ) {
            const total =
                curr.metrics.epaper_full_updates +
                curr.metrics.epaper_partial_updates
            if (total > 0) {
                const ratio =
                    (curr.metrics.epaper_partial_updates / total) * 100
                partial_update_ratio_pct = Math.max(
                    0,
                    Math.min(100, Math.round(ratio * 10) / 10),
                )
            }
        }

        // Производные метрики накопительных счётчиков рассчитываем только в пределах ОДНОГО boot_id
        let http_requests_per_min: number | null = null
        let http_errors_per_min: number | null = null
        let http_error_rate_pct: number | null = null
        let syncs_per_hour: number | null = null
        let lost_records_delta: number | null = null

        const isSameBoot = prev && prev.boot_id === curr.boot_id
        const timeDeltaMs = prev ? curr.timestamp - prev.timestamp : 0

        // Допускаем расчет rate только если интервал времени разумный (от 1 секунды до 30 минут)
        const isValidTimeDelta =
            isSameBoot && timeDeltaMs >= 1000 && timeDeltaMs <= 30 * 60 * 1000

        if (isValidTimeDelta && prev) {
            const minutes = timeDeltaMs / 60000
            const hours = timeDeltaMs / 3600000

            // HTTP запросы в минуту
            if (
                curr.metrics.http_requests !== undefined &&
                prev.metrics.http_requests !== undefined &&
                curr.metrics.http_requests >= prev.metrics.http_requests
            ) {
                const deltaReq =
                    curr.metrics.http_requests - prev.metrics.http_requests
                http_requests_per_min =
                    Math.round((deltaReq / minutes) * 10) / 10

                // HTTP ошибки в минуту
                if (
                    curr.metrics.http_errors !== undefined &&
                    prev.metrics.http_errors !== undefined &&
                    curr.metrics.http_errors >= prev.metrics.http_errors
                ) {
                    const deltaErr =
                        curr.metrics.http_errors - prev.metrics.http_errors
                    http_errors_per_min =
                        Math.round((deltaErr / minutes) * 10) / 10

                    // HTTP Error Rate за этот интервал
                    if (deltaReq > 0) {
                        http_error_rate_pct =
                            Math.round((deltaErr / deltaReq) * 1000) / 10
                    } else if (deltaErr > 0) {
                        http_error_rate_pct = 100
                    } else {
                        http_error_rate_pct = 0
                    }
                }
            }

            // Синхронизации в час
            if (
                curr.metrics.sync_successes !== undefined &&
                prev.metrics.sync_successes !== undefined &&
                curr.metrics.sync_successes >= prev.metrics.sync_successes
            ) {
                const deltaSync =
                    curr.metrics.sync_successes - prev.metrics.sync_successes
                syncs_per_hour = Math.round((deltaSync / hours) * 10) / 10
            }

            // Прирост потерянных записей
            if (
                curr.metrics.storage_lost_records !== undefined &&
                prev.metrics.storage_lost_records !== undefined &&
                curr.metrics.storage_lost_records >=
                    prev.metrics.storage_lost_records
            ) {
                lost_records_delta =
                    curr.metrics.storage_lost_records -
                    prev.metrics.storage_lost_records
            }
        }

        result.push({
            ...curr,
            heap_fragmentation_pct,
            partial_update_ratio_pct,
            http_requests_per_min,
            http_errors_per_min,
            http_error_rate_pct,
            syncs_per_hour,
            lost_records_delta,
        })
    }

    return result
}

/**
 * Вычисляет сводные показатели (SummaryMetrics) для информационных карточек дашборда
 */
export function computeSummaryMetrics(
    points: TelemetryPoint[],
    allRecords: DiagnosticRecord[],
    boots: DiagnosticBoot[],
): SummaryMetrics {
    const pointCount = points.length
    const latestPoint = pointCount > 0 ? points[pointCount - 1] : null

    const timeRangeMs =
        pointCount >= 2
            ? points[pointCount - 1].timestamp - points[0].timestamp
            : 0

    // Память
    let currentFreeHeap: number | null = null
    let minFreeHeap: number | null = null
    let currentFreePsram: number | null = null
    let currentFragmentation: number | null = null
    let fragSum = 0
    let fragCount = 0

    // Система
    let currentCpuTemp: number | null = null
    let minStackWatermark: number | null = null
    let maxUptimeMs: number | null = null

    // Сеть
    let currentRssi: number | null = null
    let rssiSum = 0
    let rssiCount = 0
    let totalHttpRequests = 0
    let totalHttpErrors = 0
    let totalHttpTimeouts = 0
    let peakRequestsPerMin = 0
    let reqPerMinSum = 0
    let reqPerMinCount = 0
    let errPerMinSum = 0
    let errPerMinCount = 0

    // Синхронизация
    let totalSyncSuccesses = 0
    let syncDurationSum = 0
    let syncDurationCount = 0

    // E-paper
    let totalEpaperUpdates = 0
    let totalFullUpdates = 0
    let totalPartialUpdates = 0
    let epaperDurationSum = 0
    let epaperDurationCount = 0

    // Потери записей
    let totalLostRecordsDelta = 0
    let currentLostRecords: number | null = null

    // Группировка точек по boot_id для точного подсчета дельт накопительных счетчиков
    const pointsByBoot = new Map<string, TelemetryPoint[]>()
    for (const pt of points) {
        let list = pointsByBoot.get(pt.boot_id)
        if (!list) {
            list = []
            pointsByBoot.set(pt.boot_id, list)
        }
        list.push(pt)

        // Мгновенные значения
        if (pt.metrics.free_heap !== undefined) {
            currentFreeHeap = pt.metrics.free_heap
        }
        if (pt.metrics.minimum_free_heap !== undefined) {
            minFreeHeap =
                minFreeHeap === null
                    ? pt.metrics.minimum_free_heap
                    : Math.min(minFreeHeap, pt.metrics.minimum_free_heap)
        }
        if (pt.metrics.free_psram !== undefined) {
            currentFreePsram = pt.metrics.free_psram
        }
        if (
            pt.heap_fragmentation_pct !== null &&
            pt.heap_fragmentation_pct !== undefined
        ) {
            currentFragmentation = pt.heap_fragmentation_pct
            fragSum += pt.heap_fragmentation_pct
            fragCount++
        }
        if (
            pt.metrics.cpu_temperature_c !== undefined &&
            pt.metrics.cpu_temperature_valid !== 0
        ) {
            currentCpuTemp = pt.metrics.cpu_temperature_c
        }
        if (pt.metrics.minimum_stack_watermark !== undefined) {
            minStackWatermark =
                minStackWatermark === null
                    ? pt.metrics.minimum_stack_watermark
                    : Math.min(
                          minStackWatermark,
                          pt.metrics.minimum_stack_watermark,
                      )
        }
        if (pt.uptime_ms !== null && pt.uptime_ms !== undefined) {
            maxUptimeMs =
                maxUptimeMs === null
                    ? pt.uptime_ms
                    : Math.max(maxUptimeMs, pt.uptime_ms)
        }
        if (pt.metrics.wifi_rssi !== undefined) {
            currentRssi = pt.metrics.wifi_rssi
            rssiSum += pt.metrics.wifi_rssi
            rssiCount++
        }
        if (
            pt.http_requests_per_min !== null &&
            pt.http_requests_per_min !== undefined
        ) {
            peakRequestsPerMin = Math.max(
                peakRequestsPerMin,
                pt.http_requests_per_min,
            )
            reqPerMinSum += pt.http_requests_per_min
            reqPerMinCount++
        }
        if (
            pt.http_errors_per_min !== null &&
            pt.http_errors_per_min !== undefined
        ) {
            errPerMinSum += pt.http_errors_per_min
            errPerMinCount++
        }
        if (
            pt.metrics.sync_duration_ms !== undefined &&
            pt.metrics.sync_duration_ms > 0
        ) {
            syncDurationSum += pt.metrics.sync_duration_ms
            syncDurationCount++
        }
        if (
            pt.metrics.epaper_duration_ms !== undefined &&
            pt.metrics.epaper_duration_ms > 0
        ) {
            epaperDurationSum += pt.metrics.epaper_duration_ms
            epaperDurationCount++
        }
        if (pt.metrics.storage_lost_records !== undefined) {
            currentLostRecords = pt.metrics.storage_lost_records
        }
        if (pt.lost_records_delta) {
            totalLostRecordsDelta += pt.lost_records_delta
        }
    }

    // Подсчет общих приращений накопительных счетчиков по каждому boot_id
    for (const bootPoints of pointsByBoot.values()) {
        if (bootPoints.length === 0) continue
        const first = bootPoints[0]
        const last = bootPoints[bootPoints.length - 1]

        const delta = (
            getVal: (p: TelemetryPoint) => number | undefined,
        ): number => {
            const startVal = getVal(first) ?? 0
            const endVal = getVal(last) ?? 0
            return Math.max(0, endVal - startVal)
        }

        totalHttpRequests += delta((p) => p.metrics.http_requests)
        totalHttpErrors += delta((p) => p.metrics.http_errors)
        totalHttpTimeouts += delta((p) => p.metrics.http_timeouts)
        totalSyncSuccesses += delta((p) => p.metrics.sync_successes)
        totalEpaperUpdates += delta((p) => p.metrics.epaper_updates)
        totalFullUpdates += delta((p) => p.metrics.epaper_full_updates)
        totalPartialUpdates += delta((p) => p.metrics.epaper_partial_updates)
    }

    const overallHttpErrorRatePct =
        totalHttpRequests > 0
            ? Math.round((totalHttpErrors / totalHttpRequests) * 1000) / 10
            : 0

    const overallPartialRatioPct =
        totalEpaperUpdates > 0
            ? Math.round((totalPartialUpdates / totalEpaperUpdates) * 1000) / 10
            : totalFullUpdates + totalPartialUpdates > 0
              ? Math.round(
                    (totalPartialUpdates /
                        (totalFullUpdates + totalPartialUpdates)) *
                        1000,
                ) / 10
              : 0

    const rangeHours = timeRangeMs > 0 ? timeRangeMs / 3600000 : 1
    const syncsPerHour =
        rangeHours > 0
            ? Math.round((totalSyncSuccesses / rangeHours) * 10) / 10
            : 0

    // Расчет перезагрузок и MTBF
    const bootIdSet = new Set<string>()
    for (const p of points) bootIdSet.add(p.boot_id)
    for (const b of boots) bootIdSet.add(b.boot_id)
    const totalRestarts = Math.max(0, bootIdSet.size - 1)
    const rangeDays = timeRangeMs > 0 ? timeRangeMs / 86400000 : 1
    const restartsPerDay =
        rangeDays > 0
            ? Math.round((bootIdSet.size / rangeDays) * 10) / 10
            : bootIdSet.size

    // Mean Uptime: средний uptime между перезапусками
    let uptimeSum = 0
    let uptimeCount = 0
    for (const bPoints of pointsByBoot.values()) {
        const maxUptime = Math.max(...bPoints.map((p) => p.uptime_ms ?? 0), 0)
        if (maxUptime > 0) {
            uptimeSum += maxUptime
            uptimeCount++
        }
    }
    const meanUptimeMs = uptimeCount > 0 ? uptimeSum / uptimeCount : null

    // Ошибки по логам
    let totalErrorLogs = 0
    let totalCriticalLogs = 0
    const errorCountByModule: Record<string, number> = {}

    for (const rec of allRecords) {
        if (
            rec.level === 'ERROR' ||
            rec.level === 'CRITICAL' ||
            rec.level === 'FATAL'
        ) {
            if (rec.level === 'ERROR') totalErrorLogs++
            if (rec.level === 'CRITICAL' || rec.level === 'FATAL') {
                totalCriticalLogs++
            }
            const mod = rec.module || 'system'
            errorCountByModule[mod] = (errorCountByModule[mod] ?? 0) + 1
        }
    }

    return {
        latestPoint,
        pointCount,
        timeRangeMs,
        currentFreeHeap,
        minFreeHeap,
        currentFreePsram,
        currentFragmentation,
        avgFragmentation:
            fragCount > 0 ? Math.round((fragSum / fragCount) * 10) / 10 : null,
        currentCpuTemp,
        minStackWatermark,
        maxUptimeMs,
        currentRssi,
        avgRssi: rssiCount > 0 ? Math.round(rssiSum / rssiCount) : null,
        totalHttpRequests,
        totalHttpErrors,
        totalHttpTimeouts,
        overallHttpErrorRatePct,
        avgRequestsPerMin:
            reqPerMinCount > 0
                ? Math.round((reqPerMinSum / reqPerMinCount) * 10) / 10
                : 0,
        peakRequestsPerMin: Math.round(peakRequestsPerMin * 10) / 10,
        avgErrorsPerMin:
            errPerMinCount > 0
                ? Math.round((errPerMinSum / errPerMinCount) * 10) / 10
                : 0,
        totalSyncSuccesses,
        avgSyncDurationMs:
            syncDurationCount > 0
                ? Math.round(syncDurationSum / syncDurationCount)
                : null,
        syncsPerHour,
        totalEpaperUpdates,
        totalFullUpdates,
        totalPartialUpdates,
        overallPartialRatioPct,
        avgEpaperDurationMs:
            epaperDurationCount > 0
                ? Math.round(epaperDurationSum / epaperDurationCount)
                : null,
        totalRestarts,
        restartsPerDay,
        meanUptimeMs,
        totalLostRecordsDelta,
        currentLostRecords,
        totalErrorLogs,
        totalCriticalLogs,
        errorCountByModule,
    }
}
