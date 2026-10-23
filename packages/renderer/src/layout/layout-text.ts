// text-layout.ts

import { defineLayout } from './handler.js'

export const TextLayout = defineLayout('text', {
    measure(node, ctx) {
        return {
            size: ctx.measureText(
                node.props.value ?? '',
                node.props.fontSize ?? 16,
            ),
            children: [],
        }
    },

    arrange() {
        return []
    },
})
