// layout.ts

import type { NodeType, UINode } from '@takt/ui'
import type {
    Bounds,
    LayoutNode,
    MeasuredNode,
    RenderEnvironment,
    Size,
} from '../types.js'
import type { LayoutHandler } from './handler.js'
import { GroupLayout } from './layout-group.js'
import { RectLayout } from './layout-rect.js'
import { TextLayout } from './layout-text.js'

export type LayoutRegistry = {
    [T in NodeType]?: LayoutHandler<T>
}

export const layoutRegistry: LayoutRegistry = {
    rect: RectLayout,
    group: GroupLayout,
    text: TextLayout,
}

function getHandler(node: UINode): LayoutHandler<NodeType> {
    const handler = layoutRegistry[node.type]
    if (!handler) {
        throw new Error(`No layout handler for ${node.type}`)
    }

    // TypeScript теряет корреляцию node.type и обработчика.
    // Проверка соответствия производится типом LayoutRegistry.
    return handler as LayoutHandler<NodeType>
}

export function measureNode(
    node: UINode,
    constraints: Size,
    env: RenderEnvironment,
): MeasuredNode {
    const handler = getHandler(node)

    const result = handler.measure(node, {
        constraints,
        measureChild: (child, constraints) =>
            measureNode(child, constraints, env),
        measureText: env.measureText,
    })

    return {
        node,
        size: result.size,
        children: result.children,
    }
}

export function arrangeNode(
    measured: MeasuredNode,
    bounds: Bounds,
): LayoutNode {
    const handler = getHandler(measured.node)

    const children = handler.arrange(measured, {
        bounds,

        placeChild(child, x, y) {
            return arrangeNode(child, {
                x: bounds.x + x,
                y: bounds.y + y,
                ...child.size,
            })
        },
    })

    return {
        node: measured.node,
        bounds,
        children,
    }
}
