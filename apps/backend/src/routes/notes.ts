import type { FastifyPluginAsync } from 'fastify'
import * as z from 'zod'
import * as notes from '../repository/notes.js'

const getAllQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(8192).optional(),
    withDone: z.stringbool().default(false),
})
const idSchema = z.object({
    id: z.coerce.number().int().positive(),
})

const createSchema = z.object({
    text: z.coerce.string().min(1),
})
const editSchema = z.object({
    text: z.coerce.string().min(1).optional(),
})

export const notesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (req) => {
        const filters = getAllQuerySchema.parse(req.query)
        return await notes.getFiltered(filters)
    })

    fastify.get('/:id', async (req) => {
        const { id } = idSchema.parse(req.params)
        return await notes.get(id)
    })

    fastify.post('/', async (req, reply) => {
        const body = createSchema.parse(req.body)
        const id = await notes.create(body)
        return reply.code(201).send({ success: true, id })
    })

    fastify.put('/:id', async (req) => {
        const { id } = idSchema.parse(req.params)
        const body = editSchema.parse(req.body)
        await notes.edit(id, body)
    })

    fastify.post('/:id/markDone', async (req, reply) => {
        const { id } = idSchema.parse(req.params)
        await notes.markDoneAt(id, new Date())
        return reply.code(204).send()
    })

    fastify.post('/:id/markUndone', async (req, reply) => {
        const { id } = idSchema.parse(req.params)
        await notes.markDoneAt(id, null)
        return reply.code(204).send()
    })

    return Promise.resolve()
}
