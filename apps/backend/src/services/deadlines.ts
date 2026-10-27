import type {
    Deadline,
    DeadlineRecurrenceException,
} from '#/database/schema.js'
import type { Deadline as TemplateDeadline } from '@takt/templates'
import { DateTime } from 'luxon'
import { getRecurrenceOccurrences, parseRecurrence } from './recurrence.js'

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

export function getUpcomingDeadlineOccurrences(
    deadlines: readonly Deadline[],
    exceptions: readonly DeadlineRecurrenceException[],
    from: DateTime,
    limit: number,
): Deadline[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Deadline occurrence limit must be non-negative')
    }

    const exceptionsByDeadline = Map.groupBy(
        exceptions,
        (exception) => exception.deadlineId,
    )
    const occurrences = deadlines.flatMap((deadline) => {
        if (deadline.recurrenceRule === null) {
            return deadline.due >= from.toJSDate() ? [deadline] : []
        }

        const deadlineExceptions = exceptionsByDeadline.get(deadline.id) ?? []
        const recurrenceIds = new Set(
            deadlineExceptions.map(({ recurrenceId }) =>
                recurrenceId.getTime(),
            ),
        )
        const zone = deadline.timezone
        const start = DateTime.fromJSDate(deadline.due).setZone(zone)
        const rangeStart = from.setZone(zone)
        const regular = getRecurrenceOccurrences(
            start,
            parseRecurrence(deadline.recurrenceRule),
            rangeStart,
            limit + deadlineExceptions.length,
        )
            .filter((due) => !recurrenceIds.has(due.toMillis()))
            .map((due) => ({ ...deadline, due: due.toJSDate() }))
        const replacements = deadlineExceptions.flatMap(({ replacementDue }) =>
            replacementDue !== null && replacementDue >= from.toJSDate()
                ? [{ ...deadline, due: replacementDue }]
                : [],
        )
        return [...regular, ...replacements]
    })

    return occurrences
        .sort((left, right) => left.due.getTime() - right.due.getTime())
        .slice(0, limit)
}
