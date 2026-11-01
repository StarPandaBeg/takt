import type { FrameExporter } from './types.js'

export const exportEsp: FrameExporter<Uint8Array> = async (frame) => {
    const stride = Math.ceil(frame.width / 8)
    const buffer = new Uint8Array(stride * frame.height)

    for (let y = 0; y < frame.height; y++) {
        const frameRowOffset = y * frame.width
        const outputRowOffset = y * stride
        for (let byte = 0; byte < stride; byte += 1) {
            const firstX = byte << 3
            const count = Math.min(8, frame.width - firstX)
            let packed = 0
            for (let bit = 0; bit < count; bit += 1) {
                if (frame.buffer[frameRowOffset + firstX + bit]) {
                    packed |= 0x80 >> bit
                }
            }
            buffer[outputRowOffset + byte] = packed
        }
    }

    return Promise.resolve(buffer)
}
