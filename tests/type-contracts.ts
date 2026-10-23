import type { FramePixel } from '@takt/renderer'
import { defineProject, defineScene } from '@takt/templates'
import {
    definePrimitive,
    type DrawColor,
    type NodeProps,
    type NodeType,
    type NormalizedPropsOf,
    type PositionProps,
} from '@takt/ui'
import type { Text } from '@takt/ui/components'

type Equal<TLeft, TRight> =
    (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2
        ? true
        : false

type Expect<T extends true> = T

export const Badge = definePrimitive(
    'badge',
    ({ active }: { readonly active?: boolean }) => ({
        active: active ?? false,
    }),
)

const contextualScene = defineScene((context: { readonly title: string }) =>
    context.title.length > 0 ? null : false,
)
export const contextualProject = defineProject({
    settings: { screen: { width: 1, height: 1 }, custom: true },
    scenes: { contextual: contextualScene },
})

export type TypeContractAssertions = [
    Expect<Equal<DrawColor, 'black' | 'white'>>,
    Expect<Equal<FramePixel, 0 | 1>>,
    Expect<Equal<Extract<DrawColor, FramePixel>, never>>,
    Expect<Equal<NodeType, 'group' | 'rect' | 'text'>>,
    Expect<Equal<NodeProps<NodeType>['x'], number>>,
    Expect<Equal<NodeProps<NodeType>['y'], number>>,
    Expect<Equal<NodeProps<'text'>['value'], string>>,
    Expect<Equal<NodeProps<'rect'>['fill'], boolean>>,
    Expect<Equal<Parameters<typeof Text>[0]['x'], PositionProps['x']>>,
    Expect<Equal<NormalizedPropsOf<typeof Badge>['active'], boolean>>,
    Expect<Equal<NormalizedPropsOf<typeof Badge>['x'], number>>,
    Expect<
        Equal<
            Parameters<typeof contextualProject.scenes.contextual.generate>[0],
            { readonly title: string }
        >
    >,
    Expect<Equal<typeof contextualProject.settings.custom, true>>,
]
