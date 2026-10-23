import type { UINode } from '@takt/ui'
import type { LayoutRoot, RenderEnvironment, Size } from '../types.js'
import { arrangeNode, measureNode } from './layout.js'

export function computeLayout(
    nodes: readonly UINode[],
    viewport: Size,
    env: RenderEnvironment,
): LayoutRoot {
    const measured = nodes.map((node) => measureNode(node, viewport, env))

    return {
        bounds: {
            x: 0,
            y: 0,
            ...viewport,
        },
        children: measured.map((node) =>
            arrangeNode(node, {
                x: node.node.props.x,
                y: node.node.props.y,
                ...node.size,
            }),
        ),
    }
}
