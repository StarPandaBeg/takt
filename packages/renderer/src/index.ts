import { resolve } from '@takt/ui'
import { computeLayout } from './layout/index.js'
import { rasterize } from './rasterization/index.js'
import type { RenderEnvironment, RenderFunction, Size } from './types.js'

export * from './frame-pixel.js'
export type * from './types.js'

function validateViewport(viewport: Size): void {
    for (const [name, value] of Object.entries(viewport)) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new RangeError(`Viewport ${name} must be a positive integer`)
        }
    }
}

export function createRenderer(env: RenderEnvironment): RenderFunction {
    return ({ content, viewport }) => {
        validateViewport(viewport)
        const nodes = resolve(content)
        const layout = computeLayout(nodes, viewport, env)
        return rasterize(layout, env)
    }
}
