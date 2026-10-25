import type { JSXChild, NodeOf, NodeProps, NodeType } from '@takt/ui'
import type { ImageSource } from '@takt/ui/components'

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

export interface MeasuredNode<
    TType extends NodeType = NodeType,
    TLayoutData = unknown,
> {
    readonly node: NodeOf<TType>
    readonly size: Size
    readonly children: readonly MeasuredNode[]
    readonly additionalData: TLayoutData
}

export interface LayoutNode<
    TType extends NodeType = NodeType,
    TLayoutData = unknown,
> {
    readonly node: NodeOf<TType>
    readonly bounds: Bounds
    readonly children: readonly LayoutNode[]
    readonly additionalData: TLayoutData
}

export interface TextLayoutData {
    readonly lines: readonly {
        readonly text: string
        readonly x: number
        readonly y: number
    }[]
}

export type LayoutNodeOf<
    T extends NodeType,
    TLayoutData = unknown,
> = LayoutNode<T, TLayoutData>

export interface LayoutRoot {
    readonly bounds: Bounds
    readonly children: readonly LayoutNode[]
}

export type TextStyle = Pick<
    NodeProps<'text'>,
    | 'fontSize'
    | 'fontFamily'
    | 'fontWeight'
    | 'italic'
    | 'underline'
    | 'lineHeight'
    | 'metrics'
>

export interface TextBitmap extends Size {
    readonly buffer: Uint8Array
}

/** Platform-neutral decoded RGBA image, four bytes per row-major pixel. */
export interface DecodedImage extends Size {
    readonly data: Uint8Array
}

export interface RenderEnvironment {
    /** Geometry follows TextStyle.metrics and must match rasterizeText. */
    readonly measureText: (value: string, style: TextStyle) => Size
    /** Bitmap dimensions must match measureText for the same value and style. */
    readonly rasterizeText: (value: string, style: TextStyle) => TextBitmap
    /** Resolves and decodes a local image resource. */
    readonly loadImage: (src: ImageSource) => DecodedImage
}

export interface RenderedFrame {
    readonly width: number
    readonly height: number
    /** Row-major FramePixel values, stored as one byte per pixel. */
    readonly buffer: Uint8Array
}
