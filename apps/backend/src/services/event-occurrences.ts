import type { Event as TemplateEvent } from '@takt/templates'
import { DateTime } from 'luxon'
import type { Event, EventRecurrenceException } from '../database/schema.js'
import {
    getRecurrenceOccurrencesBetween,
    parseRecurrence,
} from './recurrence.js'

export interface ResolvedEvent {
    readonly id: Event['id']
    readonly title: Event['title']
    readonly description: Event['description']
    readonly start: Event['start']
    readonly end: Event['end']
    readonly timezone: Event['timezone']
    readonly allDay: Event['allDay']
    /** Original scheduled start of a recurring occurrence. */
    readonly recurrenceId: Date | null
}

export const convertEvent = (event: ResolvedEvent): TemplateEvent => {
    const zone = event.timezone ?? 'Europe/Moscow'
    return {
        text: event.title,
        start: DateTime.fromJSDate(event.start).setZone(zone),
        ...(event.end === null
            ? {}
            : { end: DateTime.fromJSDate(event.end).setZone(zone) }),
    }
}

function overlaps(
    event: Pick<ResolvedEvent, 'start' | 'end'>,
    from: Date,
    to: Date,
): boolean {
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
): ResolvedEvent[] {
    const exceptionsByEvent = Map.groupBy(
        exceptions,
        (exception) => exception.eventId,
    )
    const fromDate = from.toJSDate()
    const toDate = to.toJSDate()

    return events
        .flatMap<ResolvedEvent>((event) => {
            if (event.recurrenceRule === null) {
                return overlaps(event, fromDate, toDate)
                    ? [
                          {
                              id: event.id,
                              title: event.title,
                              description: event.description,
                              start: event.start,
                              end: event.end,
                              timezone: event.timezone,
                              allDay: event.allDay,
                              recurrenceId: null,
                          },
                      ]
                    : []
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
                .map<ResolvedEvent>((occurrence) => ({
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    start: occurrence.toJSDate(),
                    end:
                        duration === undefined
                            ? null
                            : occurrence
                                  .plus({ milliseconds: duration })
                                  .toJSDate(),
                    timezone: event.timezone,
                    allDay: event.allDay,
                    recurrenceId: occurrence.toJSDate(),
                }))
                .filter((occurrence) => overlaps(occurrence, fromDate, toDate))
            const replacements = eventExceptions.flatMap((exception) => {
                if (exception.replacementStart === null) return []
                const replacement: ResolvedEvent = {
                    id: event.id,
                    title: exception.replacementTitle ?? event.title,
                    description:
                        exception.replacementTitle === null
                            ? event.description
                            : exception.replacementDescription,
                    start: exception.replacementStart,
                    end: exception.replacementEnd,
                    timezone:
                        exception.replacementTitle === null
                            ? event.timezone
                            : exception.replacementTimezone,
                    allDay: exception.replacementAllDay ?? event.allDay,
                    recurrenceId: exception.recurrenceId,
                }
                return overlaps(replacement, fromDate, toDate)
                    ? [replacement]
                    : []
            })
            return [...regular, ...replacements]
        })
        .sort((left, right) => left.start.getTime() - right.start.getTime())
}
