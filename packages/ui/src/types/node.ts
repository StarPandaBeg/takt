import type { NodeProps, NodeType } from '../node-registry.js'

export type UINode = {
    [TType in NodeType]: {
        readonly type: TType
        readonly props: Readonly<NodeProps<TType>>
        readonly children: readonly UINode[]
    }
}[NodeType]

export type NodeOf<T extends NodeType> = Extract<UINode, { type: T }>
