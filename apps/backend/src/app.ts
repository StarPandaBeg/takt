import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { deadlinesRoutes } from './routes/deadlines.js'
import { eventsRoutes } from './routes/events.js'
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
    app.register(eventsRoutes, { prefix: '/api/events' })
    app.register(deadlinesRoutes, { prefix: '/api/deadlines' })
    app.register(screenRoutes, { prefix: '/screens' })

    return app
}
