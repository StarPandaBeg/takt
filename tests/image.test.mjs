import { createRenderer } from '@takt/renderer'
import { resolve } from '@takt/ui'
import { Image, Rect } from '@takt/ui/components'
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLayout } from '../packages/renderer/dist/layout/index.js'
import {
    getBrightness,
    monochromizeImage,
    scaleImage,
} from '../packages/renderer/dist/rasterization/image.js'

const emptyText = {
    measureText() {
        return { width: 0, height: 0 }
    },
    rasterizeText() {
        return { width: 0, height: 0, buffer: new Uint8Array() }
    },
}

function rgba(width, height, pixels) {
    return { width, height, data: Uint8Array.from(pixels.flat()) }
}

test('brightness modes use their documented RGB channels', () => {
    assert.equal(getBrightness(30, 60, 90, 'average'), 60)
    assert.equal(getBrightness(30, 60, 90, 'lightness'), 60)
    assert.equal(getBrightness(30, 60, 90, 'red'), 30)
    assert.equal(getBrightness(30, 60, 90, 'green'), 60)
    assert.equal(getBrightness(30, 60, 90, 'blue'), 90)
    assert.ok(Math.abs(getBrightness(30, 60, 90, 'perceived') - 54.45) < 1e-10)
})

test('threshold, ordered and Floyd–Steinberg dithering are deterministic', () => {
    const gradient = rgba(4, 1, [
        [0, 0, 0, 255],
        [127, 127, 127, 255],
        [128, 128, 128, 255],
        [255, 255, 255, 255],
    ])
    const thresholdOptions = {
        brightness: 'average',
        dithering: 'threshold',
        threshold: 128,
        invert: false,
    }

    assert.deepEqual(
        [...monochromizeImage(gradient, thresholdOptions).data],
        [1, 1, 0, 0],
    )
    assert.deepEqual(
        [
            ...monochromizeImage(gradient, {
                ...thresholdOptions,
                invert: true,
            }).data,
        ],
        [0, 0, 1, 1],
    )

    const gray = rgba(
        4,
        4,
        Array.from({ length: 16 }, () => [128, 128, 128, 255]),
    )
    const ordered = monochromizeImage(gray, {
        ...thresholdOptions,
        dithering: 'ordered',
    })
    assert.equal(
        ordered.data.reduce((sum, pixel) => sum + pixel, 0),
        8,
    )
    assert.deepEqual(
        [...ordered.data],
        [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
    )

    const floydOptions = {
        ...thresholdOptions,
        dithering: 'floyd-steinberg',
    }
    const first = monochromizeImage(gray, floydOptions)
    const second = monochromizeImage(gray, floydOptions)
    assert.deepEqual(first, second)
    assert.deepEqual([...first.data.slice(0, 4)], [0, 1, 0, 1])
})

test('all monochrome algorithms match their reference output', () => {
    const source = rgba(4, 3, [
        [12, 90, 220, 255],
        [240, 40, 80, 255],
        [127, 127, 127, 255],
        [250, 250, 250, 255],
        [0, 0, 0, 255],
        [20, 200, 40, 255],
        [180, 100, 10, 255],
        [80, 60, 190, 255],
        [40, 40, 40, 255],
        [100, 180, 230, 255],
        [210, 150, 90, 255],
        [128, 128, 128, 255],
    ])

    const reference = {
        threshold: [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1],
        ordered: [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
        'floyd-steinberg': [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1],
    }

    for (const dithering of ['threshold', 'ordered', 'floyd-steinberg']) {
        const actual = monochromizeImage(source, {
            brightness: 'perceived',
            dithering,
            threshold: 137,
            invert: false,
        })

        assert.deepEqual([...actual.data], reference[dithering], dithering)
    }
})

test('alpha is composited with the current monochrome frame', () => {
    const pixels = rgba(3, 1, [
        [0, 0, 0, 0],
        [255, 255, 255, 128],
        [0, 0, 0, 128],
    ])
    const image = monochromizeImage(
        pixels,
        {
            brightness: 'average',
            dithering: 'threshold',
            threshold: 128,
            invert: false,
        },
        Uint8Array.from([1, 1, 0]),
    )

    assert.deepEqual([...image.mask], [0, 1, 1])
    assert.deepEqual([...image.data], [0, 0, 1])
})

test('nearest and alpha-premultiplied bilinear scaling support all fit modes', () => {
    const source = rgba(2, 1, [
        [255, 0, 0, 255],
        [0, 0, 255, 255],
    ])
    const filled = scaleImage(source, 4, 2, 'fill', false)
    assert.deepEqual(
        [...filled.data.slice(0, 16)],
        [255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255],
    )

    const contained = scaleImage(source, 4, 4, 'contain', false)
    assert.deepEqual(
        [0, 1, 2, 3].map((y) => contained.data[y * 4 * 4 + 3]),
        [0, 255, 255, 0],
    )

    const covered = scaleImage(source, 2, 2, 'cover', false)
    assert.deepEqual([covered.data[0], covered.data[4]], [255, 0])

    const transparentEdge = rgba(2, 1, [
        [255, 0, 0, 255],
        [0, 0, 0, 0],
    ])
    const smoothed = scaleImage(transparentEdge, 3, 1, 'fill', true)
    assert.deepEqual([...smoothed.data.slice(4, 8)], [255, 0, 0, 128])
})

test('image layout uses natural size and preserves aspect ratio', () => {
    const source = rgba(
        4,
        2,
        Array.from({ length: 8 }, () => [0, 0, 0, 255]),
    )
    const environment = { ...emptyText, loadImage: () => source }
    const nodes = resolve([
        Image({ src: 'natural.png' }),
        Image({ src: 'width.png', width: 8 }),
        Image({ src: 'height.png', height: 6 }),
        Image({ src: 'exact.png', width: 3, height: 7 }),
    ])
    const layout = computeLayout(nodes, { width: 30, height: 30 }, environment)

    assert.deepEqual(
        layout.children.map(({ bounds }) => ({
            width: bounds.width,
            height: bounds.height,
        })),
        [
            { width: 4, height: 2 },
            { width: 8, height: 4 },
            { width: 12, height: 6 },
            { width: 3, height: 7 },
        ],
    )
})

test('image drawing clips to the viewport and preserves transparent pixels', () => {
    const source = rgba(3, 1, [
        [255, 255, 255, 255],
        [0, 0, 0, 0],
        [255, 255, 255, 255],
    ])
    const render = createRenderer({ ...emptyText, loadImage: () => source })
    const frame = render({
        viewport: { width: 3, height: 1 },
        content: [
            Rect({ width: 3, height: 1, fill: true }),
            Image({
                src: 'pixels.png',
                x: -1,
                width: 3,
                height: 1,
                fit: 'fill',
                smoothing: false,
                dithering: 'threshold',
            }),
        ],
    })

    assert.deepEqual([...frame.buffer], [1, 0, 1])
})

test('image algorithms reject malformed buffers and mismatched backgrounds', () => {
    const invalid = { width: 1, height: 1, data: new Uint8Array() }
    assert.throws(() => scaleImage(invalid, 1, 1, 'fill', false), RangeError)
    assert.throws(
        () =>
            monochromizeImage(
                rgba(1, 1, [[0, 0, 0, 255]]),
                {
                    brightness: 'average',
                    dithering: 'threshold',
                    threshold: 128,
                    invert: false,
                },
                new Uint8Array(2),
            ),
        RangeError,
    )
})

test('image algorithms handle 1×1, transparent and empty targets', () => {
    const transparent = rgba(1, 1, [[12, 34, 56, 0]])
    const enlarged = scaleImage(transparent, 5, 3, 'cover', true)
    const monochrome = monochromizeImage(enlarged, {
        brightness: 'perceived',
        dithering: 'floyd-steinberg',
        threshold: 128,
        invert: false,
    })
    assert.deepEqual([...monochrome.mask], Array(15).fill(0))

    const source = rgba(4, 4, Array(16).fill([255, 255, 255, 255]))
    assert.deepEqual(
        {
            width: scaleImage(source, 1, 1, 'cover', true).width,
            height: scaleImage(source, 1, 1, 'cover', true).height,
        },
        { width: 1, height: 1 },
    )
    assert.deepEqual(scaleImage(source, 0, 0, 'contain', false), {
        width: 0,
        height: 0,
        data: new Uint8Array(),
    })
})
