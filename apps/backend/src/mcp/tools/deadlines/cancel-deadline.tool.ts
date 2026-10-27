import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { cancelDeadline } from '#src/services/deadlines.js'
import { toToolResponse } from '#src/mcp/util/helpers.js'

export const cancelDeadlineInputSchema = z
    .object({
        id: z.int().positive().describe('ID of the deadline master'),
        scope: z
            .enum(['series', 'occurrence', 'this_and_future'])
            .describe(
                'Cancellation target: series cancels the whole master, occurrence cancels only the selected occurrence, and this_and_future cancels the selected occurrence plus all later ones',
            ),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'Original scheduled due time identifying the occurrence, even if it was moved. Required for occurrence and this_and_future; use recurrenceId returned by get_deadlines',
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
    id: z.int().positive().describe('ID of the affected deadline master'),
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
