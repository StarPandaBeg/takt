import { getTextStyle } from '../text-style.js'
import type { Size, TextLayoutData, TextStyle } from '../types.js'
import { defineLayout, type MeasureContext } from './handler.js'

interface MeasuredLine {
    readonly text: string
    readonly size: Size
    readonly y: number
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
})

function fitPrefix(
    value: string,
    suffix: string,
    maxWidth: number,
    style: TextStyle,
    ctx: MeasureContext,
): string {
    let prefix = ''

    for (const { segment } of graphemeSegmenter.segment(value)) {
        const candidate = prefix + segment + suffix
        if (ctx.measureText(candidate, style).width > maxWidth) break
        prefix += segment
    }

    return prefix + suffix
}

function truncateLine(
    line: string,
    overflow: 'cut' | 'emphasis',
    maxWidth: number,
    style: TextStyle,
    ctx: MeasureContext,
): string {
    if (ctx.measureText(line, style).width <= maxWidth) return line
    if (overflow === 'cut') {
        return fitPrefix(line, '', maxWidth, style, ctx)
    }

    const emphasis = fitPrefix('...', '', maxWidth, style, ctx)
    if (emphasis !== '...') return emphasis
    return fitPrefix(line, emphasis, maxWidth, style, ctx)
}

function wrapLines(
    value: string,
    style: TextStyle,
    ctx: MeasureContext,
    maxWidth: number,
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

function resolveLines(
    value: string,
    overflow: 'cut' | 'emphasis' | 'line',
    maxWidth: number,
    style: TextStyle,
    ctx: MeasureContext,
): string[] {
    const lines = value.split('\n')
    if (maxWidth < 0) return lines
    if (maxWidth === 0) return []
    if (overflow === 'line') {
        return wrapLines(value, style, ctx, maxWidth)
    }
    return lines.map((line) =>
        truncateLine(line, overflow, maxWidth, style, ctx),
    )
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
            const lines = resolveLines(
                node.props.value,
                node.props.overflow,
                node.props.maxLineWidth,
                style,
                ctx,
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
