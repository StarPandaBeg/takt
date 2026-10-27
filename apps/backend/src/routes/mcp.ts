import { handleMcp } from '#/mcp/index.js'
import type { FastifyPluginAsync } from 'fastify'

export const mcpRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.all('/', async (request, reply) => {
        reply.hijack()
        const rawRequest = Object.assign(request.raw, {
            method: request.raw.method ?? request.method,
            url: request.raw.url ?? request.url,
        })
        await handleMcp(rawRequest, reply.raw, request.body)
    })

    return Promise.resolve()
}
