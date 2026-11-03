import { toToolResponse } from '#src/mcp/util/helpers.js'
import { eventEntitySchema } from '#src/mcp/util/objects.js'
import { serializeEventEntity } from '#src/mcp/util/serializers.js'
import { getEventEntities } from '#src/services/events.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const searchEventsInputSchema = z
    .object({
        from: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('ISO 8601 inclusive master start'),
        to: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('ISO 8601 exclusive master start'),
        query: z.string().trim().min(1).optional(),
        limit: z.int().positive().max(8192).optional(),
    })
    .refine(
        ({ from, to }) =>
            from === undefined ||
            to === undefined ||
            new Date(to) > new Date(from),
        {
            message: 'to must be later than from',
            path: ['to'],
        },
    )

export const searchEventsOutputSchema = z.array(eventEntitySchema)

export const searchEvents: ToolCallback<
    typeof searchEventsInputSchema
> = async ({ from, to, query, limit }) => {
    const events = await getEventEntities({
        from: from === undefined ? undefined : new Date(from),
        to: to === undefined ? undefined : new Date(to),
        query,
        limit,
    })
    return toToolResponse(events.map(serializeEventEntity))
}
