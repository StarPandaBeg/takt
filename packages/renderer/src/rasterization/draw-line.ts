import { resolveDrawColor } from './color.js'
import { defineDrawHandler } from './handler.js'
import { drawLineWithThickness } from './helpers.js'

export const drawLine = defineDrawHandler('line', {
    draw(layout, frame) {
        const { stroke, strokeColor, strokeWidth, dx, dy } = layout.node.props

        if (!stroke || strokeWidth <= 0) return

        // bounds.x/y здесь — начало линии, а не левый верхний
        // угол её визуального bounding box.
        const from = {
            x: layout.bounds.x,
            y: layout.bounds.y,
        }
        const to = {
            x: from.x + dx,
            y: from.y + dy,
        }

        const setPixel = (x: number, y: number) => {
            if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) {
                return
            }
            frame.buffer[y * frame.width + x] = resolveDrawColor(strokeColor, {
                x,
                y,
            })
        }

        drawLineWithThickness(
            from,
            to,
            strokeWidth,
            setPixel,
            layout.node.props.butt,
        )
    },
})
