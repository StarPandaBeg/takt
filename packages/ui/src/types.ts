export type UINodeType = 'text'

export type JSXChild =
    JSXNode | string | number | boolean | null | undefined | readonly JSXChild[]

export type Props = Readonly<Record<string, unknown>>
export type JSXProps = Props & PropsWithChildren
/** A function component accepted by the custom JSX runtime. */
export type Component<P extends object = Props> = (props: P) => JSXChild
export type JSXElementType = UINodeType | symbol | Component<never>
export type Key = string | number

export type PropsWithRequiredChildren<P extends object = object> = P & {
    readonly children: NonNullable<JSXChild>
}
export type PropsWithChildren<P extends object = object> = P & {
    readonly children?: JSXChild
}

export interface JSXNode {
    readonly type: JSXElementType
    readonly props: JSXProps
    readonly key?: Key
}

export interface UINode {
    readonly type: UINodeType
    readonly props: Props
    readonly children: readonly (UINode | string | number)[]
}
