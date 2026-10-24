import cors from '@fastify/cors'
import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { project } from '@takt/templates'
import Fastify, { type FastifyInstance } from 'fastify'
import { createNodeEnvironment } from './render-environment.js'

export interface AppOptions {
    readonly logger?: boolean
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
    const app = Fastify({ logger: options.logger ?? true })
    app.register(cors, {
        origin: '*',
    })

    const render = createRenderer(createNodeEnvironment())

    app.get('/', async (_request, reply) => {
        const frame = render({
            content: project.scenes.blank.generate({}),
            viewport: project.settings.screen,
        })
        const png = await exportPng(frame)
        const body = Buffer.from(png.buffer, png.byteOffset, png.byteLength)

        return reply
            .header('Cache-Control', 'no-store')
            .type('image/png')
            .send(body)
    })

    return app
}
