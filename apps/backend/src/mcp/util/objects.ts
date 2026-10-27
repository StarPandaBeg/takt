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
                    'Original scheduled start time identifying an occurrence in the recurring series, even if it was rescheduled',
                ),
        }),

        z.object({
            status: z
                .literal('rescheduled')
                .describe('This occurrence has been rescheduled'),
            recurrenceId: z
                .string()
                .describe(
                    'Original scheduled start time identifying an occurrence in the recurring series, even if it was rescheduled',
                ),
            start: z.iso
                .datetime({ offset: true })
                .describe(
                    'New start time of the rescheduled occurrence (ISO 8601)',
                ),
            end: z.iso
                .datetime({ offset: true })
                .nullable()
                .describe(
                    'New end time of the rescheduled occurrence (ISO 8601), or null if unspecified',
                ),
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
    recurrence: recurrenceSchema
        .nullable()
        .describe('Rule describing how this event repeats'),
    exceptions: z
        .array(eventOccurrenceExceptionSchema)
        .describe('Cancelled or rescheduled occurrences of a recurring event'),
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
