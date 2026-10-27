import type { Event, EventRecurrenceException } from '#src/database/schema.js'
import * as eventExceptionsRepository from '#src/repository/event-recurrence-exceptions.js'
import type { EventFilters } from '#src/repository/events.js'
import * as eventsRepository from '#src/repository/events.js'
import { DateTime } from 'luxon'
import { getEventOccurrences, type ResolvedEvent } from './event-occurrences.js'
import {
    getRecurrenceOccurrencesBetween,
    isRecurrenceOccurrence,
    parseRecurrence,
    serializeRecurrence,
    type Recurrence,
} from './recurrence.js'

export type { ResolvedEvent } from './event-occurrences.js'

export type EventOccurrenceException =
    | {
          readonly recurrenceId: Date
          readonly status: 'cancelled'
      }
    | {
          readonly recurrenceId: Date
          readonly status: 'rescheduled'
          readonly start: Date
          readonly end: Date | null
      }
    | {
          readonly recurrenceId: Date
          readonly status: 'updated'
          readonly title: string
          readonly description: string | null
          readonly start: Date
          readonly end: Date | null
          readonly timezone: string | null
          readonly allDay: boolean
      }

export type EventChanges = Partial<{
    readonly title: string
    readonly description: string | null
    readonly start: Date
    readonly end: Date | null
    readonly timezone: string | null
    readonly allDay: boolean
    readonly recurrence: Recurrence | null
}>

export type EventUpdateScope = 'series' | 'occurrence' | 'this_and_future'
export type EventCancellationScope = EventUpdateScope

export type EventEntity = Omit<Event, 'recurrenceRule'> & {
    readonly recurrence: Recurrence | null
    readonly exceptions: EventOccurrenceException[]
}

export function serializeEventRecurrence<
    T extends { recurrence?: Recurrence | null | undefined },
>({ recurrence, ...event }: T) {
    return {
        ...event,
        ...(recurrence === undefined
            ? {}
            : {
                  recurrenceRule:
                      recurrence === null
                          ? null
                          : serializeRecurrence(recurrence),
              }),
    }
}

function resolveException(
    exception: EventRecurrenceException,
    event: Event,
): EventOccurrenceException {
    if (exception.replacementStart === null) {
        return {
            recurrenceId: exception.recurrenceId,
            status: 'cancelled',
        }
    }
    if (exception.replacementTitle === null) {
        return {
            recurrenceId: exception.recurrenceId,
            status: 'rescheduled',
            start: exception.replacementStart,
            end: exception.replacementEnd,
        }
    }
    return {
        recurrenceId: exception.recurrenceId,
        status: 'updated',
        title: exception.replacementTitle,
        description: exception.replacementDescription,
        start: exception.replacementStart,
        end: exception.replacementEnd,
        timezone: exception.replacementTimezone,
        allDay: exception.replacementAllDay ?? event.allDay,
    }
}

function toEventEntity(
    event: Event,
    exceptions: readonly EventRecurrenceException[],
): EventEntity {
    const { recurrenceRule, ...fields } = event
    return {
        ...fields,
        recurrence:
            recurrenceRule === null ? null : parseRecurrence(recurrenceRule),
        exceptions: exceptions.map((exception) =>
            resolveException(exception, event),
        ),
    }
}

export async function getEventEntity(
    id: Event['id'],
): Promise<EventEntity | undefined> {
    const event = await eventsRepository.get(id)
    if (event === undefined) return undefined
    const exceptions = await eventExceptionsRepository.getForEventIds([id])
    return toEventEntity(event, exceptions)
}

export async function getEventEntities(
    filters: EventFilters,
): Promise<EventEntity[]> {
    const events = await eventsRepository.getFiltered(filters)
    const exceptions = await eventExceptionsRepository.getForEventIds(
        events.map(({ id }) => id),
    )
    const grouped = Map.groupBy(exceptions, (exception) => exception.eventId)
    return events.map((event) =>
        toEventEntity(event, grouped.get(event.id) ?? []),
    )
}

export async function getResolvedEvents(options: {
    readonly from: DateTime
    readonly to: DateTime
    readonly limit?: number | undefined
}): Promise<ResolvedEvent[]> {
    if (
        !options.from.isValid ||
        !options.to.isValid ||
        options.to <= options.from
    ) {
        throw new RangeError('Event range end must be later than start')
    }
    if (
        options.limit !== undefined &&
        (!Number.isInteger(options.limit) || options.limit <= 0)
    ) {
        throw new RangeError('Event limit must be a positive integer')
    }

    const masters = await eventsRepository.getOverlapping(
        options.from.toJSDate(),
        options.to.toJSDate(),
    )
    const exceptions = await eventExceptionsRepository.getForEventIds(
        masters.map(({ id }) => id),
    )
    const occurrences = getEventOccurrences(
        masters,
        exceptions,
        options.from,
        options.to,
    )
    return options.limit === undefined
        ? occurrences
        : occurrences.slice(0, options.limit)
}

function getEffectiveEnd(
    originalStart: Date,
    originalEnd: Date | null,
    changes: EventChanges,
): Date | null {
    if (changes.end !== undefined) return changes.end
    if (changes.start === undefined || originalEnd === null) return originalEnd
    return new Date(
        changes.start.getTime() +
            originalEnd.getTime() -
            originalStart.getTime(),
    )
}

function assertValidInterval(start: Date, end: Date | null): void {
    if (end !== null && end < start) {
        throw new RangeError('Event end must not be earlier than start')
    }
}

function getRecurringEvent(event: Event, recurrenceId: Date) {
    if (event.recurrenceRule === null) {
        throw new RangeError('Event is not recurring')
    }
    const zone = event.timezone ?? 'Europe/Moscow'
    const start = DateTime.fromJSDate(event.start).setZone(zone)
    const occurrence = DateTime.fromJSDate(recurrenceId).setZone(zone)
    const recurrence = parseRecurrence(event.recurrenceRule)
    if (!isRecurrenceOccurrence(start, recurrence, occurrence)) {
        throw new RangeError('recurrenceId is not an occurrence of this series')
    }
    return { start, occurrence, recurrence }
}

function getRecurrenceSplit(recurring: ReturnType<typeof getRecurringEvent>): {
    readonly previous: Recurrence
    readonly previousCount: number
} {
    const throughSelected = getRecurrenceOccurrencesBetween(
        recurring.start,
        recurring.recurrence,
        recurring.start,
        recurring.occurrence.plus({ milliseconds: 1 }),
    )
    const previousCount = throughSelected.length - 1
    const previousOccurrence = throughSelected.at(-2)
    if (previousOccurrence === undefined) {
        throw new RangeError('Cannot truncate before the first occurrence')
    }
    return {
        previous:
            recurring.recurrence.count === undefined
                ? {
                      ...recurring.recurrence,
                      until: previousOccurrence.toJSDate(),
                  }
                : {
                      ...recurring.recurrence,
                      count: previousCount,
                      until: undefined,
                  },
        previousCount,
    }
}

export async function updateEvent(options: {
    readonly id: number
    readonly scope: EventUpdateScope
    readonly recurrenceId?: Date | undefined
    readonly changes: EventChanges
}): Promise<number> {
    const event = await eventsRepository.get(options.id)
    if (event === undefined) throw new RangeError('Event not found')

    if (options.scope === 'series') {
        const start = options.changes.start ?? event.start
        const end = getEffectiveEnd(event.start, event.end, options.changes)
        assertValidInterval(start, end)
        await eventsRepository.edit(
            event.id,
            serializeEventRecurrence({
                ...options.changes,
                ...(options.changes.start === undefined ? {} : { start }),
                ...(options.changes.end === undefined &&
                options.changes.start === undefined
                    ? {}
                    : { end }),
            }),
        )
        return event.id
    }

    if (options.recurrenceId === undefined) {
        throw new RangeError(
            'recurrenceId is required for occurrence and this_and_future',
        )
    }
    const recurring = getRecurringEvent(event, options.recurrenceId)

    if (options.scope === 'occurrence') {
        if (options.changes.recurrence !== undefined) {
            throw new RangeError(
                'recurrence cannot be changed for a single occurrence',
            )
        }
        const entity = await getEventEntity(event.id)
        const found = entity?.exceptions.find(
            (exception) =>
                exception.status === 'updated' &&
                exception.recurrenceId.getTime() ===
                    options.recurrenceId!.getTime(),
        )
        const existing = found?.status === 'updated' ? found : undefined
        const originalStart = existing?.start ?? options.recurrenceId
        const originalEnd =
            existing === undefined
                ? event.end === null
                    ? null
                    : new Date(
                          options.recurrenceId.getTime() +
                              event.end.getTime() -
                              event.start.getTime(),
                      )
                : existing.end
        const start = options.changes.start ?? originalStart
        const end = getEffectiveEnd(originalStart, originalEnd, options.changes)
        assertValidInterval(start, end)
        await eventExceptionsRepository.set(
            event.id,
            options.recurrenceId,
            start,
            end,
            {
                title: options.changes.title ?? existing?.title ?? event.title,
                description:
                    options.changes.description !== undefined
                        ? options.changes.description
                        : existing === undefined
                          ? event.description
                          : existing.description,
                timezone:
                    options.changes.timezone !== undefined
                        ? options.changes.timezone
                        : existing === undefined
                          ? event.timezone
                          : existing.timezone,
                allDay:
                    options.changes.allDay ?? existing?.allDay ?? event.allDay,
            },
        )
        return event.id
    }

    if (options.recurrenceId.getTime() === event.start.getTime()) {
        return await updateEvent({
            id: event.id,
            scope: 'series',
            changes: options.changes,
        })
    }

    const { previous: previousRecurrence, previousCount } =
        getRecurrenceSplit(recurring)
    const inheritedFutureRecurrence: Recurrence = {
        ...recurring.recurrence,
        ...(recurring.recurrence.count === undefined
            ? {}
            : { count: recurring.recurrence.count - previousCount }),
    }
    const start = options.changes.start ?? options.recurrenceId
    const occurrenceEnd =
        event.end === null
            ? null
            : new Date(
                  options.recurrenceId.getTime() +
                      event.end.getTime() -
                      event.start.getTime(),
              )
    const end = getEffectiveEnd(
        options.recurrenceId,
        occurrenceEnd,
        options.changes,
    )
    assertValidInterval(start, end)
    const future = serializeEventRecurrence({
        title: options.changes.title ?? event.title,
        description:
            options.changes.description !== undefined
                ? options.changes.description
                : event.description,
        start,
        end,
        timezone:
            options.changes.timezone !== undefined
                ? options.changes.timezone
                : event.timezone,
        allDay: options.changes.allDay ?? event.allDay,
        recurrence:
            options.changes.recurrence !== undefined
                ? options.changes.recurrence
                : inheritedFutureRecurrence,
    })
    return await eventsRepository.split(
        event.id,
        options.recurrenceId,
        { recurrenceRule: serializeRecurrence(previousRecurrence) },
        future,
    )
}

export async function cancelEvent(options: {
    readonly id: number
    readonly scope: EventCancellationScope
    readonly recurrenceId?: Date | undefined
}): Promise<number> {
    const event = await eventsRepository.get(options.id)
    if (event === undefined) throw new RangeError('Event not found')
    if (event.cancelledAt !== null) return event.id

    if (options.scope === 'series') {
        await eventsRepository.cancel(event.id, new Date())
        return event.id
    }

    if (options.recurrenceId === undefined) {
        throw new RangeError(
            'recurrenceId is required for occurrence and this_and_future',
        )
    }
    const recurring = getRecurringEvent(event, options.recurrenceId)

    if (options.scope === 'occurrence') {
        await eventExceptionsRepository.set(
            event.id,
            options.recurrenceId,
            null,
            null,
        )
        return event.id
    }

    if (options.recurrenceId.getTime() === event.start.getTime()) {
        await eventsRepository.cancel(event.id, new Date())
        return event.id
    }

    await eventsRepository.truncate(
        event.id,
        options.recurrenceId,
        serializeRecurrence(getRecurrenceSplit(recurring).previous),
    )
    return event.id
}
