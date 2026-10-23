import { defineLayout } from './handler.js'

export const RectLayout = defineLayout('rect', {
    measure(node) {
        return {
            size: {
                width: node.props.width ?? 0,
                height: node.props.height ?? 0,
            },
            children: [],
        }
    },

    arrange() {
        return []
    },
})
