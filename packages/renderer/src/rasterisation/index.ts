import type { ProjectSettings } from '@takt/ui'
import type { LayoutNode, RenderedFrame, RenderEnvironment } from '../types.js'
import { drawNode } from './rasterisation.js'

export function rasterize<TSettings extends ProjectSettings>(
    renderList: LayoutNode[],
    settings: TSettings,
    context: RenderEnvironment,
): RenderedFrame {
    const bufferSize = settings.screen.width * settings.screen.height
    const buffer = new Uint8Array(bufferSize)

    const frame = {
        width: settings.screen.width,
        height: settings.screen.height,
        buffer,
    }
    for (const item of renderList) {
        drawNode(item, frame, context)
    }

    return frame
}
