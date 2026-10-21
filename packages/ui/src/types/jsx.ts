import type { NodeType } from '../node-registry.js'

export const Fragment: unique symbol = Symbol.for('takt.fragment')

export type JSXChild =
    JSXNode | string | number | boolean | null | undefined | readonly JSXChild[]

export type JSXProps = Readonly<Record<string, unknown>> & {
    readonly children?: JSXChild
}

export type Component<P extends object = JSXProps> = (props: P) => JSXChild
export type JSXElementType = NodeType | typeof Fragment | Component<never>
export type Key = string | number

export type PropsWithRequiredChildren<P extends object = object> = P & {
    readonly children: NonNullable<JSXChild>
}

export interface JSXNode {
    readonly type: JSXElementType
    readonly props: JSXProps
    readonly key?: Key
}
