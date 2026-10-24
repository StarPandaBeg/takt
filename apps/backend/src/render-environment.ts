import { createCanvas } from '@napi-rs/canvas'
import type { RenderEnvironment, TextStyle } from '@takt/renderer'

const RASTER_EDGE_GUARD = 1

interface TextGeometry {
    readonly width: number
    readonly height: number
    readonly baseline: number
    readonly drawX: number
    readonly advanceWidth: number
    readonly underlineY: number
    readonly underlineThickness: number
}

export function createNodeEnvironment(): RenderEnvironment {
    const canvas = createCanvas(1, 1)
    const ctx = canvas.getContext('2d')

    function applyTextStyle(style: TextStyle) {
        ctx.font = [
            style.italic ? 'italic' : 'normal',
            style.fontWeight,
            `${style.fontSize}px`,
            JSON.stringify(style.fontFamily),
        ].join(' ')

        ctx.textBaseline = 'alphabetic'
    }

    function getTextGeometry(value: string, style: TextStyle): TextGeometry {
        applyTextStyle(style)

        const metrics = ctx.measureText(value)
        const hasInk =
            metrics.actualBoundingBoxAscent !== 0 ||
            metrics.actualBoundingBoxDescent !== 0 ||
            metrics.actualBoundingBoxLeft !== 0 ||
            metrics.actualBoundingBoxRight !== 0
        const horizontalGuard = hasInk ? RASTER_EDGE_GUARD : 0

        // Horizontal bounds stay tight in both modes because they are used
        // for horizontal alignment. Skia can antialias into the adjacent pixel
        // when an outline lands exactly on a reported boundary.
        const left =
            Math.floor(-metrics.actualBoundingBoxLeft) - horizontalGuard
        const right =
            Math.ceil(metrics.actualBoundingBoxRight) + horizontalGuard

        // Font bounds provide a stable baseline and are defined to contain
        // every glyph in the selected font. Tight bounds intentionally follow
        // the actual glyphs and therefore vary with the text content.
        const baseTop =
            style.metrics === 'tight'
                ? Math.floor(-metrics.actualBoundingBoxAscent)
                : Math.floor(-metrics.fontBoundingBoxAscent)
        const baseBottom =
            style.metrics === 'tight'
                ? Math.ceil(metrics.actualBoundingBoxDescent)
                : Math.ceil(metrics.fontBoundingBoxDescent)
        const verticalGuard =
            style.metrics === 'font' || hasInk ? RASTER_EDGE_GUARD : 0
        const top = baseTop - verticalGuard
        const bottom = baseBottom + verticalGuard

        const drawX = -left
        const baseline = -top

        const underlineThickness = Math.max(1, style.fontSize * 0.05)
        const underlineOffset = Math.max(1, style.fontSize * 0.08)
        const underlineY = baseline + underlineOffset

        // Подчёркивание тоже должно попадать в границы bitmap
        const width = Math.max(
            0,
            right - left,
            style.underline
                ? Math.ceil(drawX + metrics.width + RASTER_EDGE_GUARD)
                : 0,
        )

        const height = Math.max(
            0,
            bottom - top,
            style.underline
                ? Math.ceil(underlineY + underlineThickness + RASTER_EDGE_GUARD)
                : 0,
        )

        return {
            width,
            height,
            baseline,
            drawX,
            advanceWidth: metrics.width,
            underlineY,
            underlineThickness,
        }
    }

    return {
        measureText(value, style) {
            const { width, height } = getTextGeometry(value, style)
            return { width, height }
        },

        rasterizeText(value, style) {
            const geometry = getTextGeometry(value, style)
            const { width, height } = geometry

            if (width === 0 || height === 0) {
                return {
                    width,
                    height,
                    buffer: new Uint8Array(0),
                }
            }

            canvas.width = width
            canvas.height = height

            // Изменение размера Canvas сбрасывает настройки контекста
            applyTextStyle(style)
            ctx.fillStyle = '#000'

            ctx.fillText(value, geometry.drawX, geometry.baseline)

            if (style.underline) {
                ctx.fillRect(
                    geometry.drawX,
                    geometry.underlineY,
                    geometry.advanceWidth,
                    geometry.underlineThickness,
                )
            }

            const rgba = ctx.getImageData(0, 0, width, height).data
            const buffer = new Uint8Array(width * height)

            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = rgba[i * 4 + 3] ?? 0
            }

            return { width, height, buffer }
        },
    }
}
