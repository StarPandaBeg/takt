import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { setDeadlineCompletion as setCompletion } from '#src/services/deadlines.js'

export const setDeadlineCompletionInputSchema = z
    .object({
        id: z.int().positive().describe('ID of the deadline master'),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'Original scheduled due time identifying one recurring occurrence. Required for recurring deadlines and omitted for one-time deadlines; use recurrenceId returned by get_deadlines',
            ),
        completed: z
            .boolean()
            .describe('True to complete, false to reopen the deadline'),
    })

export const setDeadlineCompletionOutputSchema = z.object({
    id: z
        .int()
        .positive()
        .describe('ID of the updated deadline master'),
})

export const setDeadlineCompletion: ToolCallback<
    typeof setDeadlineCompletionInputSchema
> = async ({ id, recurrenceId, completed }) => {
    const deadlineId = await setCompletion({
        id,
        recurrenceId:
            recurrenceId === undefined ? undefined : new Date(recurrenceId),
        completed,
    })
    return toToolResponse({ id: deadlineId })
}
