export const DrawColor = {
    BLACK: 'black',
    GRAY_75: 'gray_75',
    GRAY_50: 'gray_50',
    GRAY_25: 'gray_25',
    WHITE: 'white',
} as const

export type DrawColor = (typeof DrawColor)[keyof typeof DrawColor]

export type QuadValue<T = number> =
    | T
    | readonly [T]
    | readonly [T, T]
    | readonly [T, T, T]
    | readonly [T, T, T, T]

export type Quad<T = number> = readonly [T, T, T, T]

export function calculateQuad(value: QuadValue<number>): Quad<number> {
    if (typeof value == 'number') return [value, value, value, value]
    if (value.length == 1) return [value[0], value[0], value[0], value[0]]
    if (value.length == 2) return [value[0], value[1], value[0], value[1]]
    if (value.length == 3) return [value[0], value[1], value[0], value[2]]
    return value
}
