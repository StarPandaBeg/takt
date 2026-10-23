import type { NodeType } from '@takt/ui'
import type { LayoutNode, RenderedFrame, RenderEnvironment } from '../types.js'
import { drawRect } from './draw-rect.js'
import { drawText } from './draw-text.js'
import type { DrawHandler } from './handler.js'

export type DrawRegistry = {
    [T in NodeType]?: DrawHandler<T>
}

export const drawRegistry: DrawRegistry = {
    rect: drawRect,
    text: drawText,
}

function getHandler(
    layout: LayoutNode,
): DrawHandler<NodeType, unknown> | undefined {
    const handler = drawRegistry[layout.node.type]

    // TypeScript loses the node/handler correlation after indexing a mapped
    // registry. DrawRegistry verifies every registered handler.
    return handler as DrawHandler<NodeType, unknown> | undefined
}

export function drawNode(
    layout: LayoutNode,
    frame: RenderedFrame,
    environment: RenderEnvironment,
): void {
    getHandler(layout)?.draw(layout, frame, environment)

    for (const child of layout.children) {
        drawNode(child, frame, environment)
    }
}
