import { jsx } from '../jsx-runtime.js'
import type { PropsWithRequiredChildren } from '../types.js'

export interface TextProps extends PropsWithRequiredChildren {
    size?: number
}

export function Text(props: TextProps) {
    props.size ??= 14
    return jsx('text', props)
}
