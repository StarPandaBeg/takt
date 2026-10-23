export const FramePixel = {
    WHITE: 0,
    BLACK: 1,
} as const

export type FramePixel = (typeof FramePixel)[keyof typeof FramePixel]
