import { getTextStyle } from '../text-style.js'
import { defineDrawHandler } from './handler.js'
import { blitTextBitmap } from './helpers.js'

export const drawText = defineDrawHandler('text', {
    draw(layout, frame, environment) {
        const { props } = layout.node
        if (props.value.length === 0) return

        const textData = layout.additionalData.textData
        for (const line of textData.lines) {
            const bitmap = environment.rasterizeText(
                line.text,
                getTextStyle(props),
            )

            blitTextBitmap(
                frame,
                bitmap,
                layout.bounds.x + line.x,
                layout.bounds.y + line.y,
                props.color,
                props.renderThreshold,
            )
        }
    },
})
