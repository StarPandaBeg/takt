import { toToolResponse } from '#src/mcp/util/helpers.js'
import { groupedResolvedEventSchema } from '#src/mcp/util/objects.js'
import { serializeMcpGroupedEvents } from '#src/mcp/util/serializers.js'
import { getResolvedEvents } from '#src/services/events.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import { DateTime } from 'luxon'
import * as z from 'zod'

export const getEventsInputSchema = z
    .object({
        start: z.iso
            .datetime({ offset: true })
            .describe('ISO 8601 inclusive range start'),
        end: z.iso
            .datetime({ offset: true })
            .describe('ISO 8601 exclusive range end'),
        limit: z
            .int()
            .positive()
            .max(64)
            .optional()
            .describe('Occurrences before grouping; defaults to 32'),
        withCancelled: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include cancelled occurrences and events; defaults to false'),
    })
    .refine(({ start, end }) => new Date(end) > new Date(start), {
        message: 'end must be later than start',
        path: ['end'],
    })
export const getEventsOutputSchema = z.array(groupedResolvedEventSchema)

export const getEvents: ToolCallback<typeof getEventsInputSchema> = async ({
    start,
    end,
    limit,
    withCancelled,
}) => {
    const events = await getResolvedEvents({
        from: DateTime.fromISO(start, { setZone: true }),
        to: DateTime.fromISO(end, { setZone: true }),
        limit: Math.min(limit ?? 32, 64),
        withCancelled,
    })
    const result = serializeMcpGroupedEvents(events)

    return toToolResponse(result)
}
