import type { Size } from '../types.js'
import { defineLayout } from './handler.js'
import { maxSize, sumSize } from './helpers.js'

export const FlexLayout = defineLayout('flex', {
    measure(node, ctx) {
        const children = node.children.map((child) =>
            ctx.measureChild(child, ctx.constraints),
        )
        const { direction, gap, width, height, padding } = node.props
        const isRow = direction === 'row'

        const paddingX = padding[1] + padding[3]
        const paddingY = padding[0] + padding[2]

        const mainSize = sumSize(
            children,
            (child) => (isRow ? child.size.width : child.size.height),
            gap,
        )
        const crossSize = maxSize(children, (child) =>
            isRow ? child.size.height : child.size.width,
        )

        return {
            size: {
                width:
                    width >= 0
                        ? width
                        : (isRow ? mainSize : crossSize) + paddingX,
                height:
                    height >= 0
                        ? height
                        : (isRow ? crossSize : mainSize) + paddingY,
            },
            children,
        }
    },

    arrange(measured, ctx) {
        const { direction, gap, justify, align, padding } = measured.node.props
        const isRow = direction === 'row'
        const [top, right, bottom, left] = padding

        const getMainSize = (size: Size) => (isRow ? size.width : size.height)
        const getCrossSize = (size: Size) => (isRow ? size.height : size.width)

        const innerWidth = Math.max(0, measured.size.width - left - right)
        const innerHeight = Math.max(0, measured.size.height - top - bottom)

        const innerSize = {
            width: innerWidth,
            height: innerHeight,
        }

        const mainSize = getMainSize(innerSize)
        const crossSize = getCrossSize(innerSize)

        const contentSize = sumSize(
            measured.children,
            (child) => getMainSize(child.size),
            gap,
        )

        const freeSpace = Math.max(0, mainSize - contentSize)

        let offset = 0
        let spacing = gap

        switch (justify) {
            case 'center':
                offset = freeSpace / 2
                break

            case 'end':
                offset = freeSpace
                break

            case 'space-between':
                if (measured.children.length > 1) {
                    spacing += freeSpace / (measured.children.length - 1)
                }
                break
        }

        let cursor = offset

        return measured.children.map((child) => {
            const childCrossSize = getCrossSize(child.size)

            let crossOffset = 0
            if (align === 'center') {
                crossOffset = Math.max(0, (crossSize - childCrossSize) / 2)
            } else if (align === 'end') {
                crossOffset = Math.max(0, crossSize - childCrossSize)
            }

            const x = isRow ? cursor : crossOffset
            const y = isRow ? crossOffset : cursor

            const result = ctx.placeChild(child, x + left, y + top)
            cursor += getMainSize(child.size) + spacing

            return result
        })
    },
})
