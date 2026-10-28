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
import {
    getDeadlineEntity,
    updateDeadline,
} from '#src/services/deadlines.js'
import { recurrenceSchema as domainRecurrenceSchema } from '#src/services/recurrence.js'

const timezoneSchema = z
    .string()
    .trim()
    .min(1)
    .refine((zone) => DateTime.local().setZone(zone).isValid, {
        message: 'timezone must be a valid IANA time zone',
    })

const changesSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe('New user-visible deadline name'),
        description: z
            .string()
            .nullable()
            .optional()
            .describe(
                'New description. Use null to explicitly remove the description; omit to keep it unchanged',
            ),
        due: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'New due date and time with an explicit UTC offset. For occurrence scope this is the effective due time of that occurrence',
            ),
        dueIsDate: z
            .boolean()
            .optional()
            .describe(
                'Whether the deadline is date-only rather than due at a precise time. This flag does not rewrite the due value',
            ),
        timezone: timezoneSchema
            .optional()
            .describe(
                'New IANA timezone used for recurrence expansion, for example Europe/Moscow',
            ),
        recurrence: recurrenceSchema
            .nullable()
            .optional()
            .describe(
                'New recurrence rule, null to stop repeating, or omitted to preserve the rule. Not allowed with occurrence scope',
            ),
        visibility: deadlineVisibilitySchema
            .optional()
            .describe(
                'New display policy for the master or for the new series created by this_and_future. Not allowed for one occurrence',
            ),
    })
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'changes must contain at least one field',
    })

export const updateDeadlineInputSchema = z
    .object({
        id: z.int().positive().describe('ID of the original deadline master'),
        scope: z
            .enum(['series', 'occurrence', 'this_and_future'])
            .describe(
                'Update target: the entire series, only one occurrence, or the selected occurrence and all future occurrences',
            ),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'Original scheduled due time identifying the occurrence, even after a move. Required for occurrence and this_and_future; use recurrenceId returned by get_deadlines',
            ),
        changes: changesSchema.describe(
            'Fields to change. Omitted fields retain their current values',
        ),
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
        if (
            scope === 'occurrence' &&
            (changes.recurrence !== undefined ||
                changes.visibility !== undefined)
        ) {
            context.addIssue({
                code: 'custom',
                path: ['changes', 'recurrence'],
                message:
                    'recurrence and visibility cannot be changed for a single occurrence',
            })
        }
    })

export const updateDeadlineOutputSchema = deadlineEntitySchema.describe(
    'The complete updated master, or the new future master for this_and_future, in the same format as get_deadline',
)

export const updateDeadlineTool: ToolCallback<
    typeof updateDeadlineInputSchema
> = async ({ id, scope, recurrenceId, changes }) => {
    const converted = {
        ...(changes.title === undefined ? {} : { title: changes.title }),
        ...(changes.description === undefined
            ? {}
            : { description: changes.description }),
        ...(changes.due === undefined ? {} : { due: new Date(changes.due) }),
        ...(changes.dueIsDate === undefined
            ? {}
            : { dueIsDate: changes.dueIsDate }),
        ...(changes.timezone === undefined
            ? {}
            : { timezone: changes.timezone }),
        ...(changes.visibility === undefined
            ? {}
            : { visibility: changes.visibility }),
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
    }
    const deadlineId = await updateDeadline({
        id,
        scope,
        recurrenceId:
            recurrenceId === undefined ? undefined : new Date(recurrenceId),
        changes: converted,
    })
    const deadline = await getDeadlineEntity(deadlineId)
    if (deadline === undefined) {
        throw new Error(`Updated deadline ${deadlineId} could not be read back`)
    }
    return toToolResponse(serializeDeadlineEntity(deadline))
}
