import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { cancelDeadline } from '#src/services/deadlines.js'
import { toToolResponse } from '#src/mcp/util/helpers.js'

export const cancelDeadlineInputSchema = z
    .object({
        id: z.int().positive(),
        scope: z
            .enum(['series', 'occurrence', 'this_and_future'])
            .describe(
                'Target: whole series, one occurrence, or this and future',
            ),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601 original series due; required unless scope is series',
            ),
    })
    .superRefine(({ scope, recurrenceId }, context) => {
        if (scope !== 'series' && recurrenceId === undefined) {
            context.addIssue({
                code: 'custom',
                path: ['recurrenceId'],
                message:
                    'recurrenceId is required for occurrence and this_and_future',
            })
        }
    })

export const cancelDeadlineOutputSchema = z.object({
    id: z.int().positive(),
})

export const cancelDeadlineTool: ToolCallback<
    typeof cancelDeadlineInputSchema
> = async ({ id, scope, recurrenceId }) => {
    const deadlineId = await cancelDeadline({
        id,
        scope,
        recurrenceId:
            recurrenceId === undefined ? undefined : new Date(recurrenceId),
    })
    return toToolResponse({ id: deadlineId })
}
