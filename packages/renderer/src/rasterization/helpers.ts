import type { DrawColor, Quad } from '@takt/ui'
import type { Bounds, Position, RenderedFrame, TextBitmap } from '../types.js'
import { resolveDrawColor } from './color.js'

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
    color: DrawColor,
    threshold: number,
): void {
    const startX = Math.round(x)
    const startY = Math.round(y)
    const x1 = Math.max(0, startX)
    const y1 = Math.max(0, startY)
    const x2 = Math.min(frame.width, startX + bitmap.width)
    const y2 = Math.min(frame.height, startY + bitmap.height)

    if (x1 >= x2 || y1 >= y2) return

    for (let py = y1; py < y2; py += 1) {
        const sourceRow = (py - startY) * bitmap.width
        const targetRow = py * frame.width

        for (let px = x1; px < x2; px += 1) {
            const alpha = bitmap.buffer[sourceRow + (px - startX)] ?? 0
            if (alpha >= threshold) {
                frame.buffer[targetRow + px] = resolveDrawColor(color, {
                    x: px,
                    y: py,
                })
            }
        }
    }
}

export function drawLineWithThickness(
    from: Position,
    to: Position,
    thickness: number,
    setPixel: (x: number, y: number) => void,
    butt: boolean = false,
): void {
    if (thickness <= 0) return

    const dx = to.x - from.x
    const dy = to.y - from.y
    const lengthSquared = dx * dx + dy * dy
    const radius = thickness / 2
    const radiusSquared = radius * radius

    if (butt && lengthSquared === 0) return

    const minX = Math.floor(Math.min(from.x, to.x) - radius)
    const maxX = Math.ceil(Math.max(from.x, to.x) + radius)
    const minY = Math.floor(Math.min(from.y, to.y) - radius)
    const maxY = Math.ceil(Math.max(from.y, to.y) + radius)

    for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
            const px = x + 0.5
            const py = y + 0.5

            const projection =
                lengthSquared === 0
                    ? 0
                    : ((px - from.x) * dx + (py - from.y) * dy) / lengthSquared

            if (butt && (projection < 0 || projection > 1)) continue

            const t = butt ? projection : Math.max(0, Math.min(1, projection))

            const nearestX = from.x + t * dx
            const nearestY = from.y + t * dy

            const distanceSquared = (px - nearestX) ** 2 + (py - nearestY) ** 2

            if (distanceSquared <= radiusSquared) {
                setPixel(x, y)
            }
        }
    }
}

export function normalizeRadii(
    radii: Quad<number>,
    width: number,
    height: number,
): Quad<number> {
    const [tl, tr, br, bl] = radii.map((r) =>
        Math.max(0, r),
    ) as unknown as Quad<number>

    const scale = Math.min(
        1,
        width / (tl + tr || 1),
        width / (bl + br || 1),
        height / (tl + bl || 1),
        height / (tr + br || 1),
    )

    return [tl * scale, tr * scale, br * scale, bl * scale]
}

export function insideRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii: Quad<number>,
): boolean {
    if (x < 0 || y < 0 || x >= width || y >= height) {
        return false
    }

    const [tl, tr, br, bl] = radii

    let cx: number
    let cy: number
    let radius: number

    if (x < tl && y < tl) {
        cx = tl
        cy = tl
        radius = tl
    } else if (x > width - tr && y < tr) {
        cx = width - tr
        cy = tr
        radius = tr
    } else if (x > width - br && y > height - br) {
        cx = width - br
        cy = height - br
        radius = br
    } else if (x < bl && y > height - bl) {
        cx = bl
        cy = height - bl
        radius = bl
    } else {
        return true
    }

    const dx = x - cx
    const dy = y - cy

    return dx * dx + dy * dy <= radius * radius
}
