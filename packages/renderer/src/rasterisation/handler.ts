import type { NodeType } from '@takt/ui'
import type {
    LayoutNodeOf,
    RenderedFrame,
    RenderEnvironment,
} from '../types.js'

export interface DrawHandler<T extends NodeType> {
    draw: (
        layout: LayoutNodeOf<T>,
        frame: RenderedFrame,
        context: RenderEnvironment,
    ) => void
}

export function defineRenderer<T extends NodeType>(
    type: T,
    handler: DrawHandler<T>,
): DrawHandler<T> {
    return handler
}
