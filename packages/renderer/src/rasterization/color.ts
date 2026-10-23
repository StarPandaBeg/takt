import { DrawColor } from '@takt/ui'
import { FramePixel } from '../frame-pixel.js'

const framePixelByDrawColor = {
    [DrawColor.WHITE]: FramePixel.WHITE,
    [DrawColor.BLACK]: FramePixel.BLACK,
} satisfies Record<DrawColor, FramePixel>

export function resolveDrawColor(color: DrawColor): FramePixel {
    return framePixelByDrawColor[color]
}
