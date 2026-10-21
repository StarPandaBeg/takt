import { jsx } from '../jsx-runtime.js'
import type { PropsWithRequiredChildren } from '../types/jsx.js'

export interface TextProps extends PropsWithRequiredChildren {
    readonly size?: number
}

export function Text(props: TextProps) {
    return jsx('text', { ...props, size: props.size ?? 14 })
}
