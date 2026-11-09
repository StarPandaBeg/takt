import { deadlinesRoutes } from '#src/routes/deadlines.js'
import { diagnosticsRoutes } from '#src/routes/diagnostics.js'
import { eventsRoutes } from '#src/routes/events.js'
import { mcpRoutes } from '#src/routes/mcp.js'
import { notesRoutes } from '#src/routes/notes.js'
import { screenRoutes } from '#src/routes/screens.js'
import { settingsRoutes } from '#src/routes/settings.js'
import { getSceneHash, getSceneNames } from '#src/services/scene.js'
import { ScreenChangeService } from '#src/services/screen-changes.js'
import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import * as z from 'zod'

export interface AppOptions {
    readonly logger?: boolean
    /** Bearer token used by HTTP clients. Pass false only in isolated tests. */
    readonly authToken?: string | false
    /** Optional device token accepted only by diagnostics endpoints. */
    readonly diagnosticsToken?: string | false
    readonly diagnosticsCoredumpDirectory?: string
    readonly diagnosticsCoredumpMaxBytes?: number
    readonly diagnosticsRateLimitPerMinute?: number | false
}

function readAuthToken(
    value: string | false | undefined,
    name = 'AUTH_TOKEN',
): string | false {
    if (value === false) return false
    if (value === undefined || value.length === 0) {
        throw new Error(`${name} must contain a non-empty bearer token`)
    }
    if (/\s/.test(value)) {
        throw new Error(`${name} must not contain whitespace`)
    }
    return value
}

function hashToken(value: string): Buffer {
    return createHash('sha256').update(value).digest()
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
    const authToken = readAuthToken(options.authToken ?? process.env.AUTH_TOKEN)
    const diagnosticsTokenValue =
        options.diagnosticsToken ?? process.env.TAKT_DIAGNOSTICS_TOKEN
    const diagnosticsToken =
        diagnosticsTokenValue === undefined
            ? authToken
            : readAuthToken(diagnosticsTokenValue, 'TAKT_DIAGNOSTICS_TOKEN')
    const expectedAuthTokenHash =
        authToken === false ? undefined : hashToken(authToken)
    const expectedDiagnosticsTokenHash =
        diagnosticsToken === false ? undefined : hashToken(diagnosticsToken)
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

    app.setErrorHandler((error, request, reply) => {
        if (error instanceof z.ZodError) {
            void reply.code(400).send({
                error: 'Invalid request',
                issues: error.issues.map(({ path, message }) => ({
                    path: path.join('.'),
                    message,
                })),
            })
            return
        }
        request.log.error(error)
        void reply.send(error)
    })

    app.get('/health', () => ({ status: 'ok' }))

    app.addHook('onRequest', (request, reply, done) => {
        if (
            request.method === 'OPTIONS' ||
            request.url.split('?', 1)[0] === '/health'
        ) {
            done()
            return
        }

        const isDiagnostics = request.url
            .split('?', 1)[0]
            ?.startsWith('/api/diagnostics/')
        const expectedHashes = isDiagnostics
            ? [expectedAuthTokenHash, expectedDiagnosticsTokenHash].filter(
                  (hash): hash is Buffer => hash !== undefined,
              )
            : expectedAuthTokenHash === undefined
              ? []
              : [expectedAuthTokenHash]
        if (expectedHashes.length === 0) {
            done()
            return
        }

        const match = /^Bearer ([^\s]+)$/i.exec(
            request.headers.authorization ?? '',
        )
        const actualTokenHash = match?.[1]
            ? hashToken(match[1])
            : Buffer.alloc(32)

        if (
            expectedHashes.some((expectedHash) =>
                timingSafeEqual(actualTokenHash, expectedHash),
            )
        ) {
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
            !request.url.startsWith('/api/diagnostics/') &&
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
    app.register(settingsRoutes, { prefix: '/api/settings' })
    app.register(diagnosticsRoutes, {
        prefix: '/api/diagnostics',
        coredumpDirectory: options.diagnosticsCoredumpDirectory,
        coredumpMaxBytes: options.diagnosticsCoredumpMaxBytes,
        rateLimitPerMinute: options.diagnosticsRateLimitPerMinute,
    })
    app.register(screenRoutes, { prefix: '/screens', changes: screenChanges })

    return app
}
