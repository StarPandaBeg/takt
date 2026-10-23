import { DrawColor } from '../color.js'
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
        renderThreshold,
    }: TextProps) => ({
        value: Array.isArray(children) ? children.join('') : String(children),
        fontSize: fontSize ?? 16,
        fontFamily: fontFamily ?? 'Arial',
        fontWeight: fontWeight ?? 400,
        italic: italic ?? false,
        underline: underline ?? false,
        color: color ?? DrawColor.BLACK,
        maxLineWidth: maxLineWidth ?? -1,
        lineHeight: lineHeight ?? 1.2,
        renderThreshold: renderThreshold ?? 128,
    }),
)
