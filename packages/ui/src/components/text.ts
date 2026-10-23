import { jsx } from '../jsx-runtime.js'

export type TextValue = string | number

export interface TextProps {
    readonly children: TextValue | readonly TextValue[]
    readonly fontSize?: number
    readonly value?: string
}

export function Text({ children, ...props }: TextProps) {
    return jsx('text', {
        ...props,
        value: Array.isArray(children)
            ? children.join('')
            : String(children),
    })
}
