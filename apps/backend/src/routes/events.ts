import {
    serializeEventEntity,
    serializeResolvedEvent,
} from '#src/mcp/util/serializers.js'
import * as eventExceptions from '#src/repository/event-recurrence-exceptions.js'
import * as events from '#src/repository/events.js'
import {
    cancelEvent,
    getEventEntities,
    getEventEntity,
    getResolvedEvents,
    serializeEventRecurrence,
    updateEvent,
} from '#src/services/events.js'
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
const limitSchema = z.coerce.number().int().positive().max(8192).optional()
const occurrenceListSchema = z
    .object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        limit: limitSchema,
    })
    .refine(({ from, to }) => to > from, {
        message: 'to must be later than from',
        path: ['to'],
    })
const searchSchema = z
    .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        query: z.string().trim().min(1).optional(),
        limit: limitSchema,
    })
    .refine(
        ({ from, to }) => from === undefined || to === undefined || to > from,
        {
            message: 'to must be later than from',
            path: ['to'],
        },
    )
const listSchema = z
    .object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        limit: limitSchema,
    })
    .refine(
        ({ from, to }) =>
            (from === undefined && to === undefined) ||
            (from !== undefined && to !== undefined),
        {
            message: 'from and to must be provided together',
            path: ['to'],
        },
    )
    .refine(({ from, to }) => from === undefined || to! > from, {
        message: 'to must be later than from',
        path: ['to'],
    })
const fields = {
    title: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    start: z.coerce.date(),
    end: z.coerce.date().nullable().optional(),
    timezone: z.string().trim().min(1).nullable().optional(),
    allDay: z.boolean().optional(),
    recurrence: recurrenceSchema.nullable().optional(),
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
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'changes must contain at least one field',
    })
    .refine(
        ({ start, end }) => start === undefined || end == null || end >= start,
        { message: 'end must not be earlier than start', path: ['end'] },
    )
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
        if (scope === 'occurrence' && changes.recurrence !== undefined) {
            context.addIssue({
                code: 'custom',
                path: ['changes', 'recurrence'],
                message: 'recurrence cannot be changed for a single occurrence',
            })
        }
    })
const updateSchema = z.union([scopedUpdateSchema, editSchema])
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
const occurrenceExceptionSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('cancelled') }),
    z
        .object({
            status: z.literal('rescheduled'),
            start: z.coerce.date(),
            end: z.coerce.date().nullable().optional(),
        })
        .refine(({ start, end }) => end == null || end >= start, {
            message: 'end must not be earlier than start',
            path: ['end'],
        }),
])

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async (request) => {
        const { from, to, limit } = listSchema.parse(request.query)
        if (from !== undefined && to !== undefined) {
            return (
                await getResolvedEvents({
                    from: DateTime.fromJSDate(from),
                    to: DateTime.fromJSDate(to),
                    limit,
                })
            ).map(serializeResolvedEvent)
        }
        return (await getEventEntities({ limit })).map(serializeEventEntity)
    })

    fastify.get('/occurrences', async (request) => {
        const { from, to, limit } = occurrenceListSchema.parse(request.query)
        return (
            await getResolvedEvents({
                from: DateTime.fromJSDate(from),
                to: DateTime.fromJSDate(to),
                limit,
            })
        ).map(serializeResolvedEvent)
    })

    fastify.get('/search', async (request) => {
        const filters = searchSchema.parse(request.query)
        return (await getEventEntities(filters)).map(serializeEventEntity)
    })

    fastify.get('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        const event = await getEventEntity(id)
        return event === undefined ? null : serializeEventEntity(event)
    })

    fastify.post('/', async (request, reply) => {
        const body = serializeEventRecurrence(createSchema.parse(request.body))
        const id = await events.create(body)
        const event = await getEventEntity(id)
        if (event === undefined) {
            throw new Error(`Created event ${id} could not be read back`)
        }
        return reply.code(201).send(serializeEventEntity(event))
    })

    fastify.put('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        const input = updateSchema.parse(request.body)
        const scoped =
            'changes' in input
                ? input
                : { scope: 'series' as const, changes: input }
        const { changes } = scoped
        const eventId = await updateEvent({
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
                ...(changes.start === undefined
                    ? {}
                    : { start: changes.start }),
                ...(changes.end === undefined ? {} : { end: changes.end }),
                ...(changes.timezone === undefined
                    ? {}
                    : { timezone: changes.timezone }),
                ...(changes.allDay === undefined
                    ? {}
                    : { allDay: changes.allDay }),
                ...(changes.recurrence === undefined
                    ? {}
                    : { recurrence: changes.recurrence }),
            },
        })
        const event = await getEventEntity(eventId)
        if (event === undefined) {
            throw new Error(`Updated event ${eventId} could not be read back`)
        }
        return serializeEventEntity(event)
    })

    fastify.post('/:id/cancel', async (request) => {
        const { id } = idSchema.parse(request.params)
        const input = cancellationSchema.parse(request.body)
        return { id: await cancelEvent({ id, ...input }) }
    })

    fastify.put('/:id/occurrences/:recurrenceId', async (request, reply) => {
        const { id, recurrenceId } = occurrenceParamsSchema.parse(
            request.params,
        )
        const exception = occurrenceExceptionSchema.parse(request.body)
        const event = await events.get(id)
        if (event === undefined) {
            return reply.code(404).send({ message: 'Event not found' })
        }
        if (event.recurrenceRule === null) {
            return reply.code(409).send({ message: 'Event is not recurring' })
        }

        const zone = event.timezone ?? 'Europe/Moscow'
        const start = DateTime.fromJSDate(event.start).setZone(zone)
        const occurrence = DateTime.fromJSDate(recurrenceId).setZone(zone)
        if (
            !isRecurrenceOccurrence(
                start,
                parseRecurrence(event.recurrenceRule),
                occurrence,
            )
        ) {
            return reply.code(400).send({
                message: 'recurrenceId is not an occurrence of this series',
            })
        }

        if (exception.status === 'cancelled') {
            await eventExceptions.set(id, recurrenceId, null, null)
        } else {
            const replacementEnd =
                exception.end === undefined
                    ? event.end === null
                        ? null
                        : new Date(
                              exception.start.getTime() +
                                  event.end.getTime() -
                                  event.start.getTime(),
                          )
                    : exception.end
            await eventExceptions.set(
                id,
                recurrenceId,
                exception.start,
                replacementEnd,
            )
        }
        return reply.code(204).send()
    })

    fastify.delete('/:id/occurrences/:recurrenceId', async (request, reply) => {
        const { id, recurrenceId } = occurrenceParamsSchema.parse(
            request.params,
        )
        await eventExceptions.remove(id, recurrenceId)
        return reply.code(204).send()
    })

    fastify.delete('/:id', async (request, reply) => {
        const { id } = idSchema.parse(request.params)
        await events.remove(id)
        return reply.code(204).send()
    })

    return Promise.resolve()
}
