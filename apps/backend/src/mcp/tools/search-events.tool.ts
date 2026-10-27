import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { getEventEntities } from '../../services/events.js'
import { toToolResponse } from '../util/helpers.js'
import { eventEntitySchema } from '../util/objects.js'
import { serializeEventEntity } from '../util/serializers.js'

export const searchEventsInputSchema = z
    .object({
        from: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('Inclusive master event start boundary (ISO 8601)'),
        to: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('Exclusive master event start boundary (ISO 8601)'),
        query: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe(
                'Case-insensitive substring matched against title and description',
            ),
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
