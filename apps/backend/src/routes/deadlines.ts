import * as deadlineExceptions from '#src/repository/deadline-recurrence-exceptions.js'
import * as deadlines from '#src/repository/deadlines.js'
import {
    deadlineVisibilitySchema,
    getDeadlineEntities,
    getDeadlineEntity,
    serializeDeadlineRecurrence,
    setDeadlineCompletion,
} from '#src/services/deadlines.js'
import {
    isRecurrenceOccurrence,
    parseRecurrence,
    recurrenceSchema,
} from '#src/services/recurrence.js'
import type { FastifyPluginAsync } from 'fastify'
import { DateTime } from 'luxon'
import * as z from 'zod'

const idSchema = z.object({
    id: z.coerce.number().int().positive(),
})
const occurrenceParamsSchema = idSchema.extend({
    recurrenceId: z.coerce.date(),
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
    timezone: z
        .string()
        .trim()
        .min(1)
        .refine((zone) => DateTime.local().setZone(zone).isValid, {
            message: 'timezone must be a valid IANA time zone',
        })
        .optional(),
    recurrence: recurrenceSchema.nullable().optional(),
    visibility: deadlineVisibilitySchema.optional(),
    completed: z.boolean().optional(),
}
const createSchema = z.object(fields)
const editSchema = createSchema.partial()
const occurrenceExceptionSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('cancelled') }),
    z.object({ status: z.literal('rescheduled'), due: z.coerce.date() }),
])

export const deadlinesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request) => {
        return await getDeadlineEntities(listSchema.parse(request.query))
    })

    fastify.get('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        return await getDeadlineEntity(id)
    })

    fastify.post('/', async (request, reply) => {
        const { completed, ...input } = createSchema.parse(request.body)
        if (completed === true && input.recurrence != null) {
            return reply.code(409).send({
                message:
                    'A recurring deadline cannot be created as globally completed',
            })
        }
        const body = serializeDeadlineRecurrence({
            ...input,
            completed: false,
        })
        const id = await deadlines.create(body)
        if (completed === true) {
            await setDeadlineCompletion({ id, completed: true })
        }
        return reply.code(201).send({ success: true, id })
    })

    fastify.put('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        const { completed, ...body } = editSchema.parse(request.body)
        await deadlines.edit(id, serializeDeadlineRecurrence(body))
        if (completed !== undefined) {
            await setDeadlineCompletion({ id, completed })
        }
    })

    fastify.put('/:id/occurrences/:recurrenceId', async (request, reply) => {
        const { id, recurrenceId } = occurrenceParamsSchema.parse(
            request.params,
        )
        const exception = occurrenceExceptionSchema.parse(request.body)
        const deadline = await deadlines.get(id)
        if (deadline === undefined) {
            return reply.code(404).send({ message: 'Deadline not found' })
        }
        if (deadline.recurrenceRule === null) {
            return reply
                .code(409)
                .send({ message: 'Deadline is not recurring' })
        }

        const start = DateTime.fromJSDate(deadline.due).setZone(
            deadline.timezone,
        )
        const occurrence = DateTime.fromJSDate(recurrenceId).setZone(
            deadline.timezone,
        )
        if (
            !isRecurrenceOccurrence(
                start,
                parseRecurrence(deadline.recurrenceRule),
                occurrence,
            )
        ) {
            return reply.code(400).send({
                message: 'recurrenceId is not an occurrence of this series',
            })
        }

        await deadlineExceptions.set(
            id,
            recurrenceId,
            exception.status === 'cancelled' ? null : exception.due,
        )
        return reply.code(204).send()
    })

    fastify.delete('/:id/occurrences/:recurrenceId', async (request, reply) => {
        const { id, recurrenceId } = occurrenceParamsSchema.parse(
            request.params,
        )
        await deadlineExceptions.remove(id, recurrenceId)
        return reply.code(204).send()
    })

    fastify.post('/:id/markDone', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        const deadline = await deadlines.get(id)
        if (deadline?.recurrenceRule !== null) {
            return reply.code(409).send({
                message: 'recurrenceId is required for a recurring deadline',
            })
        }
        await setDeadlineCompletion({ id, completed: true })
        return reply.code(204).send()
    })

    fastify.post('/:id/markUndone', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        const deadline = await deadlines.get(id)
        if (deadline?.recurrenceRule !== null) {
            return reply.code(409).send({
                message: 'recurrenceId is required for a recurring deadline',
            })
        }
        await setDeadlineCompletion({ id, completed: false })
        return reply.code(204).send()
    })

    fastify.post(
        '/:id/occurrences/:recurrenceId/markDone',
        async (request, reply) => {
            const { id, recurrenceId } = occurrenceParamsSchema.parse(
                request.params,
            )
            await setDeadlineCompletion({ id, recurrenceId, completed: true })
            return reply.code(204).send()
        },
    )

    fastify.post(
        '/:id/occurrences/:recurrenceId/markUndone',
        async (request, reply) => {
            const { id, recurrenceId } = occurrenceParamsSchema.parse(
                request.params,
            )
            await setDeadlineCompletion({ id, recurrenceId, completed: false })
            return reply.code(204).send()
        },
    )

    fastify.delete('/:id', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        await deadlines.remove(id)
        return reply.code(204).send()
    })

    return Promise.resolve()
}
