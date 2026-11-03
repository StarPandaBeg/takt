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
        title: z.string().trim().min(1).optional(),
        description: z
            .string()
            .nullable()
            .optional()
            .describe(
                'null clears; omit to keep unchanged',
            ),
        due: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601; effective occurrence due for occurrence scope',
            ),
        dueIsDate: z
            .boolean()
            .optional()
            .describe(
                'Date-only flag; does not rewrite due',
            ),
        timezone: timezoneSchema
            .optional()
            .describe(
                'IANA recurrence timezone',
            ),
        recurrence: recurrenceSchema
            .nullable()
            .optional()
            .describe(
                'null stops recurrence; unavailable for occurrence scope',
            ),
        visibility: deadlineVisibilitySchema
            .optional()
            .describe(
                'Unavailable for occurrence scope',
            ),
    })
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'changes must contain at least one field',
    })

export const updateDeadlineInputSchema = z
    .object({
        id: z.int().positive(),
        scope: z
            .enum(['series', 'occurrence', 'this_and_future'])
            .describe(
                'Target: whole series, one occurrence, or this and future',
            ),
        recurrenceId: z.iso
            .datetime({ offset: true })
            .optional()
            .describe(
                'ISO 8601 original series due; required unless scope is series',
            ),
        changes: changesSchema.describe('Omitted fields stay unchanged'),
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

export const updateDeadlineOutputSchema = deadlineEntitySchema

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
