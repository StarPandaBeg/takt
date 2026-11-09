import {
    Activity,
    AlertCircle,
    Cpu,
    FileSpreadsheet,
    HardDrive,
    Layers,
    RotateCcw,
    Sparkles,
    Wifi,
} from 'lucide-react'
import type { SummaryMetrics } from './types'

interface SummaryCardsProps {
    summary: SummaryMetrics
}

function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return '—'
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${bytes} B`
}

function formatDuration(ms: number | null): string {
    if (ms === null || ms === undefined) return '—'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 24) {
        const days = Math.floor(hours / 24)
        return `${days}д ${hours % 24}ч`
    }
    if (hours > 0) return `${hours}ч ${minutes}м`
    if (minutes > 0) return `${minutes}м ${seconds}с`
    return `${seconds}с`
}

export function SummaryCards({ summary }: SummaryCardsProps) {
    const rssiStatus =
        summary.currentRssi === null
            ? 'neutral'
            : summary.currentRssi >= -65
              ? 'good'
              : summary.currentRssi >= -78
                ? 'warn'
                : 'bad'

    const errorRateStatus =
        summary.overallHttpErrorRatePct === 0
            ? 'good'
            : summary.overallHttpErrorRatePct < 5
              ? 'warn'
              : 'bad'

    const fragStatus =
        summary.currentFragmentation === null
            ? 'neutral'
            : summary.currentFragmentation < 20
              ? 'good'
              : summary.currentFragmentation < 45
                ? 'warn'
                : 'bad'

    return (
        <section className="takt-kpi-grid">
            {/* Память */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <HardDrive size={16} />
                    </span>
                    <span className="takt-kpi-card__title">Свободный Heap</span>
                    <span
                        className={`takt-kpi-badge takt-kpi-badge--${fragStatus}`}
                    >
                        {summary.currentFragmentation !== null
                            ? `Фрагм. ${summary.currentFragmentation}%`
                            : '—'}
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {formatBytes(summary.currentFreeHeap)}
                </div>
                <div className="takt-kpi-card__sub">
                    <span>Мин. запуск: {formatBytes(summary.minFreeHeap)}</span>
                    {summary.currentFreePsram !== null && (
                        <span>
                            PSRAM: {formatBytes(summary.currentFreePsram)}
                        </span>
                    )}
                </div>
            </div>

            {/* Сеть Wi-Fi & HTTP */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <Wifi size={16} />
                    </span>
                    <span className="takt-kpi-card__title">Wi-Fi & HTTP</span>
                    <span
                        className={`takt-kpi-badge takt-kpi-badge--${rssiStatus}`}
                    >
                        {summary.currentRssi !== null
                            ? `${summary.currentRssi} dBm`
                            : '—'}
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {summary.totalHttpRequests.toLocaleString('ru-RU')}
                    <span className="takt-kpi-card__unit"> запр.</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>
                        Ср. поток: {summary.avgRequestsPerMin}/мин (пик{' '}
                        {summary.peakRequestsPerMin})
                    </span>
                    <span
                        className={
                            summary.totalHttpErrors > 0
                                ? 'takt-text-danger'
                                : undefined
                        }
                    >
                        Ошибки: {summary.totalHttpErrors} (таймауты{' '}
                        {summary.totalHttpTimeouts})
                    </span>
                </div>
            </div>

            {/* HTTP Error Rate */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <AlertCircle size={16} />
                    </span>
                    <span className="takt-kpi-card__title">
                        HTTP Error Rate
                    </span>
                    <span
                        className={`takt-kpi-badge takt-kpi-badge--${errorRateStatus}`}
                    >
                        {summary.overallHttpErrorRatePct}%
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {summary.avgErrorsPerMin}
                    <span className="takt-kpi-card__unit"> ош./мин</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>Всего ошибок в логах: {summary.totalErrorLogs}</span>
                    {summary.totalCriticalLogs > 0 && (
                        <span className="takt-text-danger">
                            Критических: {summary.totalCriticalLogs}
                        </span>
                    )}
                </div>
            </div>

            {/* Синхронизация */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <Activity size={16} />
                    </span>
                    <span className="takt-kpi-card__title">Синхронизация</span>
                    <span className="takt-kpi-badge takt-kpi-badge--good">
                        {summary.syncsPerHour}/час
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {summary.totalSyncSuccesses}
                    <span className="takt-kpi-card__unit"> успешных</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>
                        Ср. длит.:{' '}
                        {summary.avgSyncDurationMs !== null
                            ? `${(summary.avgSyncDurationMs / 1000).toFixed(1)} с`
                            : '—'}
                    </span>
                    <span>
                        Последняя:{' '}
                        {summary.latestPoint?.metrics.sync_duration_ms
                            ? `${(summary.latestPoint.metrics.sync_duration_ms / 1000).toFixed(1)} с`
                            : '—'}
                    </span>
                </div>
            </div>

            {/* E-paper */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <Layers size={16} />
                    </span>
                    <span className="takt-kpi-card__title">
                        E-paper дисплей
                    </span>
                    <span className="takt-kpi-badge takt-kpi-badge--good">
                        {summary.overallPartialRatioPct}% partial
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {summary.totalEpaperUpdates}
                    <span className="takt-kpi-card__unit"> обновлений</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>
                        Full: {summary.totalFullUpdates} | Partial:{' '}
                        {summary.totalPartialUpdates}
                    </span>
                    <span>
                        Ср. время:{' '}
                        {summary.avgEpaperDurationMs !== null
                            ? `${(summary.avgEpaperDurationMs / 1000).toFixed(1)} с`
                            : '—'}
                    </span>
                </div>
            </div>

            {/* Надежность и перезапуски */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <RotateCcw size={16} />
                    </span>
                    <span className="takt-kpi-card__title">
                        Надёжность & MTBF
                    </span>
                    <span
                        className={`takt-kpi-badge takt-kpi-badge--${summary.totalRestarts === 0 ? 'good' : summary.totalRestarts <= 2 ? 'warn' : 'bad'}`}
                    >
                        {summary.restartsPerDay}/сут
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {formatDuration(summary.meanUptimeMs)}
                    <span className="takt-kpi-card__unit"> ср. uptime</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>Перезапусков за период: {summary.totalRestarts}</span>
                    <span
                        className={
                            summary.totalLostRecordsDelta > 0
                                ? 'takt-text-danger'
                                : undefined
                        }
                    >
                        Потеряно записей: +{summary.totalLostRecordsDelta}
                    </span>
                </div>
            </div>

            {/* Система / CPU & Stack */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <Cpu size={16} />
                    </span>
                    <span className="takt-kpi-card__title">CPU & Стек</span>
                    <span
                        className={`takt-kpi-badge takt-kpi-badge--${summary.currentCpuTemp && summary.currentCpuTemp > 65 ? 'bad' : 'good'}`}
                    >
                        {summary.currentCpuTemp !== null
                            ? `${summary.currentCpuTemp.toFixed(1)} °C`
                            : '—'}
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {summary.minStackWatermark !== null
                        ? `${summary.minStackWatermark} B`
                        : '—'}
                    <span className="takt-kpi-card__unit"> мин. стек</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>
                        Текущий Uptime:{' '}
                        {formatDuration(summary.latestPoint?.uptime_ms ?? null)}
                    </span>
                    <span>
                        FW: {summary.latestPoint?.firmware_version ?? '—'}
                    </span>
                </div>
            </div>

            {/* Сводка телеметрии */}
            <div className="takt-kpi-card">
                <div className="takt-kpi-card__header">
                    <span className="takt-kpi-card__icon">
                        <FileSpreadsheet size={16} />
                    </span>
                    <span className="takt-kpi-card__title">
                        Точки телеметрии
                    </span>
                    <span className="takt-kpi-badge takt-kpi-badge--good">
                        <Sparkles size={11} /> live
                    </span>
                </div>
                <div className="takt-kpi-card__value">
                    {summary.pointCount.toLocaleString('ru-RU')}
                    <span className="takt-kpi-card__unit"> снимков</span>
                </div>
                <div className="takt-kpi-card__sub">
                    <span>Диапазон: {formatDuration(summary.timeRangeMs)}</span>
                    <span>Seq: #{summary.latestPoint?.sequence ?? '—'}</span>
                </div>
            </div>
        </section>
    )
}
