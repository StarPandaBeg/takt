export const DrawColor = {
    BLACK: 1,
    WHITE: 0,
} as const
export type DrawColor = (typeof DrawColor)[keyof typeof DrawColor]
