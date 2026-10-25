import cors from '@fastify/cors'
import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { project, type Scene } from '@takt/templates'
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

    const environment = createNodeEnvironment()
    const render = createRenderer(environment)

    app.get('/screen/:screen', async (_request, reply) => {
        const { screen } = _request.params as { screen: string }
        if (!Object.keys(project.scenes).includes(screen)) {
            return reply.code(404).send('Not Found')
        }

        // @ts-expect-error Expect error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const projectScene: Scene = project.scenes[screen]

        const content = projectScene.generate({})
        await environment.preloadImages(content)

        const frame = render({
            content,
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
