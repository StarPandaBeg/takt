import {
    calculateQuad,
    DrawColor,
    type Quad,
    type QuadValue,
} from '../helpers.js'
import { definePrimitive } from '../primitive.js'
import type { SizeProps } from '../types/transform.js'

export interface RectProps extends SizeProps {
    readonly fill?: boolean
    readonly fillColor?: DrawColor

    readonly stroke?: boolean
    readonly strokeColor?: DrawColor
    readonly strokeWidth?: number

    readonly borderRadius?: QuadValue<number>
}

export const Rect = definePrimitive(
    'rect',
    ({
        width,
        height,
        fill,
        fillColor,
        stroke,
        strokeColor,
        strokeWidth,
        borderRadius,
    }: RectProps) => {
        const radius: Quad<number> = calculateQuad(borderRadius ?? 0)
        return {
            width: width ?? 0,
            height: height ?? 0,
            fill: fill ?? false,
            fillColor: fillColor ?? DrawColor.BLACK,
            stroke: stroke ?? false,
            strokeColor: strokeColor ?? DrawColor.BLACK,
            strokeWidth: Math.max(0, strokeWidth ?? 1),
            borderRadius: radius,
        }
    },
)
