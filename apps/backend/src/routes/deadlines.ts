import type { FastifyPluginAsync } from 'fastify'
import * as z from 'zod'
import * as deadlines from '../repository/deadlines.js'

const idSchema = z.object({
    id: z.coerce.number().int().positive(),
})
const listSchema = z.object({
    from: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(8192).optional(),
    withCompleted: z.stringbool().default(false),
})
const fields = {
    title: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    due: z.coerce.date(),
    dueIsDate: z.boolean().optional(),
    completed: z.boolean().optional(),
}
const createSchema = z.object(fields)
const editSchema = createSchema.partial()

export const deadlinesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request) => {
        return await deadlines.getFiltered(listSchema.parse(request.query))
    })

    fastify.get('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        return await deadlines.get(id)
    })

    fastify.post('/', async (request, reply) => {
        const body = createSchema.parse(request.body)
        const id = await deadlines.create(body)
        return reply.code(201).send({ success: true, id })
    })

    fastify.put('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        await deadlines.edit(id, editSchema.parse(request.body))
    })

    fastify.post('/:id/markDone', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        await deadlines.markCompleted(id, true)
        return reply.code(204).send()
    })

    fastify.post('/:id/markUndone', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        await deadlines.markCompleted(id, false)
        return reply.code(204).send()
    })

    fastify.delete('/:id', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        await deadlines.remove(id)
        return reply.code(204).send()
    })

    return Promise.resolve()
}
