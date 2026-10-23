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

        const pixel = resolveDrawColor(layout.node.props.fillColor)
        for (let y = y1; y < y2; y += 1) {
            const index = y * frame.width + x1
            frame.buffer.fill(pixel, index, index + (x2 - x1))
        }
    },
})
