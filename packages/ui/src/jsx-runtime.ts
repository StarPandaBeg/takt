import type {
    Component,
    JSXElementType,
    JSXNode,
    JSXProps,
    Key,
    UINodeType,
} from './types.js'

export const Fragment = Symbol.for('takt.fragment')

export function jsx(
    type: JSXElementType,
    props: object | null,
    key?: Key,
): JSXNode {
    const node: JSXNode = {
        type,
        props: (props ?? {}) as JSXProps,
    }

    return key === undefined ? node : { ...node, key }
}

export const jsxs = jsx

/** Type contract consumed by TypeScript's automatic JSX transform. */
// eslint-disable-next-line @typescript-eslint/no-namespace -- JSX runtimes expose this exact namespace by TypeScript convention.
export namespace JSX {
    export type Element = JSXNode
    export type ElementType = UINodeType | Component<never>

    export interface ElementChildrenAttribute {
        children: unknown
    }

    export interface IntrinsicAttributes {
        key?: Key
    }

    /** Public JSX is component-only; component props are inferred automatically. */
    export type IntrinsicElements = Record<never, never>
}
