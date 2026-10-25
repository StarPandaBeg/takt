import type { NodeOf, NodeType } from '@takt/ui'
import type {
    Bounds,
    DecodedImage,
    LayoutNode,
    MeasuredNode,
    Size,
    TextStyle,
} from '../types.js'

export interface MeasureContext {
    constraints: Size
    measureChild(child: MeasuredNode['node'], constraints: Size): MeasuredNode
    measureText(value: string, style: TextStyle): Size
    loadImage(src: string): DecodedImage
}

export interface ArrangeContext {
    bounds: Bounds
    placeChild(child: MeasuredNode, x: number, y: number): LayoutNode
}

export type StoredLayoutData<TLayoutData> = [TLayoutData] extends [void]
    ? undefined
    : TLayoutData

export type MeasureResult<TLayoutData> = {
    readonly size: Size
    readonly children: readonly MeasuredNode[]
} & ([TLayoutData] extends [void]
    ? { readonly additionalData?: undefined }
    : { readonly additionalData: TLayoutData })

export interface LayoutHandler<TType extends NodeType, TLayoutData = void> {
    measure: (
        node: NodeOf<TType>,
        context: MeasureContext,
    ) => MeasureResult<TLayoutData>

    arrange: (
        measured: MeasuredNode<TType, StoredLayoutData<TLayoutData>>,
        context: ArrangeContext,
    ) => LayoutNode[]
}

export function defineLayout<T extends NodeType, TLayoutData = void>(
    type: T,
    handler: LayoutHandler<T, TLayoutData>,
): LayoutHandler<T, TLayoutData> {
    return handler
}
