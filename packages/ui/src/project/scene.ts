import type { JSXChild } from '../types.js'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SceneContext {}

export interface Scene<TContext = unknown> {
    generate: (ctx: TContext) => JSXChild
}

export function makeScene<TContext>(
    generate: (ctx: TContext) => JSXChild,
): Scene<TContext> {
    return { generate }
}
