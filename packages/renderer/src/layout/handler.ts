import type { NodeOf, NodeType } from '@takt/ui'
import type { TextFormat } from '@takt/ui/components'
import type { Bounds, LayoutNode, MeasuredNode, Size } from '../types.js'

export interface MeasureContext {
    constraints: Size
    measureChild(child: MeasuredNode['node'], constraints: Size): MeasuredNode
    measureText(value: string, format: TextFormat): Size
}

export interface ArrangeContext {
    bounds: Bounds
    placeChild(child: MeasuredNode, x: number, y: number): LayoutNode
}

export interface LayoutHandler<T extends NodeType> {
    measure: (
        node: NodeOf<T>,
        context: MeasureContext,
    ) => {
        size: Size
        children: MeasuredNode[]
    }

    arrange: (
        measured: MeasuredNode & {
            node: NodeOf<T>
        },
        context: ArrangeContext,
    ) => LayoutNode[]
}

export function defineLayout<T extends NodeType>(
    type: T,
    handler: LayoutHandler<T>,
): LayoutHandler<T> {
    return handler
}
