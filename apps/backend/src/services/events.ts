import type { Event as TemplateEvent } from '@takt/templates'
import { DateTime } from 'luxon'
import type { Event, EventRecurrenceException } from '../database/schema.js'
import {
    getRecurrenceOccurrencesBetween,
    parseRecurrence,
} from './recurrence.js'

export const convertEvent = (event: Event): TemplateEvent => {
    const zone = event.timezone ?? 'Europe/Moscow'
    return {
        text: event.title,
        start: DateTime.fromJSDate(event.start).setZone(zone),
        ...(event.end === null
            ? {}
            : { end: DateTime.fromJSDate(event.end).setZone(zone) }),
    }
}

function overlaps(event: Event, from: Date, to: Date): boolean {
    return (
        event.start < to &&
        (event.end === null ? event.start >= from : event.end > from)
    )
}

export function getEventOccurrences(
    events: readonly Event[],
    exceptions: readonly EventRecurrenceException[],
    from: DateTime,
    to: DateTime,
): Event[] {
    const exceptionsByEvent = Map.groupBy(
        exceptions,
        (exception) => exception.eventId,
    )
    const fromDate = from.toJSDate()
    const toDate = to.toJSDate()

    return events
        .flatMap((event) => {
            if (event.recurrenceRule === null) {
                return overlaps(event, fromDate, toDate) ? [event] : []
            }

            const eventExceptions = exceptionsByEvent.get(event.id) ?? []
            const recurrenceIds = new Set(
                eventExceptions.map(({ recurrenceId }) =>
                    recurrenceId.getTime(),
                ),
            )
            const zone = event.timezone ?? 'Europe/Moscow'
            const start = DateTime.fromJSDate(event.start).setZone(zone)
            const duration =
                event.end === null
                    ? undefined
                    : event.end.getTime() - event.start.getTime()
            const occurrenceFrom =
                duration === undefined
                    ? from.setZone(zone)
                    : from.setZone(zone).minus({ milliseconds: duration })
            const regular = getRecurrenceOccurrencesBetween(
                start,
                parseRecurrence(event.recurrenceRule),
                occurrenceFrom,
                to.setZone(zone),
            )
                .filter(
                    (occurrence) => !recurrenceIds.has(occurrence.toMillis()),
                )
                .map((occurrence) => ({
                    ...event,
                    start: occurrence.toJSDate(),
                    end:
                        duration === undefined
                            ? null
                            : occurrence.plus({ milliseconds: duration }).toJSDate(),
                }))
                .filter((occurrence) => overlaps(occurrence, fromDate, toDate))
            const replacements = eventExceptions.flatMap((exception) => {
                if (exception.replacementStart === null) return []
                const replacement = {
                    ...event,
                    start: exception.replacementStart,
                    end: exception.replacementEnd,
                }
                return overlaps(replacement, fromDate, toDate)
                    ? [replacement]
                    : []
            })
            return [...regular, ...replacements]
        })
        .sort((left, right) => left.start.getTime() - right.start.getTime())
}
