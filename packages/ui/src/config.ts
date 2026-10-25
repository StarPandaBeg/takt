import type { TextFormat } from './components/text.js'

export interface DefaultsConfig {
    typography: {
        default: Required<TextFormat>
        h1: Required<TextFormat>
        h2: Required<TextFormat>
        h3: Required<TextFormat>
    }
}

export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends readonly unknown[]
        ? T[K]
        : T[K] extends (...args: never[]) => unknown
          ? T[K]
          : T[K] extends object
            ? DeepPartial<T[K]>
            : T[K]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype
    )
}

function mergeObjects(
    defaults: Record<string, unknown>,
    overrides: Record<string, unknown>,
): Record<string, unknown> {
    const result = { ...defaults }

    for (const [key, override] of Object.entries(overrides)) {
        if (override === undefined) continue

        const original = defaults[key]

        result[key] =
            isPlainObject(original) && isPlainObject(override)
                ? mergeObjects(original, override)
                : override
    }

    return result
}

export function deepMerge<T extends object>(
    defaults: T,
    overrides: DeepPartial<T>,
): T {
    return mergeObjects(defaults as Record<string, unknown>, overrides) as T
}

const defaultTypography: Required<TextFormat> = {
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 400,
    italic: false,
    lineHeight: 1.2,
    metrics: 'font',
    underline: false,
    strikethrough: false,
}

export let defaultConfig: Readonly<DefaultsConfig> = {
    typography: {
        default: defaultTypography,
        h1: deepMerge(defaultTypography, {
            fontSize: 28,
            fontWeight: 600,
        }),
        h2: deepMerge(defaultTypography, {
            fontSize: 24,
            fontWeight: 500,
        }),
        h3: deepMerge(defaultTypography, {
            fontSize: 20,
            fontWeight: 500,
        }),
    },
}

export const setConfig = (cfg: DeepPartial<DefaultsConfig>) => {
    defaultConfig = deepMerge(defaultConfig, cfg)
}
