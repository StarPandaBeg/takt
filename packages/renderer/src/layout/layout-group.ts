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
            const props = child.node.props
            const x = 'x' in props && typeof props.x === 'number' ? props.x : 0
            const y = 'y' in props && typeof props.y === 'number' ? props.y : 0
            return ctx.placeChild(child, x, y)
        })
    },
})
