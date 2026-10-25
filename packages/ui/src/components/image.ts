import { definePrimitive } from '../primitive.js'
import type { SizeProps } from '../types/transform.js'

export type ImageFit = 'contain' | 'cover' | 'fill'
export type ImageDithering = 'threshold' | 'ordered' | 'floyd-steinberg'
export type ImageBrightness =
    'perceived' | 'average' | 'lightness' | 'red' | 'green' | 'blue'

export interface ImageProps extends SizeProps {
    readonly src: string
    readonly fit?: ImageFit
    readonly smoothing?: boolean
    readonly dithering?: ImageDithering
    readonly brightness?: ImageBrightness
    readonly threshold?: number
    readonly invert?: boolean
}

export const Image = definePrimitive(
    'image',
    ({
        src,
        width,
        height,
        fit,
        smoothing,
        dithering,
        brightness,
        threshold,
        invert,
    }: ImageProps) => ({
        src,
        width: width ?? -1,
        height: height ?? -1,
        fit: fit ?? 'contain',
        smoothing: smoothing ?? true,
        dithering: dithering ?? 'ordered',
        brightness: brightness ?? 'perceived',
        threshold: Math.min(255, Math.max(0, threshold ?? 128)),
        invert: invert ?? false,
    }),
)
