import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#/mcp/util/helpers.js'
import { cancelEvent } from '#/services/events.js'

export const cancelEventInputSchema = z
    .object({
        id: z.int().positive().describe('ID of the original event master'),
        scope: z
            .enum(['series', 'occurrence', 'this_and_future'])
            .describe(
                'Cancel the entire series, one occurrence, or the selected occurrence and all future occurrences',
            ),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'Original scheduled start identifying the selected occurrence. Required for occurrence and this_and_future',
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

export const cancelEventOutputSchema = z.object({
    id: z.int().positive().describe('ID of the affected event master'),
})

export const cancelEventTool: ToolCallback<
    typeof cancelEventInputSchema
> = async ({ id, scope, recurrenceId }) => {
    const eventId = await cancelEvent({
        id,
        scope,
        recurrenceId:
            recurrenceId === undefined ? undefined : new Date(recurrenceId),
    })
    return toToolResponse({ id: eventId })
}
