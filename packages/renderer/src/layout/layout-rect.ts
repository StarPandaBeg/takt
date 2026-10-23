import { defineLayout } from './handler.js'

export const RectLayout = defineLayout('rect', {
    measure(node) {
        return {
            size: {
                width: node.props.width,
                height: node.props.height,
            },
            children: [],
        }
    },

    arrange() {
        return []
    },
})
