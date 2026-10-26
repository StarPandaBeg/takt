import { createRenderer } from '@takt/renderer'
import { exportEsp, exportPng } from '@takt/renderer/exporters'
import { project } from '@takt/templates'
import type { FastifyPluginAsync } from 'fastify'
import type { ServerResponse } from 'node:http'
import * as z from 'zod'
import { createNodeEnvironment } from '../render-environment.js'
import type {
    ScreenChange,
    ScreenChangeService,
} from '../services/screen-changes.js'
import {
    generateScene,
    getSceneHash,
    getSceneNames,
} from '../services/scene.js'

const nameSchema = z.object({
    name: z.enum(getSceneNames()),
})

type ScreenName = ReturnType<typeof getSceneNames>[number]

interface ScreenRoutesOptions {
    readonly changes: ScreenChangeService<ScreenName>
}

const HEARTBEAT_INTERVAL = 15_000

export function formatScreenChange(change: ScreenChange<ScreenName>): string {
    return `event: screen\ndata: ${JSON.stringify(change)}\n\n`
}

export const screenRoutes: FastifyPluginAsync<ScreenRoutesOptions> = async (
    fastify,
    { changes },
) => {
    const environment = createNodeEnvironment()
    const render = createRenderer(environment)
    const streams = new Set<ServerResponse>()

    fastify.addHook('preClose', (done) => {
        for (const stream of streams) stream.end()
        streams.clear()
        done()
    })

    fastify.get('/events', (request, reply) => {
        reply.hijack()

        const response = reply.raw
        const socket = request.raw.socket
        response.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        })
        streams.add(response)
        response.flushHeaders()
        socket.setKeepAlive(true, HEARTBEAT_INTERVAL)
        socket.setNoDelay(true)
        socket.setTimeout(0)
        response.write('retry: 3000\n\n')

        let closed = false
        const unsubscribe = changes.subscribe((change) => {
            if (!closed && !response.destroyed) {
                response.write(formatScreenChange(change))
            }
        })
        const heartbeat = setInterval(() => {
            if (!closed && !response.destroyed) response.write(': heartbeat\n\n')
        }, HEARTBEAT_INTERVAL)
        heartbeat.unref()

        const close = () => {
            if (closed) return
            closed = true
            clearInterval(heartbeat)
            streams.delete(response)
            unsubscribe()
        }
        response.once('close', close)
        response.once('error', close)
    })

    fastify.get('/:name/png', async (req, res) => {
        const parsed = nameSchema.safeParse(req.params)
        if (!parsed.success) return res.code(404).send('Not Found')

        const { name } = parsed.data
        const scene = await generateScene(name)
        await environment.preloadImages(scene)
        const frame = render({
            content: scene,
            viewport: project.settings.screen,
        })
        const png = await exportPng(frame)

        return res
            .header('Cache-Control', 'no-store')
            .type('image/png')
            .send(png)
    })

    fastify.get('/:name/esp', async (req, res) => {
        const parsed = nameSchema.safeParse(req.params)
        if (!parsed.success) return res.code(404).send('Not Found')

        const { name } = parsed.data
        const scene = await generateScene(name)
        await environment.preloadImages(scene)
        const frame = render({
            content: scene,
            viewport: project.settings.screen,
        })
        const blob = await exportEsp(frame)

        return res
            .header('Cache-Control', 'no-store')
            .type('application/octet-stream')
            .send(blob)
    })

    fastify.get('/:name', async (req, res) => {
        const parsed = nameSchema.safeParse(req.params)
        if (!parsed.success) return res.code(404).send('Not Found')
        const { name } = parsed.data
        const hash = await getSceneHash(name)

        return res.send({
            ...project.settings.screen,
            hash,
        })
    })

    return Promise.resolve()
}
