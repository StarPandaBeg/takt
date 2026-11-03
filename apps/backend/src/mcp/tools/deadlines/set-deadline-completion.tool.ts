import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { setDeadlineCompletion as setCompletion } from '#src/services/deadlines.js'

export const setDeadlineCompletionInputSchema = z
    .object({
        id: z.int().positive(),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601 original series due; required only for recurring deadlines',
            ),
        completed: z.boolean(),
    })

export const setDeadlineCompletionOutputSchema = z.object({
    id: z.int().positive(),
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
