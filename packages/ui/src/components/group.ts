import { definePrimitive } from '../primitive.js'
import type { JSXChild } from '../types/index.js'

export interface GroupProps {
    readonly children?: JSXChild
}

export const Group = definePrimitive('group', (props: GroupProps) => props)
