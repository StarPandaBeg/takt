import { DateTime } from 'luxon'
import * as z from 'zod'

const weekdayValues = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const weekdaySchema = z.enum(weekdayValues)
const commonFields = {
    interval: z.number().int().positive().max(1000).optional(),
    count: z.number().int().positive().max(10_000).optional(),
    until: z.coerce.date().optional(),
}

export const recurrenceSchema = z
    .discriminatedUnion('frequency', [
        z.object({ frequency: z.literal('daily'), ...commonFields }),
        z.object({
            frequency: z.literal('weekly'),
            weekdays: z
                .array(weekdaySchema)
                .min(1)
                .max(7)
                .refine((days) => new Set(days).size === days.length, {
                    message: 'weekdays must not contain duplicates',
                }),
            ...commonFields,
        }),
        z.object({
            frequency: z.literal('monthly-date'),
            day: z.number().int().min(1).max(31),
            ...commonFields,
        }),
        z.object({
            frequency: z.literal('monthly-weekday'),
            weekday: weekdaySchema,
            occurrence: z.union([
                z.literal(-1),
                z.number().int().min(1).max(5),
            ]),
            ...commonFields,
        }),
        z.object({ frequency: z.literal('yearly'), ...commonFields }),
    ])
    .refine((rule) => rule.count === undefined || rule.until === undefined, {
        message: 'count and until are mutually exclusive',
    })

export type Recurrence = z.infer<typeof recurrenceSchema>

const frequencyNames = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    'monthly-date': 'MONTHLY',
    'monthly-weekday': 'MONTHLY',
    yearly: 'YEARLY',
} as const satisfies Record<Recurrence['frequency'], string>

function formatUntil(date: Date): string {
    return DateTime.fromJSDate(date)
        .toUTC()
        .toFormat("yyyyMMdd'T'HHmmss'Z'")
}

export function serializeRecurrence(rule: Recurrence): string {
    const parts = [`FREQ=${frequencyNames[rule.frequency]}`]
    if (rule.interval !== undefined && rule.interval !== 1) {
        parts.push(`INTERVAL=${rule.interval}`)
    }

    if (rule.frequency === 'weekly') {
        const order = new Map(weekdayValues.map((day, index) => [day, index]))
        const weekdays = [...rule.weekdays].sort(
            (left, right) => order.get(left)! - order.get(right)!,
        )
        parts.push(`BYDAY=${weekdays.join(',')}`)
    } else if (rule.frequency === 'monthly-date') {
        parts.push(`BYMONTHDAY=${rule.day}`)
    } else if (rule.frequency === 'monthly-weekday') {
        parts.push(`BYDAY=${rule.occurrence}${rule.weekday}`)
    }

    if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`)
    if (rule.until !== undefined) parts.push(`UNTIL=${formatUntil(rule.until)}`)
    return parts.join(';')
}

function parsePositiveInteger(value: string | undefined, name: string): number {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new RangeError(`Invalid ${name} in recurrence rule`)
    }
    return parsed
}

function parseUntil(value: string): Date {
    const parsed = DateTime.fromFormat(value, "yyyyMMdd'T'HHmmss'Z'", {
        zone: 'utc',
    })
    if (!parsed.isValid) throw new RangeError('Invalid UNTIL in recurrence rule')
    return parsed.toJSDate()
}

export function parseRecurrence(value: string): Recurrence {
    const fields = new Map(
        value.split(';').map((part) => {
            const separator = part.indexOf('=')
            if (separator <= 0) throw new RangeError('Invalid recurrence rule')
            return [part.slice(0, separator), part.slice(separator + 1)]
        }),
    )
    const interval = fields.has('INTERVAL')
        ? parsePositiveInteger(fields.get('INTERVAL'), 'INTERVAL')
        : undefined
    const count = fields.has('COUNT')
        ? parsePositiveInteger(fields.get('COUNT'), 'COUNT')
        : undefined
    const until = fields.has('UNTIL')
        ? parseUntil(fields.get('UNTIL')!)
        : undefined
    const common = {
        ...(interval === undefined ? {} : { interval }),
        ...(count === undefined ? {} : { count }),
        ...(until === undefined ? {} : { until }),
    }

    let candidate: unknown
    switch (fields.get('FREQ')) {
        case 'DAILY':
            candidate = { frequency: 'daily', ...common }
            break
        case 'WEEKLY':
            candidate = {
                frequency: 'weekly',
                weekdays: fields.get('BYDAY')?.split(','),
                ...common,
            }
            break
        case 'MONTHLY': {
            const monthDay = fields.get('BYMONTHDAY')
            const byDay = fields.get('BYDAY')
            if (monthDay !== undefined) {
                candidate = {
                    frequency: 'monthly-date',
                    day: Number(monthDay),
                    ...common,
                }
            } else {
                const match = /^(-1|[1-5])(MO|TU|WE|TH|FR|SA|SU)$/.exec(
                    byDay ?? '',
                )
                if (match === null) {
                    throw new RangeError('Invalid monthly BYDAY recurrence')
                }
                candidate = {
                    frequency: 'monthly-weekday',
                    occurrence: Number(match[1]),
                    weekday: match[2],
                    ...common,
                }
            }
            break
        }
        case 'YEARLY':
            candidate = { frequency: 'yearly', ...common }
            break
        default:
            throw new RangeError('Unsupported recurrence frequency')
    }

    return recurrenceSchema.parse(candidate)
}

const weekdayNumbers = new Map(
    weekdayValues.map((weekday, index) => [weekday, index + 1]),
)

function atStartTime(date: DateTime, start: DateTime): DateTime {
    return date.set({
        hour: start.hour,
        minute: start.minute,
        second: start.second,
        millisecond: start.millisecond,
    })
}

function* recurrenceCandidates(
    start: DateTime,
    rule: Recurrence,
): Generator<DateTime> {
    const interval = rule.interval ?? 1

    switch (rule.frequency) {
        case 'daily': {
            for (let offset = 0; ; offset += interval) {
                yield start.plus({ days: offset })
            }
        }
        case 'weekly': {
            const weekdays = rule.weekdays
                .map((weekday) => weekdayNumbers.get(weekday)!)
                .sort((left, right) => left - right)
            const firstWeek = start.startOf('week')
            for (let offset = 0; ; offset += interval) {
                const week = firstWeek.plus({ weeks: offset })
                for (const weekday of weekdays) {
                    const occurrence = atStartTime(
                        week.plus({ days: weekday - 1 }),
                        start,
                    )
                    if (occurrence >= start) yield occurrence
                }
            }
        }
        case 'monthly-date': {
            const firstMonth = start.startOf('month')
            for (let offset = 0; ; offset += interval) {
                const month = firstMonth.plus({ months: offset })
                const occurrence = atStartTime(
                    month.set({ day: rule.day }),
                    start,
                )
                if (
                    occurrence.isValid &&
                    occurrence.month === month.month &&
                    occurrence >= start
                ) {
                    yield occurrence
                }
            }
        }
        case 'monthly-weekday': {
            const weekday = weekdayNumbers.get(rule.weekday)!
            const firstMonth = start.startOf('month')
            for (let offset = 0; ; offset += interval) {
                const month = firstMonth.plus({ months: offset })
                let occurrence: DateTime
                if (rule.occurrence === -1) {
                    const end = month.endOf('month').startOf('day')
                    occurrence = end.minus({
                        days: (end.weekday - weekday + 7) % 7,
                    })
                } else {
                    occurrence = month.plus({
                        days:
                            (weekday - month.weekday + 7) % 7 +
                            (rule.occurrence - 1) * 7,
                    })
                }
                occurrence = atStartTime(occurrence, start)
                if (
                    occurrence.month === month.month &&
                    occurrence >= start
                ) {
                    yield occurrence
                }
            }
        }
        case 'yearly': {
            for (let offset = 0; ; offset += interval) {
                const occurrence = DateTime.fromObject(
                    {
                        year: start.year + offset,
                        month: start.month,
                        day: start.day,
                        hour: start.hour,
                        minute: start.minute,
                        second: start.second,
                        millisecond: start.millisecond,
                    },
                    { zone: start.zone },
                )
                if (
                    occurrence.isValid &&
                    occurrence.month === start.month &&
                    occurrence.day === start.day
                ) {
                    yield occurrence
                }
            }
        }
    }
}

const MAX_EXPANSION_CANDIDATES = 100_000

export function isRecurrenceOccurrence(
    start: DateTime,
    rule: Recurrence,
    candidate: DateTime,
): boolean {
    const target = candidate.setZone(start.zone)
    if (target < start) return false

    const until =
        rule.until === undefined
            ? undefined
            : DateTime.fromJSDate(rule.until).setZone(start.zone)
    let generated = 0

    for (const occurrence of recurrenceCandidates(start, rule)) {
        generated += 1
        if (generated > MAX_EXPANSION_CANDIDATES) {
            throw new RangeError('Recurrence validation exceeded its limit')
        }
        if (until !== undefined && occurrence > until) return false
        if (generated > (rule.count ?? Infinity)) return false
        if (occurrence.toMillis() === target.toMillis()) return true
        if (occurrence > target) return false
    }

    return false
}

export function getRecurrenceOccurrencesBetween(
    start: DateTime,
    rule: Recurrence,
    from: DateTime,
    to: DateTime,
): DateTime[] {
    if (to < from) throw new RangeError('Recurrence range end precedes start')

    const occurrences: DateTime[] = []
    const until =
        rule.until === undefined
            ? undefined
            : DateTime.fromJSDate(rule.until).setZone(start.zone)
    let generated = 0

    for (const occurrence of recurrenceCandidates(start, rule)) {
        generated += 1
        if (generated > MAX_EXPANSION_CANDIDATES) {
            throw new RangeError('Recurrence expansion exceeded its limit')
        }
        if (until !== undefined && occurrence > until) break
        if (generated > (rule.count ?? Infinity) || occurrence >= to) break
        if (occurrence >= from) occurrences.push(occurrence)
    }

    return occurrences
}

export function getRecurrenceOccurrences(
    start: DateTime,
    rule: Recurrence,
    from: DateTime,
    limit: number,
): DateTime[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Occurrence limit must be a non-negative integer')
    }
    if (limit === 0) return []

    const occurrences: DateTime[] = []
    const until =
        rule.until === undefined
            ? undefined
            : DateTime.fromJSDate(rule.until).setZone(start.zone)
    let generated = 0
    let examined = 0

    for (const occurrence of recurrenceCandidates(start, rule)) {
        examined += 1
        if (examined > MAX_EXPANSION_CANDIDATES) {
            throw new RangeError('Recurrence expansion exceeded its limit')
        }
        if (until !== undefined && occurrence > until) break

        generated += 1
        if (occurrence >= from) occurrences.push(occurrence)
        if (occurrences.length >= limit || generated >= (rule.count ?? Infinity)) {
            break
        }
    }

    return occurrences
}
