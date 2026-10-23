export const DrawColor = {
    BLACK: 'black',
    WHITE: 'white',
} as const

export type DrawColor = (typeof DrawColor)[keyof typeof DrawColor]
