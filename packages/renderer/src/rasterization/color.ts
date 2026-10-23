import { DrawColor } from '@takt/ui'
import { FramePixel } from '../frame-pixel.js'
import type { Position } from '../types.js'

const BAYER_2X2 = [
    [0, 2],
    [3, 1],
] as const

export function resolveDrawColor(
    color: DrawColor,
    position: Position,
): FramePixel {
    if (color === 'black') return FramePixel.BLACK
    if (color === 'white') return FramePixel.WHITE

    const level = {
        gray_25: 1,
        gray_50: 2,
        gray_75: 3,
    }[color]

    const x = ((position.x % 2) + 2) % 2
    const y = ((position.y % 2) + 2) % 2

    // @ts-expect-error Value always presented
    return BAYER_2X2[y][x] < level ? FramePixel.BLACK : FramePixel.WHITE
}
