import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#/mcp/util/helpers.js'
import { recurrenceSchema } from '#/mcp/util/objects.js'
import * as events from '#/repository/events.js'
import { serializeEventRecurrence } from '#/services/events.js'

// MCP принимает ISO-строки, а не JS Date
export const createEventInputSchema = z
    .object({
        title: z.string().trim().min(1).describe('Name of the event'),

        description: z
            .string()
            .nullable()
            .optional()
            .describe('Optional event description'),

        start: z.iso
            .datetime({ offset: true })
            .describe('Event start time (ISO 8601)'),

        end: z.iso
            .datetime({ offset: true })
            .nullable()
            .optional()
            .describe('Event end time (ISO 8601), or null if unspecified'),

        timezone: z
            .string()
            .trim()
            .min(1)
            .nullable()
            .optional()
            .describe('IANA timezone, e.g. Europe/Moscow'),

        allDay: z
            .boolean()
            .optional()
            .describe('Whether the event is an all-day event'),

        recurrence: recurrenceSchema
            .nullable()
            .optional()
            .describe('Optional recurrence rule for repeating events'),
    })
    .refine(
        ({ start, end }) => end == null || new Date(end) >= new Date(start),
        {
            message: 'end must not be earlier than start',
            path: ['end'],
        },
    )

export const createEventOutputSchema = z.object({
    id: z.int().describe('ID of the created event'),
})

export const createEvent: ToolCallback<typeof createEventInputSchema> = async (
    input,
) => {
    const record = serializeEventRecurrence({
        ...input,
        start: new Date(input.start),
        end: input.end ? new Date(input.end) : null,
        recurrence: input.recurrence
            ? {
                  ...input.recurrence,
                  until: input.recurrence.until
                      ? new Date(input.recurrence.until)
                      : undefined,
              }
            : input.recurrence,
    })

    const id = await events.create(record)
    return toToolResponse({ id })
}
