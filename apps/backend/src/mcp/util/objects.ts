import * as z from 'zod'

import { deadlineIdSchema, eventIdSchema, noteIdSchema } from './ids.js'

const weekdayValues = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const weekdaySchema = z
    .enum(weekdayValues)
    .describe('Weekday code: MO, TU, WE, TH, FR, SA, or SU')
const recurrenceCommonFields = {
    interval: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe('Frequency multiplier; 2 means every second period'),
    count: z
        .number()
        .int()
        .positive()
        .max(10_000)
        .optional()
        .describe('Occurrence limit; mutually exclusive with until'),
    until: z.iso
        .datetime({ offset: true })
        .optional()
        .describe('ISO 8601 end time; mutually exclusive with count'),
}

export const recurrenceSchema = z
    .discriminatedUnion('frequency', [
        z.object({
            frequency: z.literal('daily'),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z.literal('weekly'),
            weekdays: z
                .array(weekdaySchema)
                .min(1)
                .max(7)
                .refine((days) => new Set(days).size === days.length, {
                    message: 'weekdays must not contain duplicates',
                })
                .describe('Repeat on these weekdays'),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z.literal('monthly-date'),
            day: z.number().int().min(1).max(31),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z.literal('monthly-weekday'),
            weekday: weekdaySchema,
            occurrence: z
                .union([z.literal(-1), z.number().int().min(1).max(5)])
                .describe('Weekday occurrence: 1–5, or -1 for last'),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z.literal('yearly'),
            ...recurrenceCommonFields,
        }),
    ])
    .refine((rule) => rule.count === undefined || rule.until === undefined, {
        message: 'count and until are mutually exclusive',
    })
    .describe('Recurrence rule')

export const eventOccurrenceExceptionSchema = z
    .discriminatedUnion('status', [
        z.object({
            status: z.literal('cancelled'),
            recurrenceId: z
                .string()
                .describe(
                    'ISO 8601 original start identifying the occurrence',
                ),
        }),

        z.object({
            status: z.literal('rescheduled'),
            recurrenceId: z
                .string()
                .describe(
                    'ISO 8601 original start identifying the occurrence',
                ),
            start: z.iso.datetime({ offset: true }).describe('ISO 8601'),
            end: z.iso
                .datetime({ offset: true })
                .nullable()
                .describe('ISO 8601'),
        }),

        z.object({
            status: z.literal('updated'),
            recurrenceId: z
                .string()
                .describe(
                    'ISO 8601 original start identifying the occurrence',
                ),
            start: z.iso.datetime({ offset: true }).describe('ISO 8601'),
            end: z.iso
                .datetime({ offset: true })
                .nullable()
                .describe('ISO 8601'),
            title: z.string(),
            description: z.string().nullable(),
            timezone: z.string().nullable(),
            allDay: z.boolean(),
        }),
    ])
    .describe('Recurring-event occurrence override')

export const eventEntitySchema = z.object({
    id: eventIdSchema,
    title: z.string(),
    description: z.string().nullable(),
    start: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    end: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('ISO 8601'),
    allDay: z.boolean(),
    timezone: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    updatedAt: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    cancelledAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('ISO 8601'),
    recurrence: recurrenceSchema.nullable(),
    exceptions: z.array(eventOccurrenceExceptionSchema),
})

export const resolvedEventSchema = z.object({
    id: eventIdSchema,
    title: z.string(),
    description: z.string().nullable(),
    start: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    end: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('ISO 8601'),
    timezone: z.string().nullable(),
    allDay: z.boolean(),
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'ISO 8601 original series start; null for a one-time event',
        ),
})

export const deadlineOccurrenceExceptionSchema = z.discriminatedUnion(
    'status',
    [
        z.object({
            status: z.literal('cancelled'),
            recurrenceId: z.iso
                .datetime({ offset: true })
                .describe(
                    'ISO 8601 original due time identifying the occurrence',
                ),
        }),
        z.object({
            status: z.literal('rescheduled'),
            recurrenceId: z.iso
                .datetime({ offset: true })
                .describe(
                    'ISO 8601 original due time identifying the occurrence',
                ),
            due: z.iso.datetime({ offset: true }).describe('ISO 8601'),
        }),
        z.object({
            status: z.literal('updated'),
            recurrenceId: z.iso
                .datetime({ offset: true })
                .describe(
                    'ISO 8601 original due time identifying the occurrence',
                ),
            title: z.string(),
            description: z.string().nullable(),
            due: z.iso.datetime({ offset: true }).describe('ISO 8601'),
            dueIsDate: z.boolean(),
            timezone: z.string(),
        }),
    ],
).describe('Recurring-deadline occurrence override')

export const deadlineVisibilitySchema = z
    .object({
        show: z.discriminatedUnion('type', [
            z.object({
                type: z.literal('always'),
            }),
            z.object({
                type: z.literal('before'),
                days: z
                    .int()
                    .min(0)
                    .max(3650)
                    .describe(
                        'Calendar days before due; 0 means the due date only',
                    ),
            }),
        ]),
        hide: z
            .enum(['on_due', 'on_complete'])
            .describe(
                'on_due hides after the local due day; on_complete waits for completion',
            ),
    })
    .describe('Deadline display window')

export const deadlineCompletionSchema = z.object({
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'ISO 8601 original due time; null for a one-time deadline',
        ),
    completedAt: z.iso.datetime({ offset: true }).describe('ISO 8601'),
})

export const deadlineEntitySchema = z.object({
    id: deadlineIdSchema,
    title: z.string(),
    description: z.string().nullable(),
    due: z.iso
        .datetime({ offset: true })
        .describe(
            'ISO 8601 master due time and recurrence anchor',
        ),
    dueIsDate: z.boolean(),
    timezone: z.string(),
    completedAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'ISO 8601 one-time completion; recurring occurrences use completions',
        ),
    cancelledAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'ISO 8601 whole-series cancellation time',
        ),
    createdAt: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    updatedAt: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    recurrence: recurrenceSchema.nullable(),
    exceptions: z.array(deadlineOccurrenceExceptionSchema),
    completions: z
        .array(deadlineCompletionSchema)
        .describe(
            'Occurrence completions keyed by recurrenceId',
        ),
    visibility: deadlineVisibilitySchema,
})

export const resolvedDeadlineSchema = z.object({
    id: deadlineIdSchema,
    title: z.string(),
    description: z.string().nullable(),
    due: z.iso.datetime({ offset: true }).describe('ISO 8601'),
    dueIsDate: z.boolean(),
    timezone: z.string(),
    completed: z.boolean(),
    completedAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('ISO 8601'),
    visibility: deadlineVisibilitySchema,
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'ISO 8601 original series due; null for a one-time deadline',
        ),
})

export const noteSchema = z.object({
    id: noteIdSchema,
    text: z.string(),
    completedAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('ISO 8601'),
})
