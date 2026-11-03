import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { deadlineEntitySchema } from '#src/mcp/util/objects.js'
import { serializeMcpDeadlineEntity } from '#src/mcp/util/serializers.js'
import { getDeadlineEntities } from '#src/services/deadlines.js'

export const searchDeadlinesInputSchema = z
    .object({
        from: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601 inclusive master due; occurrences are not expanded',
            ),
        to: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601 exclusive master due; occurrences are not expanded',
            ),
        query: z.string().trim().min(1).optional(),
        limit: z.int().positive().max(64).optional(),
        withCompleted: z
            .boolean()
            .optional()
            .default(false)
            .describe('Include completed; cancelled masters remain excluded'),
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
    .describe('Active masters; recurrence is not expanded')

export const searchDeadlines: ToolCallback<
    typeof searchDeadlinesInputSchema
> = async ({ from, to, query, limit, withCompleted }) => {
    const deadlines = await getDeadlineEntities({
        ...(from === undefined ? {} : { from: new Date(from) }),
        ...(to === undefined ? {} : { to: new Date(to) }),
        ...(query === undefined ? {} : { query }),
        limit: Math.min(limit ?? 32, 64),
        withCompleted,
    })
    return toToolResponse(deadlines.map(serializeMcpDeadlineEntity))
}
