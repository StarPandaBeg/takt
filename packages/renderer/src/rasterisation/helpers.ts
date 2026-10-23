import { DrawColor } from '@takt/ui'
import type { Bounds, RenderedFrame, TextBitmap } from '../types.js'

export function pixelBounds(bounds: Bounds): Bounds {
    const x = Math.floor(bounds.x)
    const y = Math.floor(bounds.y)

    return {
        x,
        y,
        width: Math.ceil(bounds.x + bounds.width) - x,
        height: Math.ceil(bounds.y + bounds.height) - y,
    }
}

export function blitTextBitmap(
    frame: RenderedFrame,
    bitmap: TextBitmap,
    x: number,
    y: number,
    color: DrawColor = DrawColor.BLACK,
    threshold = 128,
): void {
    const startX = Math.round(x)
    const startY = Math.round(y)

    // Пересечение маски с границами кадра
    const x1 = Math.max(0, startX)
    const y1 = Math.max(0, startY)
    const x2 = Math.min(frame.width, startX + bitmap.width)
    const y2 = Math.min(frame.height, startY + bitmap.height)

    if (x1 >= x2 || y1 >= y2) return

    for (let py = y1; py < y2; py++) {
        const srcRow = (py - startY) * bitmap.width
        const dstRow = py * frame.width

        for (let px = x1; px < x2; px++) {
            const alpha = bitmap.buffer[srcRow + (px - startX)] ?? 0
            if (alpha >= threshold) {
                frame.buffer[dstRow + px] = color
            }
        }
    }
}
