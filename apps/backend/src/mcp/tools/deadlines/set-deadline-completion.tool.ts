import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import {
    deadlineIdSchema,
    formatDeadlineId,
    parseDeadlineId,
} from '#src/mcp/util/ids.js'
import { setDeadlineCompletion as setCompletion } from '#src/services/deadlines.js'

export const setDeadlineCompletionInputSchema = z.object({
    id: deadlineIdSchema,
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .optional()
        .describe(
            'ISO 8601 original series due; required for recurring, omit or null for one-time',
        ),
    completed: z.boolean(),
})

export const setDeadlineCompletionOutputSchema = z.object({
    id: deadlineIdSchema,
})

export const setDeadlineCompletion: ToolCallback<
    typeof setDeadlineCompletionInputSchema
> = async ({ id, recurrenceId, completed }) => {
    const deadlineId = await setCompletion({
        id: parseDeadlineId(id),
        recurrenceId: recurrenceId == null ? undefined : new Date(recurrenceId),
        completed,
    })
    return toToolResponse({ id: formatDeadlineId(deadlineId) })
}
