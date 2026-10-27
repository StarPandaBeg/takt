import { toToolResponse } from '#/mcp/util/helpers.js'
import { resolvedEventSchema } from '#/mcp/util/objects.js'
import { serializeResolvedEvent } from '#/mcp/util/serializers.js'
import { getResolvedEvents } from '#/services/events.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import { DateTime } from 'luxon'
import * as z from 'zod'

export const getEventsInputSchema = z
    .object({
        start: z.iso
            .datetime({ offset: true })
            .describe('Inclusive range start (ISO 8601)'),
        end: z.iso
            .datetime({ offset: true })
            .describe('Exclusive range end (ISO 8601)'),
        limit: z.int().positive().max(8192).optional(),
    })
    .refine(({ start, end }) => new Date(end) > new Date(start), {
        message: 'end must be later than start',
        path: ['end'],
    })
export const getEventsOutputSchema = z.array(resolvedEventSchema)

export const getEvents: ToolCallback<typeof getEventsInputSchema> = async ({
    start,
    end,
    limit,
}) => {
    const events = await getResolvedEvents({
        from: DateTime.fromISO(start, { setZone: true }),
        to: DateTime.fromISO(end, { setZone: true }),
        limit,
    })
    const result = events.map(serializeResolvedEvent)

    return toToolResponse(result)
}
