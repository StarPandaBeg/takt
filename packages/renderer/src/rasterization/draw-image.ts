import { FramePixel } from '../frame-pixel.js'
import { defineDrawHandler } from './handler.js'
import { pixelBounds } from './helpers.js'
import { monochromizeImage, scaleImage } from './image.js'

export const drawImage = defineDrawHandler('image', {
    draw(layout, frame) {
        const bounds = pixelBounds(layout.bounds)
        if (bounds.width <= 0 || bounds.height <= 0) return

        const { props } = layout.node
        const image = scaleImage(
            layout.additionalData.imageData.image,
            bounds.width,
            bounds.height,
            props.fit,
            props.smoothing,
        )
        const background = new Uint8Array(bounds.width * bounds.height)

        for (let y = 0; y < bounds.height; y += 1) {
            for (let x = 0; x < bounds.width; x += 1) {
                const frameX = bounds.x + x
                const frameY = bounds.y + y
                const index = y * bounds.width + x
                background[index] =
                    frameX >= 0 &&
                    frameX < frame.width &&
                    frameY >= 0 &&
                    frameY < frame.height
                        ? (frame.buffer[frameY * frame.width + frameX] ??
                          FramePixel.WHITE)
                        : FramePixel.WHITE
            }
        }

        const monochrome = monochromizeImage(
            image,
            {
                brightness: props.brightness,
                dithering: props.dithering,
                threshold: props.threshold,
                invert: props.invert,
            },
            background,
        )

        for (let y = 0; y < bounds.height; y += 1) {
            const frameY = bounds.y + y
            if (frameY < 0 || frameY >= frame.height) continue

            for (let x = 0; x < bounds.width; x += 1) {
                const frameX = bounds.x + x
                if (frameX < 0 || frameX >= frame.width) continue

                const index = y * bounds.width + x
                if (monochrome.mask[index] === 0) continue
                frame.buffer[frameY * frame.width + frameX] =
                    monochrome.data[index] ?? FramePixel.WHITE
            }
        }
    },
})
