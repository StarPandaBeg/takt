import type { Event as TemplateEvent } from '@takt/templates'
import { DateTime } from 'luxon'
import type { Event } from '../database/schema.js'

const POINT_EVENT_DURATION_MINUTES = 15

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

function getDisplayEnd(event: TemplateEvent): DateTime {
    return (
        event.end ?? event.start.plus({ minutes: POINT_EVENT_DURATION_MINUTES })
    )
}

/** Selects a chronological window that follows the current point in the day. */
export function selectEventsForScreen(
    events: readonly TemplateEvent[],
    now: DateTime,
    limit: number = 8,
): TemplateEvent[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Event limit must be a non-negative integer')
    }
    if (limit === 0) return []

    const sorted = [...events].sort(
        (left, right) => left.start.toMillis() - right.start.toMillis(),
    )
    if (sorted.length <= limit) return sorted

    const firstCurrentOrFuture = sorted.findIndex(
        (event) => getDisplayEnd(event).toMillis() > now.toMillis(),
    )
    // Drop finished entries from the beginning first. If that is not enough
    // to reach the limit, trim the far future from the end.
    const preferredStart =
        firstCurrentOrFuture === -1
            ? sorted.length - limit
            : firstCurrentOrFuture
    const start = Math.min(preferredStart, sorted.length - limit)
    return sorted.slice(start, start + limit)
}
