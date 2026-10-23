import { Group } from './components/group.js'
import { Rect } from './components/rect.js'
import { Text } from './components/text.js'
import { defineNodeRegistry, type NormalizedPropsOf } from './primitive.js'

export const nodeRegistry = defineNodeRegistry([Group, Rect, Text] as const)

export type NodeType = keyof typeof nodeRegistry

export type NodeProps<TType extends NodeType> = NormalizedPropsOf<
    (typeof nodeRegistry)[TType]
>

export function isNodeType(value: unknown): value is NodeType {
    return typeof value === 'string' && Object.hasOwn(nodeRegistry, value)
}
