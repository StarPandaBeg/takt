import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { notesRoutes } from './routes/notes.js'
import { screenRoutes } from './routes/screens.js'

export interface AppOptions {
    readonly logger?: boolean
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
    const app = Fastify({ logger: options.logger ?? true })
    app.register(cors, {
        origin: '*',
    })

    app.register(notesRoutes, { prefix: '/api/notes' })
    app.register(screenRoutes, { prefix: '/screens' })

    return app
}
