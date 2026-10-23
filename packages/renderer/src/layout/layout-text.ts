import { getTextStyle } from '../text-style.js'
import type { TextLayoutData, TextStyle } from '../types.js'
import { defineLayout, type MeasureContext } from './handler.js'

function splitTextOnLines(
    value: string,
    style: TextStyle,
    ctx: MeasureContext,
    maxWidth: number = -1,
): string[] {
    const lines = value.split('\n')
    if (maxWidth < 0) return lines
    if (maxWidth == 0) return []

    const newLines = []

    for (const line of lines) {
        const measured = ctx.measureText(line, style)

        if (measured.width <= maxWidth) {
            newLines.push(line)
            continue
        }

        let currentLine = line
        let lineWidth = measured.width
        while (lineWidth > maxWidth) {
            const words = currentLine.split(' ')
            if (words.length <= 1) {
                if (words.length > 0) newLines.push(words[0]!)
                currentLine = ''
                break
            }

            let maxLine = words[0]!
            let index = 1

            while (index < words.length) {
                const nextLine = maxLine + ' ' + words[index]
                const nextMeasure = ctx.measureText(nextLine, style)

                if (nextMeasure.width >= maxWidth) break
                index++
                maxLine = nextLine
            }
            newLines.push(maxLine)
            currentLine = words.slice(index).join(' ')
            lineWidth = ctx.measureText(currentLine, style).width
        }

        if (currentLine != '') {
            newLines.push(currentLine)
        }
    }

    return newLines
}

export const TextLayout = defineLayout<'text', { textData: TextLayoutData }>(
    'text',
    {
        measure(node, ctx) {
            const style = getTextStyle(node.props)
            const lines = splitTextOnLines(
                node.props.value,
                style,
                ctx,
                node.props.maxLineWidth,
            )

            const linesPositioned = []
            let y = 0
            for (const line of lines) {
                const measure = ctx.measureText(line, style)
                linesPositioned.push({
                    text: line,
                    x: 0,
                    y,
                })
                y += measure.height * node.props.lineHeight
            }

            return {
                size: ctx.measureText(
                    node.props.value,
                    getTextStyle(node.props),
                ),
                children: [],
                additionalData: {
                    textData: {
                        lines: linesPositioned,
                        lineHeight: style.lineHeight,
                    },
                },
            }
        },

        arrange() {
            return []
        },
    },
)
