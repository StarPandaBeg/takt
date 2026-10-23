import { DrawColor } from '../color.js'
import { definePrimitive } from '../primitive.js'
import type { SizeProps } from '../types/transform.js'

export interface RectProps extends SizeProps {
    readonly fill?: boolean
    readonly fillColor?: DrawColor
}

export const Rect = definePrimitive(
    'rect',
    ({ width, height, fill, fillColor }: RectProps) => ({
        width: width ?? 0,
        height: height ?? 0,
        fill: fill ?? false,
        fillColor: fillColor ?? DrawColor.BLACK,
    }),
)
