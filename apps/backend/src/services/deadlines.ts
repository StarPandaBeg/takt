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
