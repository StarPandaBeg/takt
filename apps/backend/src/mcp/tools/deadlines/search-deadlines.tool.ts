import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { deadlineEntitySchema } from '#src/mcp/util/objects.js'
import { serializeDeadlineEntity } from '#src/mcp/util/serializers.js'
import { getDeadlineEntities } from '#src/services/deadlines.js'

export const searchDeadlinesInputSchema = z
    .object({
        from: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'Inclusive lower bound applied to the stored master due time, not expanded occurrences',
            ),
        to: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'Exclusive upper bound applied to the stored master due time, not expanded occurrences',
            ),
        query: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe(
                'Case-insensitive substring to search for in title or description',
            ),
        limit: z
            .int()
            .positive()
            .max(8192)
            .optional()
            .describe('Maximum number of deadline masters to return'),
        withCompleted: z
            .boolean()
            .optional()
            .default(false)
            .describe(
                'Include completed deadline masters. Soft-cancelled masters are always excluded',
            ),
    })
    .refine(
        ({ from, to }) =>
            from === undefined ||
            to === undefined ||
            new Date(to) > new Date(from),
        { message: 'to must be later than from', path: ['to'] },
    )

export const searchDeadlinesOutputSchema = z
    .array(deadlineEntitySchema)
    .describe(
        'Matching active deadline masters. Recurring deadlines are not expanded',
    )

export const searchDeadlines: ToolCallback<
    typeof searchDeadlinesInputSchema
> = async ({ from, to, query, limit, withCompleted }) => {
    const deadlines = await getDeadlineEntities({
        ...(from === undefined ? {} : { from: new Date(from) }),
        ...(to === undefined ? {} : { to: new Date(to) }),
        ...(query === undefined ? {} : { query }),
        ...(limit === undefined ? {} : { limit }),
        withCompleted,
    })
    return toToolResponse(deadlines.map(serializeDeadlineEntity))
}
