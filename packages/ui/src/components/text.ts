import type { DrawColor } from '../helpers.js'
import { jsx } from '../jsx-runtime.js'

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type TextValue = string | number

export interface TextFormat {
    readonly fontSize?: number
    readonly fontFamily?: string
    readonly fontWeight?: FontWeight
    readonly italic?: boolean
    readonly underline?: boolean
}

export interface TextProps extends TextFormat {
    readonly children: TextValue | readonly TextValue[]
    readonly color?: DrawColor
    readonly renderThreshold?: number
    readonly value?: string
}

export function Text({ children, ...props }: TextProps) {
    return jsx('text', {
        ...props,
        value: Array.isArray(children) ? children.join('') : String(children),
    })
}
