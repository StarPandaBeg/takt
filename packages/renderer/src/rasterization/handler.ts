import type { NodeType } from '@takt/ui'
import type { LayoutDataOf } from '../layout/layout.js'
import type {
    LayoutNodeOf,
    RenderedFrame,
    RenderEnvironment,
} from '../types.js'

export interface DrawHandler<
    T extends NodeType,
    TLayoutData = LayoutDataOf<T>,
> {
    draw: (
        layout: LayoutNodeOf<T, TLayoutData>,
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
