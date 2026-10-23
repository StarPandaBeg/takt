import { createCanvas } from '@napi-rs/canvas'
import type { RenderEnvironment, TextStyle } from '@takt/renderer'

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
        const reference = ctx.measureText('HgÅру')

        const ascent = Math.ceil(
            metrics.fontBoundingBoxAscent ?? reference.actualBoundingBoxAscent,
        )

        const descent = Math.ceil(
            metrics.fontBoundingBoxDescent ??
                reference.actualBoundingBoxDescent,
        )

        const drawX = Math.max(0, Math.ceil(metrics.actualBoundingBoxLeft))
        const right = Math.max(
            Math.ceil(metrics.width),
            Math.ceil(metrics.actualBoundingBoxRight),
        )
        const baseline = ascent
        const underlineY = baseline + Math.max(1, style.fontSize * 0.08)
        const underlineThickness = Math.max(1, style.fontSize * 0.05)
        const textHeight = ascent + descent
        const underlineBottom = style.underline
            ? Math.ceil(underlineY + underlineThickness)
            : 0

        return {
            width: drawX + right,
            height: Math.max(textHeight, underlineBottom),
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
