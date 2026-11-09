export interface TelemetrySnapshot {
    reset_reason?: number
    free_heap?: number
    minimum_free_heap?: number
    largest_free_block?: number
    free_psram?: number
    cpu_temperature_c?: number
    cpu_temperature_valid?: number
    minimum_stack_watermark?: number
    wifi_rssi?: number
    http_requests?: number
    http_errors?: number
    http_timeouts?: number
    sync_successes?: number
    sync_duration_ms?: number
    epaper_updates?: number
    epaper_duration_ms?: number
    epaper_full_updates?: number
    epaper_partial_updates?: number
    storage_lost_records?: number
}

export interface TelemetryPoint {
    id: number
    timestamp: number // ms
    uptime_ms: number | null
    boot_id: string
    sequence: number
    firmware_version: string | null
    git_sha: string | null
    metrics: TelemetrySnapshot

    // Производные метрики
    heap_fragmentation_pct?: number | null
    partial_update_ratio_pct?: number | null
    http_requests_per_min?: number | null
    http_errors_per_min?: number | null
    http_error_rate_pct?: number | null
    syncs_per_hour?: number | null
    lost_records_delta?: number | null
}

export interface ChartSeries {
    id: string
    name: string
    color: string
    unit: string
    type?: 'line' | 'bar' | 'area'
    formatter?: (value: number) => string
    // Селектор значения из точки данных
    getValue: (point: TelemetryPoint) => number | null | undefined
}

export interface ChartThreshold {
    value: number
    label: string
    color: string
    lineStyle?: 'dashed' | 'solid'
}

export interface SummaryMetrics {
    latestPoint: TelemetryPoint | null
    pointCount: number
    timeRangeMs: number
    // Память
    currentFreeHeap: number | null
    minFreeHeap: number | null
    currentFreePsram: number | null
    currentFragmentation: number | null
    avgFragmentation: number | null
    // Система
    currentCpuTemp: number | null
    minStackWatermark: number | null
    maxUptimeMs: number | null
    // Сеть
    currentRssi: number | null
    avgRssi: number | null
    totalHttpRequests: number
    totalHttpErrors: number
    totalHttpTimeouts: number
    overallHttpErrorRatePct: number
    avgRequestsPerMin: number
    peakRequestsPerMin: number
    avgErrorsPerMin: number
    // Синхронизация
    totalSyncSuccesses: number
    avgSyncDurationMs: number | null
    syncsPerHour: number
    // E-paper
    totalEpaperUpdates: number
    totalFullUpdates: number
    totalPartialUpdates: number
    overallPartialRatioPct: number
    avgEpaperDurationMs: number | null
    // Надёжность
    totalRestarts: number
    restartsPerDay: number
    meanUptimeMs: number | null
    totalLostRecordsDelta: number
    currentLostRecords: number | null
    totalErrorLogs: number
    totalCriticalLogs: number
    errorCountByModule: Record<string, number>
}
