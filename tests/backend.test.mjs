import { loadImage } from '@napi-rs/canvas'
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../apps/backend/dist/app.js'
import { createNodeEnvironment } from '../apps/backend/dist/render-environment.js'

test('backend serves the rendered frame as PNG', async () => {
    const app = buildApp({ logger: false })

    try {
        const response = await app.inject({ method: 'GET', url: '/' })
        const png = response.rawPayload

        assert.equal(response.statusCode, 200)
        assert.equal(response.headers['content-type'], 'image/png')
        assert.equal(response.headers['cache-control'], 'no-store')
        assert.deepEqual(
            [...png.subarray(0, 8)],
            [137, 80, 78, 71, 13, 10, 26, 10],
        )
        assert.equal(png.readUInt32BE(16), 800)
        assert.equal(png.readUInt32BE(20), 480)
        const image = await loadImage(png)
        assert.deepEqual(
            { width: image.width, height: image.height },
            { width: 800, height: 480 },
        )

        const head = await app.inject({ method: 'HEAD', url: '/' })
        assert.equal(head.statusCode, 200)
        assert.equal(head.rawPayload.byteLength, 0)

        const missing = await app.inject({ method: 'GET', url: '/missing' })
        assert.equal(missing.statusCode, 404)
    } finally {
        await app.close()
    }
})

test('Node Canvas measures and rasterizes the same text geometry', () => {
    const environment = createNodeEnvironment()
    const style = {
        fontSize: 19,
        fontFamily: 'Arial',
        fontWeight: 600,
        italic: true,
        underline: true,
        lineHeight: 1.2,
        metrics: 'font',
    }

    const measured = environment.measureText('Takt ритм', style)
    const bitmap = environment.rasterizeText('Takt ритм', style)

    assert.deepEqual({ width: bitmap.width, height: bitmap.height }, measured)
    assert.equal(bitmap.buffer.length, bitmap.width * bitmap.height)
})

test('Node Canvas uses stable vertical metrics for equal text styles', () => {
    const environment = createNodeEnvironment()
    const style = {
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 400,
        italic: false,
        underline: false,
        lineHeight: 1.2,
        metrics: 'font',
    }

    const values = ['Р', 'Д', 'g', 'Текст', 'руду']
    const measurements = values.map((value) =>
        environment.measureText(value, style),
    )
    const bitmaps = values.map((value) =>
        environment.rasterizeText(value, style),
    )

    assert.equal(new Set(measurements.map(({ height }) => height)).size, 1)
    assert.equal(new Set(bitmaps.map(({ height }) => height)).size, 1)
    for (let index = 0; index < values.length; index += 1) {
        assert.deepEqual(
            {
                width: bitmaps[index]?.width,
                height: bitmaps[index]?.height,
            },
            measurements[index],
        )
    }
})

test('Node Canvas supports stable font and compact tight metrics', () => {
    const environment = createNodeEnvironment()
    const values = ['24', 'суббота', 'руду', 'ÁÉḍ']
    const baseStyle = {
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 400,
        italic: false,
        underline: false,
        lineHeight: 1.2,
    }

    const renderMode = (metrics) =>
        values.map((value) => {
            const style = { ...baseStyle, metrics }
            const measured = environment.measureText(value, style)
            const bitmap = environment.rasterizeText(value, style)

            assert.deepEqual(
                { width: bitmap.width, height: bitmap.height },
                measured,
            )
            assert.equal(bitmap.buffer.length, bitmap.width * bitmap.height)

            return { measured, bitmap }
        })

    const font = renderMode('font')
    const tight = renderMode('tight')

    assert.equal(new Set(font.map(({ measured }) => measured.height)).size, 1)
    assert.ok(
        tight.every(
            ({ measured }, index) =>
                measured.height <= (font[index]?.measured.height ?? 0),
        ),
    )
    assert.ok(
        tight.some(
            ({ measured }, index) =>
                measured.height < (font[index]?.measured.height ?? 0),
        ),
    )

    const alphaSum = (bitmap) =>
        bitmap.buffer.reduce((sum, alpha) => sum + alpha, 0)
    for (let index = 0; index < values.length; index += 1) {
        assert.equal(
            alphaSum(font[index].bitmap),
            alphaSum(tight[index].bitmap),
        )
    }

    for (const metrics of ['font', 'tight']) {
        const style = { ...baseStyle, metrics }
        const measured = environment.measureText('', style)
        const bitmap = environment.rasterizeText('', style)

        assert.deepEqual(
            { width: bitmap.width, height: bitmap.height },
            measured,
        )
        assert.equal(bitmap.buffer.length, 0)
    }
})
