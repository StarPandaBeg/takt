import type { NodeOf, NodeType, ProjectSettings, Scene, UINode } from '@takt/ui'

export type RenderFunction = <
    TContext,
    TSettings extends ProjectSettings = ProjectSettings,
>(
    scene: Scene<TContext>,
    context: TContext,
    settings: TSettings,
) => Promise<RenderedFrame>

export type ComputeLayoutFunction = <
    TSettings extends ProjectSettings = ProjectSettings,
>(
    node: UINode,
    settings: TSettings,
) => LayoutNode

export interface Renderer {
    render: RenderFunction
}

export interface Position {
    x: number
    y: number
}

export interface Size {
    width: number
    height: number
}

export interface Bounds extends Position, Size {}

export interface MeasuredNode {
    node: UINode
    size: Size
    children: MeasuredNode[]
}

export interface LayoutNode {
    node: UINode
    bounds: Bounds
    children: LayoutNode[]
}

export type LayoutNodeOf<T extends NodeType> = LayoutNode & {
    node: NodeOf<T>
}

export interface RenderEnvironment {
    measureText: (value: string, fontSize: number) => Size
}

export interface RenderedFrame {
    width: number
    height: number
    /** Row-major pixels: 0 is white, every non-zero value is black. */
    buffer: Uint8Array
}
