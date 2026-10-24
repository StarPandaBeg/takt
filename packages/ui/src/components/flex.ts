import { calculateQuad, type Quad, type QuadValue } from '../helpers.js'
import { definePrimitive } from '../primitive.js'
import type { JSXChild } from '../types/jsx.js'
import type { SizeProps } from '../types/transform.js'

export interface FlexProps extends SizeProps {
    readonly direction?: 'row' | 'column'
    readonly justify?:
        | 'start'
        | 'center'
        | 'end'
        | 'space-between'
        | 'space-around'
        | 'space-evenly'
    readonly align?: 'start' | 'center' | 'end'
    readonly padding?: QuadValue<number>
    readonly gap?: number
    readonly children?: JSXChild
}

export const Flex = definePrimitive('flex', (props: FlexProps) => {
    const padding: Quad<number> = calculateQuad(props.padding ?? 0)

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

export const Row = (props: Omit<FlexProps, 'direction'>) =>
    Flex({ ...props, direction: 'row' })
export const Column = (props: Omit<FlexProps, 'direction'>) =>
    Flex({ ...props, direction: 'column' })
