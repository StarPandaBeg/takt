import { getTextStyle } from '../text-style.js'
import { defineDrawHandler } from './handler.js'
import { blitTextBitmap } from './helpers.js'

export const drawText = defineDrawHandler('text', {
    draw(layout, frame, environment) {
        const { props } = layout.node
        if (props.value.length === 0) return

        const bitmap = environment.rasterizeText(
            props.value,
            getTextStyle(props),
        )
        blitTextBitmap(
            frame,
            bitmap,
            layout.bounds.x,
            layout.bounds.y,
            props.color,
            props.renderThreshold,
        )
    },
})
