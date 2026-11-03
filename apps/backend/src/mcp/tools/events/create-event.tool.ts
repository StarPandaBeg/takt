import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import {
    eventEntitySchema,
    recurrenceSchema,
} from '#src/mcp/util/objects.js'
import { serializeEventEntity } from '#src/mcp/util/serializers.js'
import * as events from '#src/repository/events.js'
import {
    getEventEntity,
    serializeEventRecurrence,
} from '#src/services/events.js'
import {
    getApplicationTimezone,
    isValidTimezone,
} from '#src/services/settings.js'

// MCP принимает ISO-строки, а не JS Date
export const createEventInputSchema = z
    .object({
        title: z.string().trim().min(1),

        description: z.string().nullable().optional(),

        start: z.iso.datetime({ offset: true }).describe('ISO 8601'),

        end: z.iso
            .datetime({ offset: true })
            .nullable()
            .optional()
            .describe('ISO 8601'),

        timezone: z
            .string()
            .trim()
            .min(1)
            .refine(isValidTimezone, {
                message: 'timezone must be a valid IANA time zone',
            })
            .nullable()
            .optional()
            .describe('IANA timezone'),

        allDay: z.boolean().optional(),

        recurrence: recurrenceSchema
            .nullable()
            .optional(),
    })
    .refine(
        ({ start, end }) => end == null || new Date(end) >= new Date(start),
        {
            message: 'end must not be earlier than start',
            path: ['end'],
        },
    )

export const createEventOutputSchema = eventEntitySchema

export const createEvent: ToolCallback<typeof createEventInputSchema> = async (
    input,
) => {
    const record = serializeEventRecurrence({
        ...input,
        timezone:
            input.timezone === undefined
                ? await getApplicationTimezone()
                : input.timezone,
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
    const event = await getEventEntity(id)
    if (event === undefined) {
        throw new Error(`Created event ${id} could not be read back`)
    }
    return toToolResponse(serializeEventEntity(event))
}
