import { serializeNote } from '#src/mcp/util/serializers.js'
import * as notes from '#src/repository/notes.js'
import type { FastifyPluginAsync } from 'fastify'
import * as z from 'zod'

const getAllQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(8192).optional(),
    withDone: z.stringbool().default(false),
    onlyDone: z.stringbool().optional(),
    page: z.coerce.number().int().positive().optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    afterId: z.coerce.number().int().positive().optional(),
})
const idSchema = z.object({
    id: z.coerce.number().int().positive(),
})

const createSchema = z.object({
    text: z.string().min(1).max(256),
})
const editSchema = z
    .object({
        text: z.string().min(1).max(256).optional(),
        completedAt: z.coerce.date().nullable().optional(),
    })
    .refine(
        ({ text, completedAt }) =>
            text !== undefined || completedAt !== undefined,
        {
            message: 'at least one field must be provided',
        },
    )

export const notesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (req, reply) => {
        const filters = getAllQuerySchema.parse(req.query)
        const [items, total] = await Promise.all([
            notes.getFiltered(filters),
            notes.countFiltered({
                withDone: filters.withDone,
                onlyDone: filters.onlyDone,
            }),
        ])
        reply.header('x-total-count', total)
        reply.header('access-control-expose-headers', 'x-total-count')
        return items.map(serializeNote)
    })

    fastify.get('/:id', async (req) => {
        const { id } = idSchema.parse(req.params)
        const note = await notes.get(id)
        return note === undefined ? null : serializeNote(note)
    })

    fastify.post('/', async (req, reply) => {
        const body = createSchema.parse(req.body)
        const id = await notes.create(body)
        const note = await notes.get(id)
        if (note === undefined) {
            throw new Error(`Created note ${id} could not be read back`)
        }
        return reply.code(201).send(serializeNote(note))
    })

    fastify.put('/:id', async (req) => {
        const { id } = idSchema.parse(req.params)
        const { text, completedAt } = editSchema.parse(req.body)
        if (text !== undefined) await notes.edit(id, { text })
        if (completedAt !== undefined) {
            await notes.markDoneAt(id, completedAt)
        }
        const note = await notes.get(id)
        if (note === undefined) throw new RangeError('Note not found')
        return serializeNote(note)
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
