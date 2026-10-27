import type { ToolCallback } from '@modelcontextprotocol/server'
import { DateTime } from 'luxon'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { resolvedDeadlineSchema } from '#src/mcp/util/objects.js'
import { serializeResolvedDeadline } from '#src/mcp/util/serializers.js'
import { getResolvedDeadlines } from '#src/services/deadlines.js'

export const getDeadlinesInputSchema = z.object({
    from: z.iso
        .datetime({ offset: true })
        .describe('Inclusive lower bound for effective due times'),
    limit: z
        .int()
        .positive()
        .max(8192)
        .optional()
        .describe(
            'Maximum number of resolved occurrences to return. Defaults to 128',
        ),
    withCompleted: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include completed deadline occurrences. Defaults to false'),
})

export const getDeadlinesOutputSchema = z
    .array(resolvedDeadlineSchema)
    .describe(
        'Resolved deadline occurrences ordered by effective due time, with recurrence overrides already applied',
    )

export const getDeadlines: ToolCallback<
    typeof getDeadlinesInputSchema
> = async ({ from, limit, withCompleted }) => {
    const deadlines = await getResolvedDeadlines({
        from: DateTime.fromISO(from, { setZone: true }),
        limit,
        withCompleted,
    })
    return toToolResponse(deadlines.map(serializeResolvedDeadline))
}
