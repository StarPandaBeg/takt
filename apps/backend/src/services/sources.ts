import type { Deadline, Event, Note } from '@takt/templates'
import { hash } from 'crypto'
import { DateTime } from 'luxon'
import * as notesRepository from '../repository/notes.js'
import { convert } from './notes.js'
import * as versions from './version.js'

interface DataSource<T> {
    load: () => Promise<T>
    getVersion: () => Promise<number>
}

type SceneContextSources<T> = {
    [K in keyof T]: DataSource<T[K]>
}

const events: Event[] = [
    {
        start: DateTime.fromISO('2026-10-24T17:00:34.123'),
        text: 'Событие 1',
    },
    {
        start: DateTime.fromISO('2026-10-24T17:20:34.123'),
        text: 'Событие 2',
    },
    {
        start: DateTime.fromISO('2026-10-24T17:00:34.123'),
        end: DateTime.fromISO('2026-10-24T17:30:34.123'),
        text: 'Событие 3',
    },
    {
        start: DateTime.fromISO('2025-10-24T17:50:34.123'),
        end: DateTime.fromISO('2027-10-24T17:55:34.123'),
        text: 'Событие 4',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 5',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 6',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 7',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 8',
    },
]

const deadlines: Deadline[] = [
    {
        date: DateTime.fromISO('2026-10-19T15:50:34.123'),
        text: 'Решить со встречей ВИШ',
        important: true,
    },
    {
        date: DateTime.fromISO('2026-10-19T15:50:34.123'),
        text: 'Решить со встречей ВИШ',
    },
]

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
            return result.map(convert)
        },
        getVersion: () => versions.get('notes'),
    },
    events: {
        load: () => Promise.resolve(events),
        getVersion: () => versions.get('events'),
    },
    deadlines: {
        load: () => Promise.resolve(deadlines),
        getVersion: () => versions.get('deadlines'),
    },
    today: {
        load: () =>
            Promise.resolve(
                DateTime.local({ zone: process.env.DEFAULT_TIMEZONE }),
            ),
        getVersion: () => {
            return Promise.resolve(Math.floor(Date.now() / 60_000))
        },
    },
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
