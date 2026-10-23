import { resolveDrawColor } from './color.js'
import { defineDrawHandler } from './handler.js'
import { pixelBounds } from './helpers.js'

export const drawRect = defineDrawHandler('rect', {
    draw(layout, frame) {
        if (!layout.node.props.fill) return

        const bounds = pixelBounds(layout.bounds)
        const x1 = Math.max(0, bounds.x)
        const y1 = Math.max(0, bounds.y)
        const x2 = Math.min(frame.width, bounds.x + bounds.width)
        const y2 = Math.min(frame.height, bounds.y + bounds.height)

        if (x1 >= x2 || y1 >= y2) return

        for (let y = y1; y < y2; y += 1) {
            for (let x = x1; x < x2; x++) {
                const index = y * frame.width + x
                frame.buffer[index] = resolveDrawColor(
                    layout.node.props.fillColor,
                    { x, y },
                )
            }
        }
    },
})
