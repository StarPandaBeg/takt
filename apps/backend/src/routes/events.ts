import * as eventExceptions from '#/repository/event-recurrence-exceptions.js'
import * as events from '#/repository/events.js'
import {
    getEventEntities,
    getEventEntity,
    getResolvedEvents,
    serializeEventRecurrence,
} from '#/services/events.js'
import {
    isRecurrenceOccurrence,
    parseRecurrence,
    recurrenceSchema,
} from '#/services/recurrence.js'
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
    .refine(
        ({ start, end }) => start === undefined || end == null || end >= start,
        { message: 'end must not be earlier than start', path: ['end'] },
    )
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
            return await getResolvedEvents({
                from: DateTime.fromJSDate(from),
                to: DateTime.fromJSDate(to),
                limit,
            })
        }
        return await getEventEntities({ limit })
    })

    fastify.get('/occurrences', async (request) => {
        const { from, to, limit } = occurrenceListSchema.parse(request.query)
        return await getResolvedEvents({
            from: DateTime.fromJSDate(from),
            to: DateTime.fromJSDate(to),
            limit,
        })
    })

    fastify.get('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        return await getEventEntity(id)
    })

    fastify.post('/', async (request, reply) => {
        const body = serializeEventRecurrence(createSchema.parse(request.body))
        const id = await events.create(body)
        return reply.code(201).send({ success: true, id })
    })

    fastify.put('/:id', async (request) => {
        const { id } = idSchema.parse(request.params)
        await events.edit(
            id,
            serializeEventRecurrence(editSchema.parse(request.body)),
        )
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
