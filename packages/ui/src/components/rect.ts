import { jsx } from '@takt/ui/jsx-runtime'
import type { TransformProps } from '../types/transform.js'

export interface RectProps extends TransformProps {
    readonly fill?: string
}

export function Rect(props: RectProps) {
    return jsx('rect', { ...props, fill: props.fill ?? 'black' })
}
