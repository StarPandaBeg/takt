import type { NodeType } from '@takt/ui'
import type { LayoutNode, RenderedFrame, RenderEnvironment } from '../types.js'
import type { DrawHandler } from './handler.js'
import { GroupRenderer } from './render-group.js'
import { RectRenderer } from './render-rect.js'
import { TextRenderer } from './render-text.js'

export type DrawRegistry = {
    [T in NodeType]?: DrawHandler<T>
}

export const drawRegistry: DrawRegistry = {
    rect: RectRenderer,
    text: TextRenderer,
    group: GroupRenderer,
}

function getHandler(layout: LayoutNode): DrawHandler<NodeType> | null {
    const handler = drawRegistry[layout.node.type]
    if (!handler) return null

    // TypeScript теряет корреляцию node.type и обработчика.
    // Проверка соответствия производится типом DrawRegistry.
    return handler as DrawHandler<NodeType>
}

export function drawNode(
    layout: LayoutNode,
    frame: RenderedFrame,
    ctx: RenderEnvironment,
) {
    const handler = getHandler(layout)
    if (!handler) return
    handler.draw(layout, frame, ctx)
}
