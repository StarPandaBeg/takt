import { Fragment } from './jsx-runtime.js'
import type { Component, JSXChild, Props, UINode } from './types.js'

type ResolvedChild = UINode | string | number

function isChildArray(input: JSXChild): input is readonly JSXChild[] {
    return Array.isArray(input)
}

export function resolve(input: JSXChild): ResolvedChild[] {
    if (input == null || typeof input === 'boolean') {
        return []
    }

    if (isChildArray(input)) {
        return input.flatMap(resolve)
    }
    if (typeof input === 'string' || typeof input === 'number') {
        return [input]
    }

    const { type, props } = input

    if (type === Fragment) {
        return resolve(props.children)
    }
    if (typeof type === 'function') {
        const component = type as Component<Props>
        return resolve(component(props))
    }
    if (type !== 'text') {
        throw new Error('Unsupported JSX element type')
    }

    const { children, ...rest } = props
    return [
        {
            type,
            props: rest,
            children: resolve(children),
        },
    ]
}
