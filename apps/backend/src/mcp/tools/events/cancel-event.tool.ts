import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import {
    eventIdSchema,
    formatEventId,
    parseEventId,
} from '#src/mcp/util/ids.js'
import { cancelEvent } from '#src/services/events.js'

export const cancelEventInputSchema = z
    .object({
        id: eventIdSchema,
        scope: z
            .enum(['series', 'occurrence', 'this_and_future'])
            .describe(
                'Target: whole series, one occurrence, or this and future',
            ),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601 original series start; required unless scope is series',
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
    id: eventIdSchema,
})

export const cancelEventTool: ToolCallback<
    typeof cancelEventInputSchema
> = async ({ id, scope, recurrenceId }) => {
    const eventId = await cancelEvent({
        id: parseEventId(id),
        scope,
        recurrenceId:
            recurrenceId === undefined ? undefined : new Date(recurrenceId),
    })
    return toToolResponse({ id: formatEventId(eventId) })
}
