import { jsx } from '@takt/ui/jsx-runtime'
import { DrawColor } from '../helpers.js'
import type { TransformProps } from '../types/transform.js'

export interface RectProps extends TransformProps {
    readonly fill?: boolean
    readonly fillColor?: DrawColor
}

export function Rect(props: RectProps) {
    return jsx('rect', {
        ...props,
        fill: props.fill ?? false,
        fillColor: props.fillColor ?? DrawColor.BLACK,
    })
}
