import { DrawColor } from '@takt/ui'
import { defineRenderer } from './handler.js'
import { blitTextBitmap } from './helpers.js'

export const TextRenderer = defineRenderer('text', {
    draw(layout, frame, context) {
        const { value } = layout.node.props
        if (!value) return

        const bitmap = context.rasterizeText(value, layout.node.props)
        blitTextBitmap(
            frame,
            bitmap,
            layout.bounds.x,
            layout.bounds.y,
            layout.node.props.color ?? DrawColor.BLACK,
            layout.node.props.renderThreshold ?? 128,
        )
    },
})
