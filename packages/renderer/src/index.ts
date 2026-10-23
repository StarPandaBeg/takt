import { resolve, type JSXChild, type UINode } from '@takt/ui'
import { computeLayout } from './layout/index.js'
import { rasterize } from './rasterisation/index.js'
import type {
    LayoutNode,
    RenderedFrame,
    RenderEnvironment,
    RenderFunction,
} from './types.js'

export type * from './types.js'

// Оборачиваем все node в группу для корректного будущего рендера
const resolveTree = (child: JSXChild): UINode => {
    return {
        type: 'group',
        props: { x: 0, y: 0 },
        children: resolve(child),
    }
}

const flatten = (layout: LayoutNode): LayoutNode[] => {
    const result: LayoutNode[] = []

    const visit = (node: LayoutNode) => {
        result.push(node)
        node.children.forEach((c) => visit(c))
    }
    visit(layout)

    return result
}

export function createRenderer(env: RenderEnvironment): RenderFunction {
    return async (scene, context, settings): Promise<RenderedFrame> => {
        const tree = resolveTree(scene.generate(context))

        const layout = computeLayout(tree, settings, env)
        const renderList = flatten(layout)

        console.log('Tree', JSON.stringify(tree, null, 2))
        console.log('Layout', JSON.stringify(layout, null, 2))
        console.log('Render List', JSON.stringify(renderList, null, 2))

        const frame = rasterize(renderList, settings)
        return Promise.resolve(frame)
    }
}
