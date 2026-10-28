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

const timezoneSchema = z
    .string()
    .trim()
    .min(1)
    .refine((zone) => DateTime.local().setZone(zone).isValid, {
        message: 'timezone must be a valid IANA time zone',
    })

export const createDeadlineInputSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1)
        .describe('Short user-visible name of the deadline'),
    description: z
        .string()
        .nullable()
        .optional()
        .describe(
            'Optional details about the deadline. Use null for no description',
        ),
    due: z.iso
        .datetime({ offset: true })
        .describe(
            'Due date and time in ISO 8601 format with an explicit UTC offset',
        ),
    dueIsDate: z
        .boolean()
        .optional()
        .describe(
            'Whether the deadline represents a calendar date rather than a precise time. The due field must still contain a complete ISO date-time. Defaults to false',
        ),
    timezone: timezoneSchema
        .optional()
        .describe(
            'IANA timezone used to expand recurrence, for example Europe/Moscow. Defaults to Europe/Moscow',
        ),
    recurrence: recurrenceSchema
        .nullable()
        .optional()
        .describe(
            'Recurrence rule for a repeating deadline, or null for a one-time deadline',
        ),
    visibility: deadlineVisibilitySchema
        .optional()
        .describe(
            'When the deadline should appear and disappear. Defaults to show immediately and hide after the due day',
        ),
    completed: z
        .boolean()
        .optional()
        .describe(
            'Create the one-time deadline as already completed. For recurring deadlines complete occurrences later with set_deadline_completion',
        ),
})

export const createDeadlineOutputSchema = deadlineEntitySchema.describe(
    'The complete created deadline master, in the same format as get_deadline',
)

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
            timezone: input.timezone ?? 'Europe/Moscow',
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
