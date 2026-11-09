import {
    useCallback,
    useId,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
} from 'react'
import type { ChartSeries, ChartThreshold, TelemetryPoint } from './types'

interface TimeSeriesChartProps {
    title: string
    description?: string
    points: TelemetryPoint[]
    series: ChartSeries[]
    thresholds?: ChartThreshold[]
    height?: number
    yMin?: number
    yMax?: number
    formatY?: (value: number) => string
    emptyMessage?: string
    stackBars?: boolean
}

const timeFormatterShort = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
})

const timeFormatterLong = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})

const tooltipTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
})

export function TimeSeriesChart({
    title,
    description,
    points,
    series,
    thresholds,
    height = 220,
    yMin: forceYMin,
    yMax: forceYMax,
    formatY,
    emptyMessage = 'Нет данных телеметрии за выбранный диапазон',
}: TimeSeriesChartProps) {
    const chartId = useId()
    const containerRef = useRef<HTMLDivElement>(null)
    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>(
        {},
    )
    const [hoverIndex, setHoverIndex] = useState<number | null>(null)
    const [tooltipPos, setTooltipPos] = useState<{
        x: number
        y: number
    } | null>(null)

    const toggleSeries = (id: string) => {
        setHiddenSeries((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    // Фильтруем видимые серии
    const activeSeries = useMemo(
        () => series.filter((s) => !hiddenSeries[s.id]),
        [series, hiddenSeries],
    )

    // Вычисляем min/max для X и Y
    const chartBounds = useMemo(() => {
        if (points.length === 0) {
            return {
                xMin: 0,
                xMax: 1,
                yMin: 0,
                yMax: 1,
                hasData: false,
            }
        }

        const xMin = points[0].timestamp
        const xMax = points[points.length - 1].timestamp

        let minVal = Number.POSITIVE_INFINITY
        let maxVal = Number.NEGATIVE_INFINITY
        let foundAny = false

        for (const pt of points) {
            for (const s of activeSeries) {
                const val = s.getValue(pt)
                if (val !== null && val !== undefined && !Number.isNaN(val)) {
                    minVal = Math.min(minVal, val)
                    maxVal = Math.max(maxVal, val)
                    foundAny = true
                }
            }
        }

        if (thresholds) {
            for (const th of thresholds) {
                minVal = Math.min(minVal, th.value)
                maxVal = Math.max(maxVal, th.value)
            }
        }

        if (!foundAny) {
            return {
                xMin,
                xMax: xMax === xMin ? xMin + 1000 : xMax,
                yMin: forceYMin ?? 0,
                yMax: forceYMax ?? 100,
                hasData: false,
            }
        }

        let computedYMin = forceYMin ?? minVal
        let computedYMax = forceYMax ?? maxVal

        // Добавляем отступ 5-10% сверху и снизу, если границы не зафиксированы
        if (forceYMin === undefined) {
            const padding = (computedYMax - computedYMin) * 0.08 || 1
            computedYMin = Math.max(0, computedYMin - padding)
        }
        if (forceYMax === undefined) {
            const padding = (computedYMax - computedYMin) * 0.08 || 1
            computedYMax = computedYMax + padding
        }

        if (computedYMin === computedYMax) {
            computedYMin -= 1
            computedYMax += 1
        }

        return {
            xMin,
            xMax: xMax === xMin ? xMin + 1000 : xMax,
            yMin: computedYMin,
            yMax: computedYMax,
            hasData: true,
        }
    }, [points, activeSeries, thresholds, forceYMin, forceYMax])

    // Размеры внутреннего холста графика
    const svgWidth = 800
    const svgHeight = height
    const padLeft = 60
    const padRight = 20
    const padTop = 14
    const padBottom = 26

    const plotWidth = svgWidth - padLeft - padRight
    const plotHeight = svgHeight - padTop - padBottom

    const getX = useCallback(
        (timestamp: number) => {
            if (chartBounds.xMax === chartBounds.xMin) return padLeft
            const ratio =
                (timestamp - chartBounds.xMin) /
                (chartBounds.xMax - chartBounds.xMin)
            return padLeft + Math.max(0, Math.min(plotWidth, ratio * plotWidth))
        },
        [chartBounds.xMin, chartBounds.xMax, padLeft, plotWidth],
    )

    const getY = useCallback(
        (value: number) => {
            if (chartBounds.yMax === chartBounds.yMin)
                return padTop + plotHeight / 2
            const ratio =
                (value - chartBounds.yMin) /
                (chartBounds.yMax - chartBounds.yMin)
            return (
                padTop +
                plotHeight -
                Math.max(0, Math.min(plotHeight, ratio * plotHeight))
            )
        },
        [chartBounds.yMin, chartBounds.yMax, padTop, plotHeight],
    )

    // Деления оси Y (5 делений)
    const yTicks = useMemo(() => {
        const ticks: number[] = []
        const count = 4
        const step = (chartBounds.yMax - chartBounds.yMin) / count
        for (let i = 0; i <= count; i++) {
            ticks.push(chartBounds.yMin + step * i)
        }
        return ticks
    }, [chartBounds.yMin, chartBounds.yMax])

    // Деления оси X (5 делений по времени)
    const xTicks = useMemo(() => {
        const ticks: number[] = []
        const count = 5
        const step = (chartBounds.xMax - chartBounds.xMin) / count
        for (let i = 0; i <= count; i++) {
            ticks.push(chartBounds.xMin + step * i)
        }
        return ticks
    }, [chartBounds.xMin, chartBounds.xMax])

    const isLongSpan = chartBounds.xMax - chartBounds.xMin > 24 * 60 * 60 * 1000

    // Построение сегментов путей для каждой серии с учетом разрывов по boot_id и пропускам данных
    const seriesPaths = useMemo(() => {
        if (!chartBounds.hasData || points.length === 0) return []

        return activeSeries.map((s) => {
            // Разделяем точки на непрерывные сегменты (разрыв при смене boot_id или гэпе > 30 минут)
            const segments: { x: number; y: number }[][] = []
            let currentSegment: { x: number; y: number }[] = []
            let lastPoint: TelemetryPoint | null = null

            for (const pt of points) {
                const val = s.getValue(pt)
                const isBreak =
                    lastPoint !== null &&
                    (lastPoint.boot_id !== pt.boot_id ||
                        pt.timestamp - lastPoint.timestamp > 30 * 60 * 1000)

                if (isBreak && currentSegment.length > 0) {
                    segments.push(currentSegment)
                    currentSegment = []
                }

                if (val !== null && val !== undefined && !Number.isNaN(val)) {
                    currentSegment.push({
                        x: getX(pt.timestamp),
                        y: getY(val),
                    })
                } else if (currentSegment.length > 0) {
                    // Если значение отсутствует, не соединяем точки через пустоту!
                    segments.push(currentSegment)
                    currentSegment = []
                }

                lastPoint = pt
            }

            if (currentSegment.length > 0) {
                segments.push(currentSegment)
            }

            // Генерируем SVG path `d`
            let linePath = ''
            let areaPath = ''
            const zeroY = getY(Math.max(chartBounds.yMin, 0))

            for (const seg of segments) {
                if (seg.length === 1) {
                    // Одиночная точка: рисуем микро-линию или кружок
                    linePath += ` M ${seg[0].x - 1} ${seg[0].y} L ${seg[0].x + 1} ${seg[0].y}`
                } else if (seg.length > 1) {
                    linePath += ` M ${seg[0].x} ${seg[0].y}`
                    for (let j = 1; j < seg.length; j++) {
                        linePath += ` L ${seg[j].x} ${seg[j].y}`
                    }

                    if (s.type === 'area') {
                        areaPath += ` M ${seg[0].x} ${zeroY} L ${seg[0].x} ${seg[0].y}`
                        for (let j = 1; j < seg.length; j++) {
                            areaPath += ` L ${seg[j].x} ${seg[j].y}`
                        }
                        areaPath += ` L ${seg[seg.length - 1].x} ${zeroY} Z`
                    }
                }
            }

            return {
                series: s,
                linePath,
                areaPath,
                segments,
            }
        })
    }, [activeSeries, points, chartBounds, getX, getY])

    // Обработка наведения мыши (Hover)
    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (points.length === 0 || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const scaleX = svgWidth / rect.width
        const svgMouseX = mouseX * scaleX

        // Поиск ближайшей точки по X
        let closestIdx = 0
        let minDiff = Number.POSITIVE_INFINITY

        for (let i = 0; i < points.length; i++) {
            const ptX = getX(points[i].timestamp)
            const diff = Math.abs(ptX - svgMouseX)
            if (diff < minDiff) {
                minDiff = diff
                closestIdx = i
            }
        }

        setHoverIndex(closestIdx)
        setTooltipPos({
            x: Math.max(10, Math.min(rect.width - 240, mouseX + 12)),
            y: Math.max(
                10,
                Math.min(rect.height - 100, e.clientY - rect.top - 20),
            ),
        })
    }

    const handleMouseLeave = () => {
        setHoverIndex(null)
        setTooltipPos(null)
    }

    const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null

    const defaultFormatY = (val: number) => {
        if (formatY) return formatY(val)
        if (Math.abs(val) >= 1_000_000)
            return `${(val / 1_000_000).toFixed(1)}M`
        if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}k`
        return Number.isInteger(val) ? val.toString() : val.toFixed(1)
    }

    return (
        <div className="takt-chart-card">
            <header className="takt-chart-card__header">
                <div>
                    <h3 className="takt-chart-card__title">{title}</h3>
                    {description && (
                        <p className="takt-chart-card__description">
                            {description}
                        </p>
                    )}
                </div>
                <div className="takt-chart-legend">
                    {series.map((s) => {
                        const isHidden = hiddenSeries[s.id]
                        return (
                            <button
                                key={s.id}
                                type="button"
                                className={`takt-chart-legend__item ${isHidden ? 'is-muted' : ''}`}
                                onClick={() => toggleSeries(s.id)}
                                title={
                                    isHidden
                                        ? `Показать: ${s.name}`
                                        : `Скрыть: ${s.name}`
                                }
                            >
                                <span
                                    className="takt-chart-legend__dot"
                                    style={{
                                        backgroundColor: isHidden
                                            ? 'var(--line-strong)'
                                            : s.color,
                                    }}
                                />
                                <span className="takt-chart-legend__label">
                                    {s.name}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </header>

            <div
                ref={containerRef}
                className="takt-chart-canvas-wrap"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {!chartBounds.hasData || points.length === 0 ? (
                    <div className="takt-chart-empty">
                        <span>{emptyMessage}</span>
                    </div>
                ) : (
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="takt-chart-svg"
                        preserveAspectRatio="none"
                    >
                        <defs>
                            {activeSeries.map((s) => (
                                <linearGradient
                                    key={`grad-${s.id}`}
                                    id={`${chartId}-grad-${s.id}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={s.color}
                                        stopOpacity="0.25"
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={s.color}
                                        stopOpacity="0.02"
                                    />
                                </linearGradient>
                            ))}
                        </defs>

                        {/* Горизонтальная сетка и метки Y */}
                        {yTicks.map((tickVal, i) => {
                            const y = getY(tickVal)
                            return (
                                <g
                                    key={`ytick-${i}`}
                                    className="takt-chart-grid-line"
                                >
                                    <line
                                        x1={padLeft}
                                        y1={y}
                                        x2={svgWidth - padRight}
                                        y2={y}
                                        stroke="var(--line)"
                                        strokeDasharray="3 3"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={padLeft - 8}
                                        y={y + 3.5}
                                        textAnchor="end"
                                        className="takt-chart-axis-label"
                                    >
                                        {defaultFormatY(tickVal)}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Вертикальная сетка и метки X */}
                        {xTicks.map((tickTime, i) => {
                            const x = getX(tickTime)
                            const timeStr = isLongSpan
                                ? timeFormatterLong.format(new Date(tickTime))
                                : timeFormatterShort.format(new Date(tickTime))
                            return (
                                <g
                                    key={`xtick-${i}`}
                                    className="takt-chart-grid-line"
                                >
                                    <line
                                        x1={x}
                                        y1={padTop}
                                        x2={x}
                                        y2={padTop + plotHeight}
                                        stroke="var(--line)"
                                        strokeDasharray="2 3"
                                        strokeWidth="0.8"
                                        opacity="0.6"
                                    />
                                    <text
                                        x={x}
                                        y={svgHeight - 8}
                                        textAnchor="middle"
                                        className="takt-chart-axis-label"
                                    >
                                        {timeStr}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Пороговые линии (Thresholds) */}
                        {thresholds?.map((th, i) => {
                            const y = getY(th.value)
                            if (y < padTop || y > padTop + plotHeight)
                                return null
                            return (
                                <g key={`th-${i}`}>
                                    <line
                                        x1={padLeft}
                                        y1={y}
                                        x2={svgWidth - padRight}
                                        y2={y}
                                        stroke={th.color}
                                        strokeWidth="1.2"
                                        strokeDasharray={
                                            th.lineStyle === 'solid'
                                                ? undefined
                                                : '4 4'
                                        }
                                        opacity="0.8"
                                    />
                                    <text
                                        x={svgWidth - padRight - 4}
                                        y={y - 4}
                                        textAnchor="end"
                                        fill={th.color}
                                        fontSize="9"
                                        fontWeight="600"
                                    >
                                        {th.label}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Линии и области серий */}
                        {seriesPaths.map(
                            ({ series: s, linePath, areaPath }) => (
                                <g
                                    key={s.id}
                                    className="takt-chart-series-group"
                                >
                                    {s.type === 'area' && areaPath && (
                                        <path
                                            d={areaPath}
                                            fill={`url(#${chartId}-grad-${s.id})`}
                                        />
                                    )}
                                    {linePath && (
                                        <path
                                            d={linePath}
                                            fill="none"
                                            stroke={s.color}
                                            strokeWidth={
                                                s.type === 'bar' ? 3 : 2
                                            }
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    )}
                                </g>
                            ),
                        )}

                        {/* Маркеры курсора и вертикальная линия наведения */}
                        {hoveredPoint && (
                            <g className="takt-chart-crosshair">
                                <line
                                    x1={getX(hoveredPoint.timestamp)}
                                    y1={padTop}
                                    x2={getX(hoveredPoint.timestamp)}
                                    y2={padTop + plotHeight}
                                    stroke="var(--ink)"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                    opacity="0.75"
                                />
                                {activeSeries.map((s) => {
                                    const val = s.getValue(hoveredPoint)
                                    if (
                                        val === null ||
                                        val === undefined ||
                                        Number.isNaN(val)
                                    )
                                        return null
                                    const cx = getX(hoveredPoint.timestamp)
                                    const cy = getY(val)
                                    return (
                                        <g key={`pt-${s.id}`}>
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r="4.5"
                                                fill="white"
                                                stroke={s.color}
                                                strokeWidth="2.5"
                                            />
                                        </g>
                                    )
                                })}
                            </g>
                        )}
                    </svg>
                )}

                {/* Всплывающий тултип */}
                {hoveredPoint && tooltipPos && (
                    <div
                        className="takt-chart-tooltip"
                        style={{
                            left: tooltipPos.x,
                            top: tooltipPos.y,
                        }}
                    >
                        <div className="takt-chart-tooltip__time">
                            {tooltipTimeFormatter.format(
                                new Date(hoveredPoint.timestamp),
                            )}
                        </div>
                        <div className="takt-chart-tooltip__meta">
                            <span>
                                Boot: {hoveredPoint.boot_id.slice(0, 8)}…
                            </span>
                            <span>#{hoveredPoint.sequence}</span>
                        </div>
                        <div className="takt-chart-tooltip__values">
                            {activeSeries.map((s) => {
                                const val = s.getValue(hoveredPoint)
                                if (
                                    val === null ||
                                    val === undefined ||
                                    Number.isNaN(val)
                                )
                                    return null
                                const displayVal = s.formatter
                                    ? s.formatter(val)
                                    : `${val} ${s.unit}`
                                return (
                                    <div
                                        key={s.id}
                                        className="takt-chart-tooltip__row"
                                    >
                                        <span
                                            className="takt-chart-tooltip__dot"
                                            style={{ backgroundColor: s.color }}
                                        />
                                        <span className="takt-chart-tooltip__name">
                                            {s.name}:
                                        </span>
                                        <strong className="takt-chart-tooltip__val">
                                            {displayVal}
                                        </strong>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
