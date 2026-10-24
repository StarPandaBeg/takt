import { defineLayout } from './handler.js'

export const LineLayout = defineLayout('line', {
    measure(node) {
        return {
            size: {
                width: Math.abs(node.props.dx),
                height: Math.abs(node.props.dy),
            },
            children: [],
        }
    },

    arrange() {
        return []
    },
})
