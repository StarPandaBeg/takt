import type { ToolCallback } from '@modelcontextprotocol/server'
import { DateTime } from 'luxon'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import {
    deadlineEntitySchema,
    deadlineVisibilitySchema,
    recurrenceSchema,
} from '#src/mcp/util/objects.js'
import { serializeDeadlineEntity } from '#src/mcp/util/serializers.js'
import * as deadlines from '#src/repository/deadlines.js'
import {
    getDeadlineEntity,
    serializeDeadlineRecurrence,
    setDeadlineCompletion,
} from '#src/services/deadlines.js'
import { recurrenceSchema as domainRecurrenceSchema } from '#src/services/recurrence.js'
import { getApplicationTimezone } from '#src/services/settings.js'

const timezoneSchema = z
    .string()
    .trim()
    .min(1)
    .refine((zone) => DateTime.local().setZone(zone).isValid, {
        message: 'timezone must be a valid IANA time zone',
    })

export const createDeadlineInputSchema = z.object({
    title: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    due: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    dueIsDate: z
        .boolean()
        .optional()
        .describe(
            'Date-only flag; due must still be a full date-time',
        ),
    timezone: timezoneSchema
        .optional()
        .describe(
            'Recurrence timezone; defaults to the application timezone',
        ),
    recurrence: recurrenceSchema
        .nullable()
        .optional()
        .describe(
            'null means one-time',
        ),
    visibility: deadlineVisibilitySchema
        .optional()
        .describe(
            'Defaults to show immediately and hide after the due day',
        ),
    completed: z
        .boolean()
        .optional()
        .describe(
            'Initial state for one-time deadlines only',
        ),
})

export const createDeadlineOutputSchema = deadlineEntitySchema

export const createDeadline: ToolCallback<
    typeof createDeadlineInputSchema
> = async (input) => {
    const recurrence =
        input.recurrence === undefined || input.recurrence === null
            ? input.recurrence
            : domainRecurrenceSchema.parse({
                  ...input.recurrence,
                  until:
                      input.recurrence.until === undefined
                          ? undefined
                          : new Date(input.recurrence.until),
              })
    if (
        input.completed === true &&
        recurrence !== null &&
        recurrence !== undefined
    ) {
        throw new RangeError(
            'A recurring deadline cannot be created as globally completed',
        )
    }
    const id = await deadlines.create(
        serializeDeadlineRecurrence({
            title: input.title,
            description: input.description ?? null,
            due: new Date(input.due),
            dueIsDate: input.dueIsDate ?? false,
            timezone: input.timezone ?? (await getApplicationTimezone()),
            completed: false,
            visibility: input.visibility ?? {
                show: { type: 'always' },
                hide: 'on_due',
            },
            recurrence: recurrence ?? null,
        }),
    )
    if (input.completed === true) {
        await setDeadlineCompletion({ id, completed: true })
    }
    const deadline = await getDeadlineEntity(id)
    if (deadline === undefined) {
        throw new Error(`Created deadline ${id} could not be read back`)
    }
    return toToolResponse(serializeDeadlineEntity(deadline))
}
