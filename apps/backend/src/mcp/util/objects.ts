import * as z from 'zod'

const weekdayValues = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const weekdaySchema = z
    .enum(weekdayValues)
    .describe(
        'Day of the week using two-letter codes (MO = Monday, SU = Sunday)',
    )
const recurrenceCommonFields = {
    interval: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .describe(
            'Repeat interval relative to the frequency. For example, 2 means every second week for weekly recurrence',
        ),
    count: z
        .number()
        .int()
        .positive()
        .max(10_000)
        .optional()
        .describe(
            'Maximum number of occurrences. Mutually exclusive with until',
        ),
    until: z.iso
        .datetime({ offset: true })
        .optional()
        .describe(
            'Recurrence end date and time (ISO 8601). Mutually exclusive with count',
        ),
}

export const recurrenceSchema = z
    .discriminatedUnion('frequency', [
        z.object({
            frequency: z.literal('daily').describe('Repeat every day'),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z
                .literal('weekly')
                .describe('Repeat on specified weekdays'),
            weekdays: z
                .array(weekdaySchema)
                .min(1)
                .max(7)
                .refine((days) => new Set(days).size === days.length, {
                    message: 'weekdays must not contain duplicates',
                })
                .describe('Days of the week on which the event repeats'),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z
                .literal('monthly-date')
                .describe('Repeat on a specified day of each month'),
            day: z
                .number()
                .int()
                .min(1)
                .max(31)
                .describe('Day of the month (1–31)'),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z
                .literal('monthly-weekday')
                .describe(
                    'Repeat on a specified occurrence of a weekday each month',
                ),
            weekday: weekdaySchema.describe(
                'Day of the week on which the event repeats',
            ),
            occurrence: z
                .union([z.literal(-1), z.number().int().min(1).max(5)])
                .describe(
                    'Occurrence of the weekday within the month: 1–5 for first through fifth, or -1 for last',
                ),
            ...recurrenceCommonFields,
        }),

        z.object({
            frequency: z.literal('yearly').describe('Repeat every year'),
            ...recurrenceCommonFields,
        }),
    ])
    .refine((rule) => rule.count === undefined || rule.until === undefined, {
        message: 'count and until are mutually exclusive',
    })
    .describe('Recurrence rule defining when and how often the event repeats')

export const eventOccurrenceExceptionSchema = z
    .discriminatedUnion('status', [
        z.object({
            status: z
                .literal('cancelled')
                .describe('This occurrence has been cancelled'),
            recurrenceId: z
                .string()
                .describe(
                    'Original scheduled start time identifying an occurrence in the recurring series, even if it was updated',
                ),
        }),

        z.object({
            status: z
                .literal('rescheduled')
                .describe('This occurrence has a time-only override'),
            recurrenceId: z
                .string()
                .describe(
                    'Original scheduled start time identifying an occurrence in the recurring series',
                ),
            start: z.iso
                .datetime({ offset: true })
                .describe('New occurrence start time (ISO 8601)'),
            end: z.iso
                .datetime({ offset: true })
                .nullable()
                .describe('New occurrence end time, or null if unspecified'),
        }),

        z.object({
            status: z
                .literal('updated')
                .describe('This occurrence overrides fields of the series'),
            recurrenceId: z
                .string()
                .describe(
                    'Original scheduled start time identifying an occurrence in the recurring series, even if it was rescheduled',
                ),
            start: z.iso
                .datetime({ offset: true })
                .describe(
                    'Effective start time of the updated occurrence (ISO 8601)',
                ),
            end: z.iso
                .datetime({ offset: true })
                .nullable()
                .describe(
                    'Effective end time of the updated occurrence (ISO 8601), or null if unspecified',
                ),
            title: z.string().describe('Occurrence-specific event name'),
            description: z
                .string()
                .nullable()
                .describe('Occurrence-specific description'),
            timezone: z
                .string()
                .nullable()
                .describe('Occurrence-specific IANA timezone, or null'),
            allDay: z.boolean().describe('Whether this occurrence is all-day'),
        }),
    ])
    .describe('Exception overriding a single occurrence of a recurring event')

export const eventEntitySchema = z.object({
    id: z.int().describe('Event ID'),
    title: z.string().describe('User-friendly event name'),
    description: z
        .string()
        .nullable()
        .describe('User-friendly event description'),
    start: z.iso
        .datetime({ offset: true })
        .describe('Event start time (ISO 8601)'),
    end: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('Event end time (ISO 8601) or null, if end time is unknown'),
    allDay: z.boolean().describe('Indicates whether event takes all day'),
    timezone: z
        .string()
        .nullable()
        .describe('IANA timezone of the recurring master, or null'),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    cancelledAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('When the entire event master was cancelled, or null'),
    recurrence: recurrenceSchema
        .nullable()
        .describe('Rule describing how this event repeats'),
    exceptions: z
        .array(eventOccurrenceExceptionSchema)
        .describe('Cancelled or updated occurrences of a recurring event'),
})

export const resolvedEventSchema = z.object({
    id: z.int().describe('ID of the event master'),
    title: z.string().describe('User-friendly event name'),
    description: z.string().nullable().describe('Event description'),
    start: z.iso
        .datetime({ offset: true })
        .describe('Actual start of this resolved occurrence'),
    end: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('Actual end, or null for a point event'),
    timezone: z.string().nullable().describe('IANA timezone of the master'),
    allDay: z.boolean().describe('Whether the event is all-day'),
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'Original scheduled start identifying this series occurrence, or null for a non-recurring event',
        ),
})

export const deadlineOccurrenceExceptionSchema = z.discriminatedUnion(
    'status',
    [
        z.object({
            status: z
                .literal('cancelled')
                .describe('The occurrence is cancelled and will not appear'),
            recurrenceId: z.iso
                .datetime({ offset: true })
                .describe(
                    'Original scheduled due time identifying the cancelled occurrence',
                ),
        }),
        z.object({
            status: z
                .literal('rescheduled')
                .describe('Legacy time-only override for an occurrence'),
            recurrenceId: z.iso
                .datetime({ offset: true })
                .describe(
                    'Original scheduled due time, unchanged after rescheduling',
                ),
            due: z.iso
                .datetime({ offset: true })
                .describe('Effective replacement due time'),
        }),
        z.object({
            status: z
                .literal('updated')
                .describe(
                    'Full occurrence-specific override of the master fields',
                ),
            recurrenceId: z.iso
                .datetime({ offset: true })
                .describe(
                    'Original scheduled due time identifying this occurrence',
                ),
            title: z.string().describe('Occurrence-specific deadline name'),
            description: z
                .string()
                .nullable()
                .describe('Occurrence-specific description, or null'),
            due: z.iso
                .datetime({ offset: true })
                .describe('Effective occurrence due time'),
            dueIsDate: z
                .boolean()
                .describe('Whether this occurrence is date-only'),
            timezone: z
                .string()
                .describe('IANA timezone of this occurrence'),
        }),
    ],
).describe('Override applied to one occurrence of a recurring deadline')

export const deadlineVisibilitySchema = z
    .object({
        show: z.discriminatedUnion('type', [
            z.object({
                type: z
                    .literal('always')
                    .describe('Show as soon as the deadline exists'),
            }),
            z.object({
                type: z
                    .literal('before')
                    .describe('Show a fixed number of calendar days before due'),
                days: z
                    .int()
                    .min(0)
                    .max(3650)
                    .describe(
                        'Number of calendar days before the due date. Zero means the due date only',
                    ),
            }),
        ]),
        hide: z
            .enum(['on_due', 'on_complete'])
            .describe(
                'on_due hides after the local due day ends; on_complete keeps overdue occurrences visible until explicitly completed',
            ),
    })
    .describe('Policy controlling when the deadline appears and disappears')

export const deadlineCompletionSchema = z.object({
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'Original occurrence due time, or null for a one-time deadline',
        ),
    completedAt: z.iso
        .datetime({ offset: true })
        .describe('Time when this deadline occurrence was completed'),
})

export const deadlineEntitySchema = z.object({
    id: z.int().positive().describe('Stable ID of the deadline master'),
    title: z.string().describe('User-visible deadline name'),
    description: z
        .string()
        .nullable()
        .describe('Deadline details, or null when absent'),
    due: z.iso
        .datetime({ offset: true })
        .describe(
            'Stored due time of the master and recurrence anchor, not necessarily the due time of every occurrence',
        ),
    dueIsDate: z
        .boolean()
        .describe('Whether the master represents a calendar date only'),
    timezone: z
        .string()
        .describe('IANA timezone used to expand the recurrence rule'),
    completedAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'Completion time for a one-time deadline or legacy whole-master completion, otherwise null',
        ),
    cancelledAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'Time when the entire master was softly cancelled, or null when active',
        ),
    createdAt: z.iso
        .datetime({ offset: true })
        .describe('Time when this master was created'),
    updatedAt: z.iso
        .datetime({ offset: true })
        .describe('Time when this master was last modified'),
    recurrence: recurrenceSchema
        .nullable()
        .describe('Recurrence rule, or null for a one-time deadline'),
    exceptions: z
        .array(deadlineOccurrenceExceptionSchema)
        .describe('Occurrence-specific cancellations, moves, and updates'),
    completions: z
        .array(deadlineCompletionSchema)
        .describe(
            'Independent completion records keyed by original recurrenceId',
        ),
    visibility: deadlineVisibilitySchema,
})

export const resolvedDeadlineSchema = z.object({
    id: z.int().positive().describe('ID of the deadline master'),
    title: z.string().describe('Effective name of this occurrence'),
    description: z
        .string()
        .nullable()
        .describe('Effective description of this occurrence, or null'),
    due: z.iso.datetime({ offset: true }).describe('Effective due time'),
    dueIsDate: z
        .boolean()
        .describe('Whether this occurrence represents a calendar date only'),
    timezone: z
        .string()
        .describe('Effective IANA timezone of this occurrence'),
    completed: z
        .boolean()
        .describe('Whether this occurrence is completed'),
    completedAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe('Completion time for this occurrence, or null'),
    visibility: deadlineVisibilitySchema,
    recurrenceId: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'Original scheduled due time identifying this occurrence, or null for a non-recurring deadline',
        ),
})

export const noteSchema = z.object({
    id: z.int().describe('ID of the note'),
    text: z.string(),
    completedAt: z.iso
        .datetime({ offset: true })
        .nullable()
        .describe(
            'Time when note was completed. May be null if note is active',
        ),
})
