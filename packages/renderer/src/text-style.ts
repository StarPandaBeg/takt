import type { NodeProps } from '@takt/ui'
import type { TextStyle } from './types.js'

export function getTextStyle(props: NodeProps<'text'>): TextStyle {
    return {
        fontSize: props.fontSize,
        fontFamily: props.fontFamily,
        fontWeight: props.fontWeight,
        italic: props.italic,
        underline: props.underline,
        lineHeight: props.lineHeight,
    }
}
