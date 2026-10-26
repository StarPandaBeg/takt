import type { FrameExporter } from './types.js'

export const exportEsp: FrameExporter<Uint8Array> = async (frame) => {
    const stride = Math.ceil(frame.width / 8)
    const buffer = new Uint8Array(stride * frame.height)

    for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
            const index = y * frame.width + x
            const byteIndex = y * stride + (x >> 3)
            const bitIndex = 7 - (x & 7)

            if (frame.buffer[index]) {
                buffer[byteIndex]! |= 1 << bitIndex
            }
        }
    }

    return Promise.resolve(buffer)
}
