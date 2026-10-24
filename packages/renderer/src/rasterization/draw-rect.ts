import type { Quad } from '@takt/ui'
import { resolveDrawColor } from './color.js'
import { defineDrawHandler } from './handler.js'
import { insideRoundedRect, normalizeRadii, pixelBounds } from './helpers.js'

export const drawRect = defineDrawHandler('rect', {
    draw(layout, frame) {
        const { x, y, width, height } = pixelBounds(layout.bounds)

        const {
            stroke,
            strokeWidth,
            strokeColor,
            fill,
            fillColor,
            borderRadius,
        } = layout.node.props

        if ((!fill && !stroke) || width <= 0 || height <= 0) return
        const radii = normalizeRadii(borderRadius, width, height)
        const border = stroke ? Math.max(0, strokeWidth) : 0

        const innerWidth = width - border * 2
        const innerHeight = height - border * 2

        const innerRadii = radii.map((r) =>
            Math.max(0, r - border),
        ) as unknown as Quad<number>

        const x1 = Math.max(0, Math.floor(x))
        const y1 = Math.max(0, Math.floor(y))
        const x2 = Math.min(frame.width, Math.ceil(x + width))
        const y2 = Math.min(frame.height, Math.ceil(y + height))

        for (let py = y1; py < y2; py++) {
            for (let px = x1; px < x2; px++) {
                const localX = px + 0.5 - x
                const localY = py + 0.5 - y

                if (!insideRoundedRect(localX, localY, width, height, radii))
                    continue

                const insideInner =
                    innerWidth > 0 &&
                    innerHeight > 0 &&
                    insideRoundedRect(
                        localX - border,
                        localY - border,
                        innerWidth,
                        innerHeight,
                        innerRadii,
                    )

                if (!insideInner && border > 0) {
                    frame.buffer[py * frame.width + px] = resolveDrawColor(
                        strokeColor,
                        { x: px, y: py },
                    )
                } else if (fill) {
                    frame.buffer[py * frame.width + px] = resolveDrawColor(
                        fillColor,
                        { x: px, y: py },
                    )
                }
            }
        }
    },
})
