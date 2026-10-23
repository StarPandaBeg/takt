import { jsx } from './jsx-runtime.js'
import type { JSXNode, PositionProps } from './types/index.js'

declare const normalizedProps: unique symbol

export type NormalizedPositionProps = {
    readonly x: number
    readonly y: number
}

export interface PrimitiveComponent<
    TType extends string,
    TInput extends object,
    TNormalized extends object,
> {
    (props: TInput & PositionProps): JSXNode
    readonly nodeType: TType
    readonly [normalizedProps]: TNormalized
}

export type AnyPrimitiveComponent = PrimitiveComponent<string, never, object>

export type NormalizedPropsOf<TComponent> =
    TComponent extends PrimitiveComponent<string, never, infer TProps>
        ? TProps
        : never

type NormalizedProps<TProps extends object> = Readonly<
    Omit<TProps, 'children' | 'x' | 'y'> & NormalizedPositionProps
>

/** Defines a primitive and the single normalization step for its props. */
export function definePrimitive<
    const TType extends string,
    TInput extends object,
    TProps extends object,
>(
    nodeType: TType,
    normalize: (props: TInput & PositionProps) => TProps,
): PrimitiveComponent<TType, TInput, NormalizedProps<TProps>> {
    const component = (props: TInput & PositionProps): JSXNode => {
        const normalized = normalize(props)

        // NodeType is derived from the registry containing this component, so
        // the generic string becomes a valid JSX node after registration.
        return jsx(nodeType as never, {
            ...normalized,
            x: props.x ?? 0,
            y: props.y ?? 0,
        })
    }

    return Object.assign(component, { nodeType }) as PrimitiveComponent<
        TType,
        TInput,
        NormalizedProps<TProps>
    >
}

type RegistryOf<TComponents extends readonly AnyPrimitiveComponent[]> = {
    [TComponent in TComponents[number] as TComponent['nodeType']]: TComponent
}

export function defineNodeRegistry<
    const TComponents extends readonly AnyPrimitiveComponent[],
>(components: TComponents): RegistryOf<TComponents> {
    const registry: Record<string, AnyPrimitiveComponent> = {}

    for (const component of components) {
        if (Object.hasOwn(registry, component.nodeType)) {
            throw new Error(`Duplicate primitive type: ${component.nodeType}`)
        }
        registry[component.nodeType] = component
    }

    // Object construction cannot preserve the key/component correlation that
    // is present in the tuple, so it is restored once at this boundary.
    return registry as RegistryOf<TComponents>
}
