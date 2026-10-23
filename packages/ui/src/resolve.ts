import { Fragment } from './jsx-runtime.js'
import { isNodeType } from './node-registry.js'
import { type Component, type JSXChild, type UINode } from './types/index.js'

function isChildArray(input: JSXChild): input is readonly JSXChild[] {
    return Array.isArray(input)
}

export function resolve(input: JSXChild): UINode[] {
    if (input == null || typeof input === 'boolean') {
        return []
    }

    if (isChildArray(input)) {
        return input.flatMap(resolve)
    }
    if (typeof input === 'string' || typeof input === 'number') {
        throw new TypeError('Text values must be wrapped in the Text component')
    }

    const { type, props } = input

    if (type === Fragment) {
        return resolve(props.children)
    }
    if (typeof type === 'function') {
        return resolve((type as Component)(props))
    }
    if (!isNodeType(type)) {
        throw new Error(`Unsupported JSX element type: ${String(type)}`)
    }

    const { children, ...nodeProps } = props
    return [
        {
            type,
            props: nodeProps,
            children: resolve(children),
        },
    ]
}
