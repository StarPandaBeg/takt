import type { JSXChild, NodeOf, NodeProps, NodeType, UINode } from '@takt/ui'

export interface Position {
    readonly x: number
    readonly y: number
}

export interface Size {
    readonly width: number
    readonly height: number
}

export interface Bounds extends Position, Size {}

export interface RenderInput {
    readonly content: JSXChild
    readonly viewport: Size
}

export type RenderFunction = (input: RenderInput) => RenderedFrame

export interface MeasuredNode {
    readonly node: UINode
    readonly size: Size
    readonly children: readonly MeasuredNode[]
}

export interface LayoutNode {
    readonly node: UINode
    readonly bounds: Bounds
    readonly children: readonly LayoutNode[]
}

export type LayoutNodeOf<T extends NodeType> = Omit<LayoutNode, 'node'> & {
    readonly node: NodeOf<T>
}

export interface LayoutRoot {
    readonly bounds: Bounds
    readonly children: readonly LayoutNode[]
}

export type TextStyle = Pick<
    NodeProps<'text'>,
    'fontSize' | 'fontFamily' | 'fontWeight' | 'italic' | 'underline'
>

export interface TextBitmap extends Size {
    readonly buffer: Uint8Array
}

export interface RenderEnvironment {
    readonly measureText: (value: string, style: TextStyle) => Size
    readonly rasterizeText: (value: string, style: TextStyle) => TextBitmap
}

export interface RenderedFrame {
    readonly width: number
    readonly height: number
    /** Row-major FramePixel values, stored as one byte per pixel. */
    readonly buffer: Uint8Array
}
