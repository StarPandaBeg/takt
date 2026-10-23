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
        environment: RenderEnvironment,
    ) => void
}

export function defineDrawHandler<T extends NodeType>(
    type: T,
    handler: DrawHandler<T>,
): DrawHandler<T> {
    return handler
}
