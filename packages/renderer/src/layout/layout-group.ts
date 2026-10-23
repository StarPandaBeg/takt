import { defineLayout } from './handler.js'

export const GroupLayout = defineLayout('group', {
    measure(node, ctx) {
        const children = node.children.map((child) =>
            ctx.measureChild(child, ctx.constraints),
        )
        return {
            size: ctx.constraints,
            children,
        }
    },

    arrange(measured, ctx) {
        return measured.children.map((child) => {
            return ctx.placeChild(child, child.node.props.x, child.node.props.y)
        })
    },
})
