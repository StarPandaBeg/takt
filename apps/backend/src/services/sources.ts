import type { Deadline, Event, Note } from '@takt/templates'
import { DateTime } from 'luxon'
import * as deadlinesRepository from '../repository/deadlines.js'
import * as eventsRepository from '../repository/events.js'
import * as notesRepository from '../repository/notes.js'
import { convertDeadline } from './deadlines.js'
import { convertEvent } from './events.js'
import { convert as convertNote } from './notes.js'
import {
    createScreenRevisionHash,
    getDayRevision,
    getDeadlinesRevision,
    getEventsRevision,
    getNotesRevision,
} from './screen-revision.js'

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
    const result = await eventsRepository.getOverlapping(
        now.startOf('day').toJSDate(),
        now.plus({ days: 1 }).startOf('day').toJSDate(),
    )
    return result.map(convertEvent)
}

async function loadDeadlines(now: DateTime): Promise<Deadline[]> {
    const result = await deadlinesRepository.getFiltered({
        from: now.startOf('day').toJSDate(),
        limit: 32,
        withCompleted: false,
    })
    return result.map((deadline) => convertDeadline(deadline, now))
}

export const sources: DataSources = {
    notes: {
        load: loadNotes,
        revision: async () => getNotesRevision(await loadNotes()),
    },
    events: {
        load: async () => loadEvents(currentTime()),
        revision: async () => {
            const now = currentTime()
            return getEventsRevision(await loadEvents(now), now)
        },
    },
    deadlines: {
        load: async () => loadDeadlines(currentTime()),
        revision: async () => {
            const now = currentTime()
            return getDeadlinesRevision(await loadDeadlines(now))
        },
    },
    today: {
        load: () => Promise.resolve(currentTime()),
        revision: () => Promise.resolve(getDayRevision(currentTime())),
    },
}

function currentTime(): DateTime {
    return DateTime.now().setZone(
        process.env.DEFAULT_TIMEZONE ?? 'Europe/Moscow',
    )
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
