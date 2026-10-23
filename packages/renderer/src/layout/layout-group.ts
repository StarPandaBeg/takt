import { defineLayout } from './handler.js'
import { maxSize } from './helpers.js'

export const GroupLayout = defineLayout('group', {
    measure(node, ctx) {
        const children = node.children.map((child) =>
            ctx.measureChild(child, ctx.constraints),
        )

        const width = maxSize(
            children,
            (node) => node.node.props.x + node.size.width,
        )
        const height = maxSize(
            children,
            (node) => node.node.props.y + node.size.height,
        )

        return {
            size: { width, height },
            children,
        }
    },

    arrange(measured, ctx) {
        return measured.children.map((child) => {
            return ctx.placeChild(child, child.node.props.x, child.node.props.y)
        })
    },
})
