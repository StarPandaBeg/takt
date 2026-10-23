import type { ProjectSettings, UINode } from '@takt/ui'
import type { LayoutNode, RenderEnvironment } from '../types.js'
import { arrangeNode, measureNode } from './layout.js'

export function computeLayout<T extends ProjectSettings = ProjectSettings>(
    node: UINode,
    settings: T,
    env: RenderEnvironment,
): LayoutNode {
    const measured = measureNode(
        node,
        {
            width: settings.screen.width,
            height: settings.screen.height,
        },
        env,
    )
    return arrangeNode(measured, {
        x: 0,
        y: 0,
        ...measured.size,
    })
}
