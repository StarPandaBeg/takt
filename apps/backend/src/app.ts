import { deadlinesRoutes } from '#src/routes/deadlines.js'
import { eventsRoutes } from '#src/routes/events.js'
import { mcpRoutes } from '#src/routes/mcp.js'
import { notesRoutes } from '#src/routes/notes.js'
import { screenRoutes } from '#src/routes/screens.js'
import { getSceneHash, getSceneNames } from '#src/services/scene.js'
import { ScreenChangeService } from '#src/services/screen-changes.js'
import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'

export interface AppOptions {
    readonly logger?: boolean
    /** Bearer token used by HTTP clients. Pass false only in isolated tests. */
    readonly authToken?: string | false
}

function readAuthToken(value: string | false | undefined): string | false {
    if (value === false) return false
    if (value === undefined || value.length === 0) {
        throw new Error('AUTH_TOKEN must contain a non-empty bearer token')
    }
    if (/\s/.test(value)) {
        throw new Error('AUTH_TOKEN must not contain whitespace')
    }
    return value
}

function hashToken(value: string): Buffer {
    return createHash('sha256').update(value).digest()
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
    const authToken = readAuthToken(options.authToken ?? process.env.AUTH_TOKEN)
    const expectedTokenHash =
        authToken === false ? undefined : hashToken(authToken)
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

    app.get('/health', () => ({ status: 'ok' }))

    app.addHook('onRequest', (request, reply, done) => {
        if (
            expectedTokenHash === undefined ||
            request.method === 'OPTIONS' ||
            request.url.split('?', 1)[0] === '/health'
        ) {
            done()
            return
        }

        const match = /^Bearer ([^\s]+)$/i.exec(
            request.headers.authorization ?? '',
        )
        const actualTokenHash = match?.[1]
            ? hashToken(match[1])
            : Buffer.alloc(expectedTokenHash.length)

        if (timingSafeEqual(actualTokenHash, expectedTokenHash)) {
            done()
            return
        }

        void reply
            .header('WWW-Authenticate', 'Bearer')
            .code(401)
            .send({ error: 'Unauthorized' })
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
