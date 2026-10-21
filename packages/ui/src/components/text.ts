import { jsx } from '../jsx-runtime.js'
import type { PropsWithRequiredChildren } from '../types.js'

export type TextProps = PropsWithRequiredChildren

export function Text(props: TextProps) {
    return jsx('text', props)
}
