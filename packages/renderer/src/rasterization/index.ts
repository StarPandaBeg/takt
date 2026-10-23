import type { LayoutRoot, RenderedFrame, RenderEnvironment } from '../types.js'
import { drawNode } from './draw.js'

export function rasterize(
    layout: LayoutRoot,
    environment: RenderEnvironment,
): RenderedFrame {
    const frame: RenderedFrame = {
        width: layout.bounds.width,
        height: layout.bounds.height,
        buffer: new Uint8Array(layout.bounds.width * layout.bounds.height),
    }

    for (const child of layout.children) {
        drawNode(child, frame, environment)
    }

    return frame
}
