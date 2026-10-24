import { defaultConfig } from '../config.js'
import { DrawColor } from '../helpers.js'
import { definePrimitive } from '../primitive.js'
import type { SizeProps } from '../types/transform.js'

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type TextAlign = 'left' | 'center' | 'right'
export type TextAlignVertical = 'top' | 'center' | 'bottom'
export type TextMetricsMode = 'font' | 'tight'
export type TextValue = string | number

export interface TextFormat {
    readonly fontSize?: number
    readonly fontFamily?: string
    readonly fontWeight?: FontWeight
    readonly italic?: boolean
    readonly underline?: boolean
    readonly lineHeight?: number
    readonly metrics?: TextMetricsMode
}

export interface TextProps extends TextFormat, SizeProps {
    readonly children: TextValue | readonly TextValue[]
    readonly align?: TextAlign
    readonly alignVertical?: TextAlignVertical
    readonly color?: DrawColor
    readonly maxLineWidth?: number
    readonly renderThreshold?: number
    readonly size?: 'default' | 'h1' | 'h2' | 'h3'
}

export const Text = definePrimitive(
    'text',
    ({
        children,
        width,
        height,
        align,
        alignVertical,
        fontSize,
        fontFamily,
        fontWeight,
        italic,
        underline,
        color,
        lineHeight,
        metrics,
        maxLineWidth,
        size,
        renderThreshold,
    }: TextProps) => {
        const typographySize = size ?? 'default'
        const config = defaultConfig.typography[typographySize]

        return {
            value: Array.isArray(children)
                ? children.join('')
                : String(children),
            width: width ?? -1,
            height: height ?? -1,
            align: align ?? 'left',
            alignVertical: alignVertical ?? 'top',
            fontSize: fontSize ?? config.fontSize,
            fontFamily: fontFamily ?? config.fontFamily,
            fontWeight: fontWeight ?? config.fontWeight,
            italic: italic ?? config.italic,
            underline: underline ?? config.underline,
            lineHeight: lineHeight ?? config.lineHeight,
            metrics: metrics ?? config.metrics,
            color: color ?? DrawColor.BLACK,
            maxLineWidth: maxLineWidth ?? -1,
            renderThreshold: renderThreshold ?? 128,
        }
    },
)

export const H1 = (props: Omit<TextProps, 'size'>) => {
    return Text({ ...props, size: 'h1' })
}
export const H2 = (props: Omit<TextProps, 'size'>) => {
    return Text({ ...props, size: 'h2' })
}
export const H3 = (props: Omit<TextProps, 'size'>) => {
    return Text({ ...props, size: 'h3' })
}
