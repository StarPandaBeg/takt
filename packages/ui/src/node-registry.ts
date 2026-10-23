import { Group } from './components/group.js'
import { Rect } from './components/rect.js'
import { Text } from './components/text.js'
import type { PositionProps } from './types/transform.js'

export const nodeRegistry = {
    rect: Rect,
    text: Text,
    group: Group,
} as const

export type NodeType = keyof typeof nodeRegistry

export type NodeProps<TType extends NodeType> = PositionProps &
    Omit<Parameters<(typeof nodeRegistry)[TType]>[0], 'children'>

export function isNodeType(value: unknown): value is NodeType {
    return typeof value === 'string' && Object.hasOwn(nodeRegistry, value)
}
