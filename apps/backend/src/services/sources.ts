import type { Deadline, Event, Note } from '@takt/templates'
import { hash } from 'crypto'
import { DateTime } from 'luxon'
import * as deadlinesRepository from '../repository/deadlines.js'
import * as eventsRepository from '../repository/events.js'
import * as notesRepository from '../repository/notes.js'
import { convertDeadline, selectDeadlinesForScreen } from './deadlines.js'
import { convertEvent, selectEventsForScreen } from './events.js'
import { convert as convertNote } from './notes.js'
import * as versions from './version.js'

interface DataSource<T> {
    load: () => Promise<T>
    getVersion: () => Promise<number>
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

export const sources: DataSources = {
    notes: {
        load: async () => {
            const result = await notesRepository.getFiltered({ limit: 8 })
            return result.map(convertNote)
        },
        getVersion: () => versions.get('notes'),
    },
    events: {
        load: async () => {
            const now = currentTime()
            const result = await eventsRepository.getOverlapping(
                now.startOf('day').toJSDate(),
                now.plus({ days: 1 }).startOf('day').toJSDate(),
            )
            return selectEventsForScreen(result.map(convertEvent), now)
        },
        getVersion: () => versions.get('events'),
    },
    deadlines: {
        load: async () => {
            const now = currentTime()
            const result = await deadlinesRepository.getFiltered({
                from: now.startOf('day').toJSDate(),
                limit: 4,
                withCompleted: false,
            })
            return selectDeadlinesForScreen(
                result.map((deadline) => convertDeadline(deadline, now)),
            )
        },
        getVersion: () => versions.get('deadlines'),
    },
    today: {
        load: () => Promise.resolve(currentTime()),
        getVersion: () => {
            return Promise.resolve(Math.floor(Date.now() / 60_000))
        },
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
            const versions = await Promise.all(
                entries.map(async ([name, source]) => [
                    name,
                    await source.getVersion(),
                ]),
            )
            return hash('md5', JSON.stringify(versions))
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
