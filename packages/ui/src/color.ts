export const DrawColor = {
    BLACK: 'black',
    GRAY_75: 'gray_75',
    GRAY_50: 'gray_50',
    GRAY_25: 'gray_25',
    WHITE: 'white',
} as const

export type DrawColor = (typeof DrawColor)[keyof typeof DrawColor]
