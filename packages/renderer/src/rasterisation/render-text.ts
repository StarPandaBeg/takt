import { defineRenderer } from './handler.js'
import { blitTextBitmap } from './helpers.js'

export const TextRenderer = defineRenderer('text', {
    draw(layout, frame, context) {
        const { value, fontSize } = layout.node.props
        if (!value) return

        const bitmap = context.rasterizeText(value, fontSize ?? 14)
        blitTextBitmap(frame, bitmap, layout.bounds.x, layout.bounds.y)
    },
})
