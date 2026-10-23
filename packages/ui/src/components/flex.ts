import { definePrimitive } from '../primitive.js'
import type { JSXChild } from '../types/jsx.js'
import type { SizeProps } from '../types/transform.js'

export type PaddingValueStrict = [number, number, number, number]
export type PaddingValue =
    number | [number, number] | [number, number, number] | PaddingValueStrict

export interface FlexProps extends SizeProps {
    readonly direction?: 'row' | 'column'
    readonly justify?: 'start' | 'center' | 'end' | 'space-between'
    readonly align?: 'start' | 'center' | 'end'
    readonly padding?: PaddingValue
    readonly gap?: number
    readonly children?: JSXChild
}

function calculatePadding(
    value: PaddingValue,
): [number, number, number, number] {
    if (typeof value == 'number') return [value, value, value, value]
    if (value.length == 2) return [value[0], value[1], value[0], value[1]]
    if (value.length == 3) return [value[0], value[1], value[0], value[2]]
    return value
}

export const Flex = definePrimitive('flex', (props: FlexProps) => {
    const padding: PaddingValueStrict = props.padding
        ? calculatePadding(props.padding)
        : [0, 0, 0, 0]

    return {
        ...props,
        gap: props.gap ?? 0,
        direction: props.direction ?? 'row',
        justify: props.justify ?? 'start',
        align: props.align ?? 'start',
        padding,
        width: props.width ?? -1,
        height: props.height ?? -1,
    }
})
