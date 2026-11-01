import { FramePixel } from '../frame-pixel.js'
import type { RenderedFrame } from '../types.js'
import type { FrameExporter } from './types.js'

const PNG_SIGNATURE = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])
const IHDR = new Uint8Array([0x49, 0x48, 0x44, 0x52])
const IDAT = new Uint8Array([0x49, 0x44, 0x41, 0x54])
const IEND = new Uint8Array([0x49, 0x45, 0x4e, 0x44])
const MAX_PNG_DIMENSION = 0x7fffffff

function validateFrame(frame: Readonly<RenderedFrame>): void {
    const { width, height, buffer } = frame

    if (!Number.isInteger(width) || width <= 0 || width > MAX_PNG_DIMENSION) {
        throw new RangeError(`Invalid frame width: ${width}`)
    }
    if (
        !Number.isInteger(height) ||
        height <= 0 ||
        height > MAX_PNG_DIMENSION
    ) {
        throw new RangeError(`Invalid frame height: ${height}`)
    }

    const pixelCount = width * height
    if (!Number.isSafeInteger(pixelCount) || buffer.length !== pixelCount) {
        throw new RangeError(
            `Frame buffer length must be ${pixelCount}, got ${buffer.length}`,
        )
    }
}

function createImageHeader(width: number, height: number): Uint8Array {
    const header = new Uint8Array(13)
    const view = new DataView(header.buffer)

    view.setUint32(0, width)
    view.setUint32(4, height)
    header[8] = 1 // bit depth
    header[9] = 0 // grayscale
    header[10] = 0 // deflate compression
    header[11] = 0 // adaptive filtering
    header[12] = 0 // no interlace

    return header
}

function createScanlines(frame: Readonly<RenderedFrame>): Uint8Array {
    const packedRowLength = Math.ceil(frame.width / 8)
    const scanlineLength = packedRowLength + 1
    const scanlines = new Uint8Array(scanlineLength * frame.height)

    for (let y = 0; y < frame.height; y += 1) {
        const rowOffset = y * scanlineLength
        scanlines[rowOffset] = 0 // PNG filter: None

        const frameRowOffset = y * frame.width
        for (let byte = 0; byte < packedRowLength; byte += 1) {
            const firstX = byte << 3
            let packed = 0
            const count = Math.min(8, frame.width - firstX)
            for (let bit = 0; bit < count; bit += 1) {
                // RenderedFrame: 0 = white, 1 = black.
                // PNG grayscale: 1 = white, 0 = black.
                if (
                    frame.buffer[frameRowOffset + firstX + bit] ===
                    FramePixel.WHITE
                ) {
                    packed |= 0x80 >> bit
                }
            }
            scanlines[rowOffset + 1 + byte] = packed
        }
    }

    return scanlines
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
    const copy = new Uint8Array(data.byteLength)
    copy.set(data)
    const input = new Blob([copy]).stream()
    const compressed = input.pipeThrough(new CompressionStream('deflate'))
    return new Uint8Array(await new Response(compressed).arrayBuffer())
}

const CRC32_TABLE = new Uint32Array(256)
for (let index = 0; index < CRC32_TABLE.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
        value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
    }
    CRC32_TABLE[index] = value >>> 0
}

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff

    for (const byte of data) {
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]!
    }

    return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type: Uint8Array, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length)
    const view = new DataView(chunk.buffer)

    view.setUint32(0, data.length)
    chunk.set(type, 4)
    chunk.set(data, 8)
    view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))

    return chunk
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
    const length = parts.reduce((total, part) => total + part.length, 0)
    const result = new Uint8Array(length)
    let offset = 0

    for (const part of parts) {
        result.set(part, offset)
        offset += part.length
    }

    return result
}

/** Encodes a monochrome frame as an opaque 1-bit grayscale PNG. */
export const exportPng: FrameExporter<Uint8Array> = async (frame) => {
    validateFrame(frame)

    const imageData = await deflate(createScanlines(frame))

    return concatenate([
        PNG_SIGNATURE,
        createChunk(IHDR, createImageHeader(frame.width, frame.height)),
        createChunk(IDAT, imageData),
        createChunk(IEND, new Uint8Array()),
    ])
}
