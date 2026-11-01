import * as deadlineExceptionsRepository from '#src/repository/deadline-recurrence-exceptions.js'
import * as deadlineCompletionsRepository from '#src/repository/deadline-completions.js'
import * as deadlinesRepository from '#src/repository/deadlines.js'
import * as notesRepository from '#src/repository/notes.js'
import type { Deadline, Event, Note } from '@takt/templates'
import { DateTime } from 'luxon'
import {
    convertDeadline,
    getVisibleDeadlineOccurrencesForScreen,
} from './deadlines.js'
import { convertEvent } from './event-occurrences.js'
import { getResolvedEvents } from './events.js'
import { convert as convertNote } from './notes.js'
import {
    createScreenRevisionHash,
    getDayRevision,
    getDeadlinesRevision,
    getEventsRevision,
    getNotesRevision,
} from './screen-revision.js'
import { getApplicationTime } from './settings.js'

interface DataSource<T> {
    load: () => Promise<T>
    /**
     * Returns only the state whose change should make a device refresh.
     * A volatile source may omit it while still participating in rendering.
     */
    revision?: () => Promise<unknown>
}

type SceneContextSources<T> = {
    [K in keyof T]: DataSource<T[K]>
}

interface DataSources {
    notes: DataSource<Note[]>
    events: DataSource<Event[]>
    deadlines: DataSource<Deadline[]>
    today: DataSource<DateTime>
}

async function loadNotes(): Promise<Note[]> {
    const result = await notesRepository.getFiltered({ limit: 32 })
    return result.map(convertNote)
}

async function loadEvents(now: DateTime): Promise<Event[]> {
    const from = now.startOf('day')
    const to = now.plus({ days: 1 }).startOf('day')
    const timezone = now.zoneName
    if (timezone === null) throw new RangeError('Current time has no timezone')
    return (await getResolvedEvents({ from, to })).map((event) =>
        convertEvent(event, timezone),
    )
}

async function loadDeadlines(now: DateTime): Promise<Deadline[]> {
    const from = now.startOf('day')
    const masters = await deadlinesRepository.getScheduleCandidates(
        from.toJSDate(),
    )
    const exceptions = await deadlineExceptionsRepository.getForDeadlineIds(
        masters.map(({ id }) => id),
    )
    const completions = await deadlineCompletionsRepository.getForDeadlineIds(
        masters.map(({ id }) => id),
    )
    return getVisibleDeadlineOccurrencesForScreen(
        masters,
        exceptions,
        completions,
        now,
        32,
    ).map((deadline) => convertDeadline(deadline, now))
}

export const sources: DataSources = {
    notes: {
        load: loadNotes,
        revision: async () => getNotesRevision(await loadNotes()),
    },
    events: {
        load: async () => loadEvents(await currentTime()),
        revision: async () => {
            const now = await currentTime()
            return getEventsRevision(await loadEvents(now), now)
        },
    },
    deadlines: {
        load: async () => loadDeadlines(await currentTime()),
        revision: async () => {
            const now = await currentTime()
            return getDeadlinesRevision(await loadDeadlines(now))
        },
    },
    today: {
        load: currentTime,
        revision: async () => {
            const now = await currentTime()
            return [now.zoneName, getDayRevision(now)]
        },
    },
}

function currentTime(): Promise<DateTime> {
    return getApplicationTime()
}

export function defineSceneContext<T extends object | void>(
    sources: SceneContextSources<T>,
) {
    const entries = Object.entries(sources) as [
        keyof T,
        DataSource<T[keyof T]>,
    ][]

    return {
        async key(): Promise<string> {
            const revisions = await Promise.all(
                entries.map(async ([name, source]) =>
                    source.revision === undefined
                        ? null
                        : [name, await source.revision()],
                ),
            )
            return createScreenRevisionHash(
                revisions.filter(
                    (entry): entry is [string, unknown] => entry !== null,
                ),
            )
        },

        async context(): Promise<T> {
            const values = await Promise.all(
                entries.map(async ([name, source]) => [
                    name,
                    await source.load(),
                ]),
            )
            return Object.fromEntries(values) as T
        },
    }
}
