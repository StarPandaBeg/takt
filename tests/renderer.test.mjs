import { createRenderer as createFrameRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { DrawColor, resolve } from '@takt/ui'
import { Group, Rect, Text } from '@takt/ui/components'
import assert from 'node:assert/strict'
import test from 'node:test'
import { inflateSync } from 'node:zlib'
import { computeLayout } from '../packages/renderer/dist/layout/index.js'

const emptyTextEnvironment = {
    measureText() {
        return { width: 0, height: 0 }
    },
    rasterizeText() {
        return { width: 0, height: 0, buffer: new Uint8Array() }
    },
}

test('layout root and nested groups preserve absolute positions', () => {
    const nodes = resolve(
        Group({
            x: 2,
            y: 1,
            children: Rect({ x: 3, y: 2, width: 4, height: 5 }),
        }),
    )
    const layout = computeLayout(
        nodes,
        { width: 20, height: 10 },
        emptyTextEnvironment,
    )

    assert.deepEqual(layout.bounds, { x: 0, y: 0, width: 20, height: 10 })
    assert.deepEqual(layout.children[0]?.bounds, {
        x: 2,
        y: 1,
        width: 20,
        height: 10,
    })
    assert.deepEqual(layout.children[0]?.children[0]?.bounds, {
        x: 5,
        y: 3,
        width: 4,
        height: 5,
    })
})

test('rasterizer keeps paint order and clips rectangles', () => {
    const render = createFrameRenderer(emptyTextEnvironment)
    const frame = render({
        viewport: { width: 4, height: 3 },
        content: [
            Rect({ x: -1, width: 4, height: 2, fill: true }),
            Rect({
                x: 1,
                y: 1,
                width: 3,
                height: 2,
                fill: true,
                fillColor: DrawColor.WHITE,
            }),
        ],
    })

    assert.deepEqual([...frame.buffer], [1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0])
})

test('text measurement and rasterization receive the same normalized style', () => {
    const measured = []
    const rasterized = []
    const environment = {
        measureText(value, style) {
            measured.push({ value, style })
            return { width: 2, height: 1 }
        },
        rasterizeText(value, style) {
            rasterized.push({ value, style })
            return {
                width: 2,
                height: 1,
                buffer: Uint8Array.from([127, 128]),
            }
        },
    }
    const render = createFrameRenderer(environment)
    const frame = render({
        viewport: { width: 2, height: 1 },
        content: Text({ children: 'A' }),
    })

    const expectedStyle = {
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 400,
        italic: false,
        underline: false,
    }
    assert.deepEqual(measured, [{ value: 'A', style: expectedStyle }])
    assert.deepEqual(rasterized, [{ value: 'A', style: expectedStyle }])
    assert.deepEqual([...frame.buffer], [0, 1])
})

test('renderer rejects invalid viewport dimensions', () => {
    const render = createFrameRenderer(emptyTextEnvironment)
    assert.throws(
        () => render({ content: null, viewport: { width: 0, height: 1 } }),
        RangeError,
    )
})

test('PNG exporter packs monochrome pixels and validates frames', async () => {
    const png = await exportPng({
        width: 9,
        height: 2,
        buffer: Uint8Array.from([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5,
        ]),
    })
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
    const chunks = []
    let offset = 8

    while (offset < png.byteLength) {
        const length = view.getUint32(offset)
        const type = new TextDecoder().decode(
            png.subarray(offset + 4, offset + 8),
        )
        chunks.push({
            type,
            data: png.subarray(offset + 8, offset + 8 + length),
        })
        offset += 12 + length
    }

    const compressed = Buffer.concat(
        chunks
            .filter(({ type }) => type === 'IDAT')
            .map(({ data }) => Buffer.from(data)),
    )

    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(view.getUint32(16), 9)
    assert.equal(view.getUint32(20), 2)
    assert.deepEqual([...inflateSync(compressed)], [0, 255, 128, 0, 85, 0])
    await assert.rejects(
        exportPng({ width: 2, height: 2, buffer: new Uint8Array(3) }),
        RangeError,
    )
})
