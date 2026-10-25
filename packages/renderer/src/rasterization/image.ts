import type {
    ImageBrightness,
    ImageDithering,
    ImageFit,
} from '@takt/ui/components'
import { FramePixel } from '../frame-pixel.js'
import type { DecodedImage } from '../types.js'

export interface MonochromeImage {
    readonly width: number
    readonly height: number
    readonly data: Uint8Array
    /** 1 means that the corresponding output pixel must be written. */
    readonly mask: Uint8Array
}

const BAYER_4X4 = [
    0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
] as const

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

export function getBrightness(
    red: number,
    green: number,
    blue: number,
    mode: ImageBrightness,
): number {
    switch (mode) {
        case 'perceived':
            // Perceptual brightness of gamma-encoded RGB, matching alg.js.
            return 0.299 * red + 0.587 * green + 0.114 * blue
        case 'average':
            return (red + green + blue) / 3
        case 'lightness':
            return (Math.max(red, green, blue) + Math.min(red, green, blue)) / 2
        case 'red':
            return red
        case 'green':
            return green
        case 'blue':
            return blue
    }
}

function getFitGeometry(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    fit: ImageFit,
) {
    if (fit === 'fill') {
        return {
            x: 0,
            y: 0,
            width: targetWidth,
            height: targetHeight,
        }
    }

    const scale =
        fit === 'contain'
            ? Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
            : Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    const width = sourceWidth * scale
    const height = sourceHeight * scale

    return {
        x: (targetWidth - width) / 2,
        y: (targetHeight - height) / 2,
        width,
        height,
    }
}

function sampleNearest(
    image: DecodedImage,
    x: number,
    y: number,
    output: Uint8Array,
    outputIndex: number,
): void {
    const sourceX = clamp(Math.round(x), 0, image.width - 1)
    const sourceY = clamp(Math.round(y), 0, image.height - 1)
    const sourceIndex = (sourceY * image.width + sourceX) * 4

    output[outputIndex] = image.data[sourceIndex] ?? 0
    output[outputIndex + 1] = image.data[sourceIndex + 1] ?? 0
    output[outputIndex + 2] = image.data[sourceIndex + 2] ?? 0
    output[outputIndex + 3] = image.data[sourceIndex + 3] ?? 0
}

function sampleBilinear(
    image: DecodedImage,
    x: number,
    y: number,
    output: Uint8Array,
    outputIndex: number,
): void {
    const rawX0 = Math.floor(x)
    const rawY0 = Math.floor(y)
    const x0 = clamp(rawX0, 0, image.width - 1)
    const y0 = clamp(rawY0, 0, image.height - 1)
    const x1 = clamp(rawX0 + 1, 0, image.width - 1)
    const y1 = clamp(rawY0 + 1, 0, image.height - 1)
    const tx = clamp(x - rawX0, 0, 1)
    const ty = clamp(y - rawY0, 0, 1)
    const samples = [
        { x: x0, y: y0, weight: (1 - tx) * (1 - ty) },
        { x: x1, y: y0, weight: tx * (1 - ty) },
        { x: x0, y: y1, weight: (1 - tx) * ty },
        { x: x1, y: y1, weight: tx * ty },
    ]

    let alpha = 0
    let red = 0
    let green = 0
    let blue = 0

    for (const sample of samples) {
        const index = (sample.y * image.width + sample.x) * 4
        const sampleAlpha = (image.data[index + 3] ?? 0) / 255
        const weight = sample.weight * sampleAlpha
        alpha += weight
        red += (image.data[index] ?? 0) * weight
        green += (image.data[index + 1] ?? 0) * weight
        blue += (image.data[index + 2] ?? 0) * weight
    }

    output[outputIndex] = alpha > 0 ? Math.round(red / alpha) : 0
    output[outputIndex + 1] = alpha > 0 ? Math.round(green / alpha) : 0
    output[outputIndex + 2] = alpha > 0 ? Math.round(blue / alpha) : 0
    output[outputIndex + 3] = Math.round(alpha * 255)
}

export function scaleImage(
    image: DecodedImage,
    width: number,
    height: number,
    fit: ImageFit,
    smoothing: boolean,
): DecodedImage {
    if (
        !Number.isInteger(image.width) ||
        image.width <= 0 ||
        !Number.isInteger(image.height) ||
        image.height <= 0 ||
        image.data.length !== image.width * image.height * 4
    ) {
        throw new RangeError('Source image must contain valid RGBA pixel data')
    }

    if (
        !Number.isInteger(width) ||
        width < 0 ||
        !Number.isInteger(height) ||
        height < 0
    ) {
        throw new RangeError(
            'Scaled image dimensions must be non-negative integers',
        )
    }

    const data = new Uint8Array(width * height * 4)
    if (width === 0 || height === 0) return { width, height, data }

    const geometry = getFitGeometry(
        image.width,
        image.height,
        width,
        height,
        fit,
    )

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const centerX = x + 0.5
            const centerY = y + 0.5
            if (
                centerX < geometry.x ||
                centerX >= geometry.x + geometry.width ||
                centerY < geometry.y ||
                centerY >= geometry.y + geometry.height
            ) {
                continue
            }

            const sourceX =
                ((centerX - geometry.x) / geometry.width) * image.width - 0.5
            const sourceY =
                ((centerY - geometry.y) / geometry.height) * image.height - 0.5
            const outputIndex = (y * width + x) * 4

            if (smoothing) {
                sampleBilinear(image, sourceX, sourceY, data, outputIndex)
            } else {
                sampleNearest(image, sourceX, sourceY, data, outputIndex)
            }
        }
    }

    return { width, height, data }
}

export function monochromizeImage(
    image: DecodedImage,
    options: {
        readonly brightness: ImageBrightness
        readonly dithering: ImageDithering
        readonly threshold: number
        readonly invert: boolean
    },
    background?: Uint8Array,
): MonochromeImage {
    if (
        !Number.isInteger(image.width) ||
        image.width < 0 ||
        !Number.isInteger(image.height) ||
        image.height < 0 ||
        image.data.length !== image.width * image.height * 4
    ) {
        throw new RangeError('Image must contain valid RGBA pixel data')
    }

    const pixelCount = image.width * image.height
    if (background !== undefined && background.length !== pixelCount) {
        throw new RangeError('Background dimensions must match the image')
    }

    const threshold = clamp(options.threshold, 0, 255)
    const values = new Float32Array(pixelCount)
    const mask = new Uint8Array(pixelCount)
    const data = new Uint8Array(pixelCount)

    for (let index = 0; index < pixelCount; index += 1) {
        const source = index * 4
        const alpha = image.data[source + 3] ?? 0
        if (alpha === 0) continue

        mask[index] = 1
        const backgroundValue =
            background?.[index] === FramePixel.BLACK ? 0 : 255
        const opacity = alpha / 255
        const red =
            (image.data[source] ?? 0) * opacity +
            backgroundValue * (1 - opacity)
        const green =
            (image.data[source + 1] ?? 0) * opacity +
            backgroundValue * (1 - opacity)
        const blue =
            (image.data[source + 2] ?? 0) * opacity +
            backgroundValue * (1 - opacity)
        values[index] = getBrightness(red, green, blue, options.brightness)
    }

    const addError = (x: number, y: number, error: number) => {
        if (x < 0 || x >= image.width || y < 0 || y >= image.height) return
        const index = y * image.width + x
        if (mask[index] === 0) return
        values[index] = (values[index] ?? 0) + error
    }

    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            const index = y * image.width + x
            if (mask[index] === 0) continue

            const brightness = values[index] ?? 0
            let black: boolean

            if (options.dithering === 'floyd-steinberg') {
                const quantized = brightness < threshold ? 0 : 255
                black = quantized === 0
                const error = brightness - quantized

                // Floyd–Steinberg, matching alg.js:
                //             X    7/16
                //     3/16   5/16  1/16
                addError(x + 1, y, (error * 7) / 16)
                addError(x - 1, y + 1, (error * 3) / 16)
                addError(x, y + 1, (error * 5) / 16)
                addError(x + 1, y + 1, error / 16)
            } else if (options.dithering === 'ordered') {
                const bayer = BAYER_4X4[(y & 3) * 4 + (x & 3)] ?? 0
                const adjustment = (bayer - 7.5) * 12
                black = brightness + adjustment < threshold
            } else {
                black = brightness < threshold
            }

            if (options.invert) black = !black
            data[index] = black ? FramePixel.BLACK : FramePixel.WHITE
        }
    }

    return { width: image.width, height: image.height, data, mask }
}
