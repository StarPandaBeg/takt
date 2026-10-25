import type { Deadline as TemplateDeadline } from '@takt/templates'
import { DateTime } from 'luxon'
import type { Deadline } from '../database/schema.js'

export function convertDeadline(
    deadline: Deadline,
    now: DateTime,
): TemplateDeadline {
    const date = DateTime.fromJSDate(deadline.due).setZone(now.zone)
    return {
        text: deadline.title,
        date,
        important: date.toMillis() <= now.plus({ days: 3 }).toMillis(),
    }
}

export function selectDeadlinesForScreen(
    deadlines: readonly TemplateDeadline[],
    limit: number = 4,
): TemplateDeadline[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Deadline limit must be a non-negative integer')
    }

    return [...deadlines]
        .sort((left, right) => left.date.toMillis() - right.date.toMillis())
        .slice(0, limit)
}
