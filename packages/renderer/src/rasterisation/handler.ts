import type { NodeType } from '@takt/ui'
import type { LayoutNodeOf, RenderedFrame } from '../types.js'

export interface DrawHandler<T extends NodeType> {
    draw: (layout: LayoutNodeOf<T>, frame: RenderedFrame) => void
}

export function defineRenderer<T extends NodeType>(
    type: T,
    handler: DrawHandler<T>,
): DrawHandler<T> {
    return handler
}
