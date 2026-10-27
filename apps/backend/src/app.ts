import { deadlinesRoutes } from '#src/routes/deadlines.js'
import { eventsRoutes } from '#src/routes/events.js'
import { mcpRoutes } from '#src/routes/mcp.js'
import { notesRoutes } from '#src/routes/notes.js'
import { screenRoutes } from '#src/routes/screens.js'
import { getSceneHash, getSceneNames } from '#src/services/scene.js'
import { ScreenChangeService } from '#src/services/screen-changes.js'
import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'

export interface AppOptions {
    readonly logger?: boolean
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
    const app = Fastify({
        logger: options.logger ?? true,
        requestTimeout: 0,
        connectionTimeout: 0,
    })
    const screenChanges = new ScreenChangeService({
        names: getSceneNames(),
        getHash: getSceneHash,
        onError: (error) =>
            app.log.error(error, 'Screen revision check failed'),
    })
    app.register(cors, {
        origin: '*',
    })

    app.addHook('onResponse', (request, reply, done) => {
        if (
            request.method !== 'GET' &&
            request.method !== 'HEAD' &&
            request.url.startsWith('/api/') &&
            reply.statusCode < 400
        ) {
            screenChanges.checkNow()
        }
        done()
    })
    app.addHook('onClose', (_instance, done) => {
        screenChanges.close()
        done()
    })

    app.register(mcpRoutes, { prefix: '/mcp' })
    app.register(notesRoutes, { prefix: '/api/notes' })
    app.register(eventsRoutes, { prefix: '/api/events' })
    app.register(deadlinesRoutes, { prefix: '/api/deadlines' })
    app.register(screenRoutes, { prefix: '/screens', changes: screenChanges })

    return app
}
