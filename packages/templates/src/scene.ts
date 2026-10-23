import type { JSXChild } from '@takt/ui'

export interface Scene<TContext = unknown> {
    readonly generate: (context: TContext) => JSXChild
}

export function defineScene<TContext>(
    generate: (context: TContext) => JSXChild,
): Scene<TContext> {
    return { generate }
}
