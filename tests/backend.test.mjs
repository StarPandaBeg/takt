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
    }

    const measured = environment.measureText('Takt ритм', style)
    const bitmap = environment.rasterizeText('Takt ритм', style)

    assert.deepEqual({ width: bitmap.width, height: bitmap.height }, measured)
    assert.equal(bitmap.buffer.length, bitmap.width * bitmap.height)
})
