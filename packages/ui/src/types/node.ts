import type { NodeProps, NodeType } from '../node-registry.js'

export type UIChild = UINode | string | number

export type UINode = {
    [TType in NodeType]: {
        readonly type: TType
        readonly props: Readonly<NodeProps<TType>>
        readonly children: readonly UIChild[]
    }
}[NodeType]
