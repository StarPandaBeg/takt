import { defaultConfig } from '../config.js'
import { DrawColor } from '../helpers.js'
import { definePrimitive } from '../primitive.js'

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type TextValue = string | number

export interface TextFormat {
    readonly fontSize?: number
    readonly fontFamily?: string
    readonly fontWeight?: FontWeight
    readonly italic?: boolean
    readonly underline?: boolean
    readonly lineHeight?: number
}

export interface TextProps extends TextFormat {
    readonly children: TextValue | readonly TextValue[]
    readonly color?: DrawColor
    readonly maxLineWidth?: number
    readonly renderThreshold?: number
    readonly size?: 'default' | 'h1' | 'h2' | 'h3'
}

export const Text = definePrimitive(
    'text',
    ({
        children,
        fontSize,
        fontFamily,
        fontWeight,
        italic,
        underline,
        color,
        lineHeight,
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
            fontSize: fontSize ?? config.fontSize,
            fontFamily: fontFamily ?? config.fontFamily,
            fontWeight: fontWeight ?? config.fontWeight,
            italic: italic ?? config.italic,
            underline: underline ?? config.underline,
            lineHeight: lineHeight ?? config.lineHeight,
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
