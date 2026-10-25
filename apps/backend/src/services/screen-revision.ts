import {
    getEventState,
    type Deadline,
    type Event,
    type Note,
} from '@takt/templates'
import { hash } from 'crypto'
import type { DateTime } from 'luxon'
import { selectDeadlinesForScreen } from './deadlines.js'
import { selectEventsForScreen } from './events.js'

export const createScreenRevisionHash = (
    revisions: readonly (readonly [string, unknown])[],
): string => hash('md5', JSON.stringify(revisions))

/**
 * A revision is a projection of data that can actually affect the screen.
 * It deliberately contains no continuously changing clock value.
 */
export const getDayRevision = (now: DateTime): string => {
    const date = now.toISODate()
    if (date === null) throw new RangeError('Cannot revise an invalid date')
    return date
}

export const getNotesRevision = (notes: readonly Note[]) => {
    return notes.map(({ text, done }) => ({ text, done: done === true }))
}

export const getEventsRevision = (
    events: readonly Event[],
    now: DateTime,
) => {
    return selectEventsForScreen(events, now).map((event) => ({
        text: event.text,
        start: event.start.toMillis(),
        end: event.end?.toMillis() ?? null,
        state: getEventState(event, now),
    }))
}

export const getDeadlinesRevision = (
    deadlines: readonly Deadline[],
) => {
    return selectDeadlinesForScreen(deadlines).map((deadline) => ({
        text: deadline.text,
        date: deadline.date.toMillis(),
        important: deadline.important === true,
    }))
}
