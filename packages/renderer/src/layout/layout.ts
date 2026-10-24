import type { NodeOf, NodeType, UINode } from '@takt/ui'
import type {
    Bounds,
    LayoutNode,
    MeasuredNode,
    RenderEnvironment,
    Size,
} from '../types.js'
import type {
    ArrangeContext,
    LayoutHandler,
    MeasureContext,
    StoredLayoutData,
} from './handler.js'
import { FlexLayout } from './layout-flex.js'
import { GroupLayout } from './layout-group.js'
import { LineLayout } from './layout-line.js'
import { RectLayout } from './layout-rect.js'
import { TextLayout } from './layout-text.js'

export type LayoutRegistry = {
    [T in NodeType]: {
        measure(node: NodeOf<T>, context: MeasureContext): unknown
        arrange(measured: never, context: ArrangeContext): LayoutNode[]
    }
}

export type LayoutDataOf<T extends NodeType> =
    (typeof layoutRegistry)[T] extends LayoutHandler<T, infer TLayoutData>
        ? StoredLayoutData<TLayoutData>
        : never

export const layoutRegistry = {
    rect: RectLayout,
    group: GroupLayout,
    text: TextLayout,
    flex: FlexLayout,
    line: LineLayout,
} satisfies LayoutRegistry

function getHandler(node: UINode): LayoutHandler<NodeType, unknown> {
    const handler = layoutRegistry[node.type]

    // TypeScript loses the node/handler correlation and the heterogeneous
    // layout-data type after indexing the registry. Both are restored at the
    // typed registry boundaries used by layout and draw handlers.
    return handler as LayoutHandler<NodeType, unknown>
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
        additionalData: result.additionalData,
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
        additionalData: measured.additionalData,
    }
}
