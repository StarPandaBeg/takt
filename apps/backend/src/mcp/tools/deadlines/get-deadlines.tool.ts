import type { ToolCallback } from '@modelcontextprotocol/server'
import { DateTime } from 'luxon'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { groupedResolvedDeadlineSchema } from '#src/mcp/util/objects.js'
import { serializeMcpGroupedDeadlines } from '#src/mcp/util/serializers.js'
import { getResolvedDeadlines } from '#src/services/deadlines.js'

export const getDeadlinesInputSchema = z
    .object({
        from: z.iso
            .datetime({ offset: true })
            .describe('ISO 8601 inclusive effective due-time boundary'),
        to: z.iso
            .datetime({ offset: true })
            .describe('ISO 8601 exclusive effective due-time boundary'),
        limit: z
            .int()
            .positive()
            .max(64)
            .optional()
            .describe('Occurrences before grouping; defaults to 32'),
        withCompleted: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include completed; defaults to false'),
    })
    .refine(({ from, to }) => new Date(to) > new Date(from), {
        message: 'to must be later than from',
        path: ['to'],
    })

export const getDeadlinesOutputSchema = z
    .array(groupedResolvedDeadlineSchema)
    .describe('Entities with occurrences ordered by effective due time')

export const getDeadlines: ToolCallback<
    typeof getDeadlinesInputSchema
> = async ({ from, to, limit, withCompleted }) => {
    const deadlines = await getResolvedDeadlines({
        from: DateTime.fromISO(from, { setZone: true }),
        to: DateTime.fromISO(to, { setZone: true }),
        limit: Math.min(limit ?? 32, 64),
        withCompleted,
    })
    return toToolResponse(serializeMcpGroupedDeadlines(deadlines))
}
