import { getTextStyle } from '../text-style.js'
import type { Size, TextLayoutData, TextStyle } from '../types.js'
import { defineLayout, type MeasureContext } from './handler.js'

interface MeasuredLine {
    readonly text: string
    readonly size: Size
    readonly y: number
}

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

function getHorizontalOffset(
    align: 'left' | 'center' | 'right',
    containerWidth: number,
    contentWidth: number,
): number {
    if (align === 'center') return (containerWidth - contentWidth) / 2
    if (align === 'right') return containerWidth - contentWidth
    return 0
}

function getVerticalOffset(
    align: 'top' | 'center' | 'bottom',
    containerHeight: number,
    contentHeight: number,
): number {
    if (align === 'center') return (containerHeight - contentHeight) / 2
    if (align === 'bottom') return containerHeight - contentHeight
    return 0
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

            const measuredLines: MeasuredLine[] = []
            let y = 0
            for (const line of lines) {
                const size = ctx.measureText(line, style)
                measuredLines.push({
                    text: line,
                    size,
                    y,
                })
                y += Math.max(size.height, style.fontSize * style.lineHeight)
            }

            const naturalWidth = measuredLines.reduce(
                (width, line) => Math.max(width, line.size.width),
                0,
            )
            const lastLine = measuredLines.at(-1)
            const naturalHeight = lastLine
                ? lastLine.y + lastLine.size.height
                : 0

            const width =
                node.props.width >= 0 ? node.props.width : naturalWidth
            const height =
                node.props.height >= 0 ? node.props.height : naturalHeight
            const verticalOffset = getVerticalOffset(
                node.props.alignVertical,
                height,
                naturalHeight,
            )

            return {
                size: { width, height },
                children: [],
                additionalData: {
                    textData: {
                        lines: measuredLines.map((line) => ({
                            text: line.text,
                            x: getHorizontalOffset(
                                node.props.align,
                                width,
                                line.size.width,
                            ),
                            y: line.y + verticalOffset,
                        })),
                    },
                },
            }
        },

        arrange() {
            return []
        },
    },
)
