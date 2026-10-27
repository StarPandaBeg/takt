import { DateTime } from 'luxon'
import type { Event, EventRecurrenceException } from '../database/schema.js'
import * as eventExceptionsRepository from '../repository/event-recurrence-exceptions.js'
import type { EventFilters } from '../repository/events.js'
import * as eventsRepository from '../repository/events.js'
import { getEventOccurrences, type ResolvedEvent } from './event-occurrences.js'
import {
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
): EventOccurrenceException {
    return exception.replacementStart === null
        ? {
              recurrenceId: exception.recurrenceId,
              status: 'cancelled',
          }
        : {
              recurrenceId: exception.recurrenceId,
              status: 'rescheduled',
              start: exception.replacementStart,
              end: exception.replacementEnd,
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
        exceptions: exceptions.map(resolveException),
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
