import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { defineImageAsset, Image } from '@takt/ui/components'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { buildApp } from '../apps/backend/dist/app.js'
import { createNodeEnvironment } from '../apps/backend/dist/render-environment.js'

test('backend serves the rendered frame as PNG', async () => {
    const app = buildApp({ logger: false })

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/screen/splash',
        })
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
        const canvas = createCanvas(image.width, image.height)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(
            0,
            0,
            image.width,
            image.height,
        ).data
        let blackPixels = 0
        for (let index = 0; index < pixels.length; index += 4) {
            if ((pixels[index] ?? 255) < 128) blackPixels += 1
        }
        assert.ok(blackPixels > 0)

        const head = await app.inject({
            method: 'HEAD',
            url: '/screen/splash',
        })
        assert.equal(head.statusCode, 200)
        assert.equal(head.rawPayload.byteLength, 0)

        const missing = await app.inject({
            method: 'GET',
            url: '/screen/missing',
        })
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

test('Node environment decodes and caches local raster images', async () => {
    const assetRoot = mkdtempSync(join(tmpdir(), 'takt-images-'))

    try {
        const makeEncoded = (width, height, format) => {
            const canvas = createCanvas(width, height)
            const context = canvas.getContext('2d')
            context.fillStyle = '#fff'
            context.fillRect(0, 0, width, height)
            context.fillStyle = '#000'
            context.fillRect(0, 0, 1, height)
            return canvas.encodeSync(format)
        }
        writeFileSync(join(assetRoot, 'source.png'), makeEncoded(2, 1, 'png'))
        writeFileSync(join(assetRoot, 'source.jpg'), makeEncoded(3, 2, 'jpeg'))
        writeFileSync(join(assetRoot, 'source.webp'), makeEncoded(4, 3, 'webp'))

        const environment = createNodeEnvironment({
            assetRoot,
            imageCacheSize: 4,
        })
        await environment.preloadImages([
            Image({ src: 'source.png' }),
            Image({ src: 'source.jpg' }),
            Image({ src: 'source.webp' }),
        ])
        const first = environment.loadImage('source.png')
        const cached = environment.loadImage('source.png')
        const importedSource = defineImageAsset(
            './source.png',
            pathToFileURL(join(assetRoot, 'image-asset.js')).href,
        )

        assert.strictEqual(cached, first)
        assert.strictEqual(environment.loadImage(importedSource), first)
        assert.deepEqual(
            { width: first.width, height: first.height },
            { width: 2, height: 1 },
        )
        assert.equal(first.data.length, 8)
        assert.deepEqual(
            {
                width: environment.loadImage('source.jpg').width,
                height: environment.loadImage('source.jpg').height,
            },
            { width: 3, height: 2 },
        )
        assert.deepEqual(
            {
                width: environment.loadImage('source.webp').width,
                height: environment.loadImage('source.webp').height,
            },
            { width: 4, height: 3 },
        )

        const render = createRenderer(environment)
        const input = {
            viewport: { width: 4, height: 2 },
            content: Image({
                src: importedSource,
                width: 4,
                height: 2,
                fit: 'fill',
                smoothing: false,
                dithering: 'threshold',
            }),
        }
        const renderedFirst = render(input)
        const renderedSecond = render(input)
        assert.deepEqual(renderedSecond, renderedFirst)

        const encodedFrame = await exportPng(renderedFirst)
        const decodedFrame = await loadImage(encodedFrame)
        assert.deepEqual(
            { width: decodedFrame.width, height: decodedFrame.height },
            { width: 4, height: 2 },
        )

        writeFileSync(join(assetRoot, 'source.png'), makeEncoded(3, 1, 'png'))
        await environment.preloadImages(Image({ src: 'source.png' }))
        const changed = environment.loadImage('source.png')
        assert.notStrictEqual(changed, first)
        assert.deepEqual(
            { width: changed.width, height: changed.height },
            { width: 3, height: 1 },
        )

        writeFileSync(join(assetRoot, 'invalid.png'), 'not an image')
        await assert.rejects(
            environment.preloadImages(Image({ src: 'missing.png' })),
            /missing\.png.*resolved to/,
        )
        await assert.rejects(
            environment.preloadImages(Image({ src: 'invalid.png' })),
            /invalid\.png.*resolved to|invalid\.png.*decode/,
        )
        await assert.rejects(
            environment.preloadImages(
                Image({ src: 'https://example.com/image.png' }),
            ),
            /only local file paths/,
        )

        const smallCache = createNodeEnvironment({
            assetRoot,
            imageCacheSize: 1,
        })
        await smallCache.preloadImages(Image({ src: 'source.png' }))
        const beforeEviction = smallCache.loadImage('source.png')
        await smallCache.preloadImages(Image({ src: 'source.jpg' }))
        await smallCache.preloadImages(Image({ src: 'source.png' }))
        assert.notStrictEqual(
            smallCache.loadImage('source.png'),
            beforeEviction,
        )
    } finally {
        rmSync(assetRoot, { recursive: true, force: true })
    }
})
