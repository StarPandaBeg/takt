import {
    serializeDeadlineEntity,
    serializeResolvedDeadline,
} from '#src/mcp/util/serializers.js'
import * as deadlineExceptions from '#src/repository/deadline-recurrence-exceptions.js'
import * as deadlines from '#src/repository/deadlines.js'
import {
    cancelDeadline,
    deadlineVisibilitySchema,
    getDeadlineEntities,
    getDeadlineEntity,
    getResolvedDeadlines,
    serializeDeadlineRecurrence,
    setDeadlineCompletion,
    updateDeadline,
} from '#src/services/deadlines.js'
import { getApplicationTimezone, isValidTimezone } from '#src/services/settings.js'
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
const listSchema = z
    .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        query: z.string().trim().min(1).optional(),
        limit: z.coerce.number().int().positive().max(8192).optional(),
        withCompleted: z.stringbool().default(false),
    })
    .refine(
        ({ from, to }) => from === undefined || to === undefined || to > from,
        { message: 'to must be later than from', path: ['to'] },
    )
const occurrenceListSchema = z
    .object({
        from: z.coerce.date(),
        to: z.coerce.date().optional(),
        limit: z.coerce.number().int().positive().max(8192).optional(),
        withCompleted: z.stringbool().default(false),
    })
    .refine(({ from, to }) => to === undefined || to > from, {
        message: 'to must be later than from',
        path: ['to'],
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
        .refine(isValidTimezone, {
            message: 'timezone must be a valid IANA time zone',
        })
        .optional(),
    recurrence: recurrenceSchema.nullable().optional(),
    visibility: deadlineVisibilitySchema.optional(),
    completed: z.boolean().optional(),
}
const createSchema = z.object(fields)
const editSchema = createSchema
    .omit({ completed: true })
    .partial()
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'changes must contain at least one field',
    })
const legacyEditSchema = createSchema
    .partial()
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'changes must contain at least one field',
    })
const scopedUpdateSchema = z
    .object({
        scope: z.enum(['series', 'occurrence', 'this_and_future']),
        recurrenceId: z.coerce.date().optional(),
        changes: editSchema,
    })
    .superRefine(({ scope, recurrenceId, changes }, context) => {
        if (scope !== 'series' && recurrenceId === undefined) {
            context.addIssue({
                code: 'custom',
                path: ['recurrenceId'],
                message:
                    'recurrenceId is required for occurrence and this_and_future',
            })
        }
        if (
            scope === 'occurrence' &&
            (changes.recurrence !== undefined ||
                changes.visibility !== undefined)
        ) {
            context.addIssue({
                code: 'custom',
                path: ['changes', 'recurrence'],
                message:
                    'recurrence and visibility cannot be changed for a single occurrence',
            })
        }
    })
const updateSchema = z.union([scopedUpdateSchema, legacyEditSchema])
const cancellationSchema = z
    .object({
        scope: z.enum(['series', 'occurrence', 'this_and_future']),
        recurrenceId: z.coerce.date().optional(),
    })
    .superRefine(({ scope, recurrenceId }, context) => {
        if (scope !== 'series' && recurrenceId === undefined) {
            context.addIssue({
                code: 'custom',
                path: ['recurrenceId'],
                message:
                    'recurrenceId is required for occurrence and this_and_future',
            })
        }
    })
const completionSchema = z.object({
    recurrenceId: z.preprocess(
        (value) => (value === null ? undefined : value),
        z.coerce.date().optional(),
    ),
    completed: z.boolean(),
})
const occurrenceExceptionSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('cancelled') }),
    z.object({ status: z.literal('rescheduled'), due: z.coerce.date() }),
])

export const deadlinesRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request) => {
        const filters = listSchema.parse(request.query)
        return (await getDeadlineEntities(filters)).map(serializeDeadlineEntity)
    })

    fastify.get('/occurrences', async (request) => {
        const { from, to, limit, withCompleted } = occurrenceListSchema.parse(
            request.query,
        )
        return (
            await getResolvedDeadlines({
                from: DateTime.fromJSDate(from),
                to: to === undefined ? undefined : DateTime.fromJSDate(to),
                limit,
                withCompleted,
            })
        ).map(serializeResolvedDeadline)
    })

    fastify.get('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        const deadline = await getDeadlineEntity(id)
        return deadline === undefined ? null : serializeDeadlineEntity(deadline)
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
            timezone: input.timezone ?? (await getApplicationTimezone()),
            completed: false,
        })
        const id = await deadlines.create(body)
        if (completed === true) {
            await setDeadlineCompletion({ id, completed: true })
        }
        const deadline = await getDeadlineEntity(id)
        if (deadline === undefined) {
            throw new Error(`Created deadline ${id} could not be read back`)
        }
        return reply.code(201).send(serializeDeadlineEntity(deadline))
    })

    fastify.put('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        const input = updateSchema.parse(request.body)
        const scoped =
            'changes' in input
                ? input
                : {
                      scope: 'series' as const,
                      recurrenceId: undefined,
                      changes: input,
                      completed: input.completed,
                  }
        const { changes } = scoped
        const deadlineId = await updateDeadline({
            id,
            scope: scoped.scope,
            ...(scoped.recurrenceId === undefined
                ? {}
                : { recurrenceId: scoped.recurrenceId }),
            changes: {
                ...(changes.title === undefined
                    ? {}
                    : { title: changes.title }),
                ...(changes.description === undefined
                    ? {}
                    : { description: changes.description }),
                ...(changes.due === undefined ? {} : { due: changes.due }),
                ...(changes.dueIsDate === undefined
                    ? {}
                    : { dueIsDate: changes.dueIsDate }),
                ...(changes.timezone === undefined
                    ? {}
                    : { timezone: changes.timezone }),
                ...(changes.recurrence === undefined
                    ? {}
                    : { recurrence: changes.recurrence }),
                ...(changes.visibility === undefined
                    ? {}
                    : { visibility: changes.visibility }),
            },
        })
        const deadline = await getDeadlineEntity(deadlineId)
        if (deadline === undefined) {
            throw new Error(
                `Updated deadline ${deadlineId} could not be read back`,
            )
        }
        if ('completed' in scoped && scoped.completed !== undefined) {
            await setDeadlineCompletion({
                id: deadlineId,
                completed: scoped.completed,
            })
            const completedDeadline = await getDeadlineEntity(deadlineId)
            if (completedDeadline === undefined) {
                throw new Error(
                    `Updated deadline ${deadlineId} could not be read back`,
                )
            }
            return serializeDeadlineEntity(completedDeadline)
        }
        return serializeDeadlineEntity(deadline)
    })

    fastify.post('/:id/cancel', async (request) => {
        const { id } = idSchema.parse(request.params)
        const input = cancellationSchema.parse(request.body)
        return { id: await cancelDeadline({ id, ...input }) }
    })

    fastify.put('/:id/completion', async (request) => {
        const { id } = idSchema.parse(request.params)
        const input = completionSchema.parse(request.body)
        return { id: await setDeadlineCompletion({ id, ...input }) }
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
