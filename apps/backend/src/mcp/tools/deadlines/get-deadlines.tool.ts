import type { ToolCallback } from '@modelcontextprotocol/server'
import { DateTime } from 'luxon'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { resolvedDeadlineSchema } from '#src/mcp/util/objects.js'
import { serializeMcpResolvedDeadline } from '#src/mcp/util/serializers.js'
import { getResolvedDeadlines } from '#src/services/deadlines.js'

export const getDeadlinesInputSchema = z.object({
    from: z.iso
        .datetime({ offset: true })
        .describe('ISO 8601 inclusive effective due-time boundary'),
    limit: z
        .int()
        .positive()
        .max(8192)
        .optional()
        .describe('Defaults to 128'),
    withCompleted: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include completed; defaults to false'),
})

export const getDeadlinesOutputSchema = z
    .array(resolvedDeadlineSchema)
    .describe('Occurrences ordered by effective due time')

export const getDeadlines: ToolCallback<
    typeof getDeadlinesInputSchema
> = async ({ from, limit, withCompleted }) => {
    const deadlines = await getResolvedDeadlines({
        from: DateTime.fromISO(from, { setZone: true }),
        limit,
        withCompleted,
    })
    return toToolResponse(deadlines.map(serializeMcpResolvedDeadline))
}
