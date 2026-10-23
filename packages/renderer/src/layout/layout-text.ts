import { getTextStyle } from '../text-style.js'
import { defineLayout } from './handler.js'

export const TextLayout = defineLayout('text', {
    measure(node, ctx) {
        return {
            size: ctx.measureText(node.props.value, getTextStyle(node.props)),
            children: [],
        }
    },

    arrange() {
        return []
    },
})
