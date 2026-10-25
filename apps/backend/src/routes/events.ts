import type { FastifyPluginAsync } from 'fastify'
import * as z from 'zod'
import * as events from '../repository/events.js'

const idSchema = z.object({
    id: z.coerce.number().int().positive(),
})
const listSchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(8192).optional(),
})
const fields = {
    title: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    start: z.coerce.date(),
    end: z.coerce.date().nullable().optional(),
    timezone: z.string().trim().min(1).nullable().optional(),
    allDay: z.boolean().optional(),
}
const createSchema = z
    .object(fields)
    .refine(({ start, end }) => end == null || end >= start, {
        message: 'end must not be earlier than start',
        path: ['end'],
    })
const editSchema = z
    .object(fields)
    .partial()
    .refine(
        ({ start, end }) => start === undefined || end == null || end >= start,
        { message: 'end must not be earlier than start', path: ['end'] },
    )

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request) => {
        return await events.getFiltered(listSchema.parse(request.query))
    })

    fastify.get('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        return await events.get(id)
    })

    fastify.post('/', async (request, reply) => {
        const body = createSchema.parse(request.body)
        const id = await events.create(body)
        return reply.code(201).send({ success: true, id })
    })

    fastify.put('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        await events.edit(id, editSchema.parse(request.body))
    })

    fastify.delete('/:id', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        await events.remove(id)
        return reply.code(204).send()
    })

    return Promise.resolve()
}
