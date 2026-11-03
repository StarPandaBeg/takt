import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { eventIdSchema, parseEventId } from '#src/mcp/util/ids.js'
import {
    eventEntitySchema,
    recurrenceSchema,
} from '#src/mcp/util/objects.js'
import { serializeMcpEventEntity } from '#src/mcp/util/serializers.js'
import { getEventEntity, updateEvent } from '#src/services/events.js'
import { recurrenceSchema as domainRecurrenceSchema } from '#src/services/recurrence.js'
import { isValidTimezone } from '#src/services/settings.js'

const changesSchema = z
    .object({
        title: z.string().trim().min(1).optional(),
        description: z.string().nullable().optional(),
        start: z.iso
            .datetime({ offset: true })
            .optional()
            .describe('ISO 8601'),
        end: z.iso
            .datetime({ offset: true })
            .nullable()
            .optional()
            .describe('ISO 8601'),
        allDay: z.boolean().optional(),
        timezone: z
            .string()
            .trim()
            .min(1)
            .refine(isValidTimezone, {
                message: 'timezone must be a valid IANA time zone',
            })
            .nullable()
            .optional(),
        recurrence: recurrenceSchema.nullable().optional(),
        restore: z
            .boolean()
            .optional()
            .describe('Restore a cancelled occurrence or whole event'),
    })
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'changes must contain at least one field',
    })
    .refine(
        ({ start, end }) =>
            start === undefined ||
            end == null ||
            new Date(end) >= new Date(start),
        {
            message: 'end must not be earlier than start',
            path: ['end'],
        },
    )

export const updateEventInputSchema = z
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
        changes: changesSchema,
    })
    .superRefine(({ scope, recurrenceId, changes }, context) => {
        if (scope !== 'series' && recurrenceId === undefined) {
            context.addIssue({
                code: 'custom',
                path: ['recurrenceId'],
                message:
                    'recurrenceId is required for occurrence and this_and_future',
            })
        }
        if (scope === 'occurrence' && changes.recurrence !== undefined) {
            context.addIssue({
                code: 'custom',
                path: ['changes', 'recurrence'],
                message: 'recurrence cannot be changed for a single occurrence',
            })
        }
    })

export const updateEventOutputSchema = eventEntitySchema

export const updateEventTool: ToolCallback<
    typeof updateEventInputSchema
> = async ({ id, scope, recurrenceId, changes }) => {
    const convertedChanges = {
        ...(changes.title === undefined ? {} : { title: changes.title }),
        ...(changes.description === undefined
            ? {}
            : { description: changes.description }),
        ...(changes.start === undefined
            ? {}
            : { start: new Date(changes.start) }),
        ...(changes.end === undefined
            ? {}
            : {
                  end: changes.end === null ? null : new Date(changes.end),
              }),
        ...(changes.allDay === undefined ? {} : { allDay: changes.allDay }),
        ...(changes.timezone === undefined
            ? {}
            : { timezone: changes.timezone }),
        ...(changes.recurrence === undefined
            ? {}
            : {
                  recurrence:
                      changes.recurrence === null
                          ? null
                          : domainRecurrenceSchema.parse({
                                ...changes.recurrence,
                                until:
                                    changes.recurrence.until === undefined
                                        ? undefined
                                        : new Date(changes.recurrence.until),
                            }),
              }),
        ...(changes.restore === undefined ? {} : { restore: changes.restore }),
    }
    const eventId = await updateEvent({
        id: parseEventId(id),
        scope,
        recurrenceId:
            recurrenceId === undefined ? undefined : new Date(recurrenceId),
        changes: convertedChanges,
    })
    const event = await getEventEntity(eventId)
    if (event === undefined) {
        throw new Error(`Updated event ${eventId} could not be read back`)
    }
    return toToolResponse(serializeMcpEventEntity(event))
}
