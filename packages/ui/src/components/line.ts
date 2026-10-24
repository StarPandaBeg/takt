import { DrawColor } from '../helpers.js'
import { definePrimitive } from '../primitive.js'

export interface LineProps {
    readonly dx: number
    readonly dy: number
    readonly stroke?: boolean
    readonly strokeColor?: DrawColor
    readonly strokeWidth?: number
    readonly butt?: boolean
}

/** WARNING: Invalid bounding box calculation - please draw lines only in scene root
 * @see \@takt/renderer
 */
export const Line = definePrimitive(
    'line',
    ({ stroke, strokeColor, strokeWidth, butt, ...props }: LineProps) => ({
        ...props,
        stroke: stroke ?? true,
        strokeColor: strokeColor ?? DrawColor.BLACK,
        strokeWidth: Math.max(strokeWidth ?? 1, 0),
        butt: butt ?? false,
    }),
)
