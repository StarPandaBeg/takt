import type { NodeType } from './node-registry.js'
import type {
    Component,
    JSXElementType,
    JSXNode,
    JSXProps,
    Key,
} from './types/index.js'
import { Fragment } from './types/jsx.js'

export { Fragment }

export function jsx(
    type: JSXElementType,
    props: object | null,
    key?: Key,
): JSXNode {
    const node = {
        type,
        props: (props ?? {}) as JSXProps,
    } as const

    return key === undefined ? node : { ...node, key }
}

export const jsxs = jsx

/** Type contract consumed by TypeScript's automatic JSX transform. */
// eslint-disable-next-line @typescript-eslint/no-namespace -- JSX runtimes expose this exact namespace by TypeScript convention.
export namespace JSX {
    export type Element = JSXNode
    export type ElementType = NodeType | Component<never>

    export interface ElementChildrenAttribute {
        children: unknown
    }

    export interface IntrinsicAttributes {
        key?: Key
    }

    /** Public JSX is component-only; component props are inferred automatically. */
    export type IntrinsicElements = Record<never, never>
}
