import { DateTime } from 'luxon'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
    selectDeadlinesForScreen,
    selectEventsForScreen,
} from '@takt/templates'
import {
    convertDeadline,
} from '../apps/backend/dist/services/deadlines.js'
import {
    getDayRevision,
    getDeadlinesRevision,
    getEventsRevision,
} from '../apps/backend/dist/services/screen-revision.js'

function event(hour) {
    return {
        text: `event-${hour}`,
        start: DateTime.fromISO(
            `2026-10-25T${String(hour).padStart(2, '0')}:00`,
            {
                zone: 'Europe/Moscow',
            },
        ),
    }
}

test('event selection keeps at most eight entries around the current time', () => {
    const events = Array.from({ length: 12 }, (_, hour) => event(hour))

    assert.deepEqual(
        selectEventsForScreen(
            events,
            DateTime.fromISO('2026-10-25T00:00', {
                zone: 'Europe/Moscow',
            }),
            8,
        ).map(({ text }) => text),
        events.slice(0, 8).map(({ text }) => text),
    )
    assert.deepEqual(
        selectEventsForScreen(
            events,
            DateTime.fromISO('2026-10-25T06:30', {
                zone: 'Europe/Moscow',
            }),
            8,
        ).map(({ text }) => text),
        events.slice(4).map(({ text }) => text),
    )
    assert.deepEqual(
        selectEventsForScreen(
            events,
            DateTime.fromISO('2026-10-25T23:00', {
                zone: 'Europe/Moscow',
            }),
            8,
        ).map(({ text }) => text),
        events.slice(4).map(({ text }) => text),
    )
})

test('deadline selection keeps four nearest entries and marks three days', () => {
    const now = DateTime.fromISO('2026-10-25T12:00', {
        zone: 'Europe/Moscow',
    })
    const records = [5, 0, 2, 4, 1].map((days, index) => ({
        id: index + 1,
        title: `deadline-${days}`,
        description: null,
        due: now.plus({ days }).toJSDate(),
        dueIsDate: false,
        completed: false,
        createdAt: now.toJSDate(),
        updatedAt: now.toJSDate(),
    }))
    const selected = selectDeadlinesForScreen(
        records.map((record) => convertDeadline(record, now)),
        4,
    )

    assert.deepEqual(
        selected.map(({ text, important }) => ({ text, important })),
        [
            { text: 'deadline-0', important: true },
            { text: 'deadline-1', important: true },
            { text: 'deadline-2', important: true },
            { text: 'deadline-4', important: false },
        ],
    )
})

test('screen selection validates limits', () => {
    assert.throws(
        () => selectEventsForScreen([], DateTime.now(), -1),
        RangeError,
    )
    assert.throws(() => selectDeadlinesForScreen([], 1.5), RangeError)
})

test('day revision ignores clock minutes and changes at the day boundary', () => {
    const morning = DateTime.fromISO('2026-10-25T08:01', {
        zone: 'Europe/Moscow',
    })

    assert.equal(
        getDayRevision(morning),
        getDayRevision(morning.set({ hour: 23, minute: 59 })),
    )
    assert.notEqual(
        getDayRevision(morning),
        getDayRevision(morning.plus({ days: 1 })),
    )
})

test('event revision changes only at visible event state boundaries', () => {
    const start = DateTime.fromISO('2026-10-25T10:00', {
        zone: 'Europe/Moscow',
    })
    const events = [{ text: 'meeting', start }]
    const revisionAt = (time) =>
        getEventsRevision(events, DateTime.fromISO(time, { zone: start.zone }))

    assert.deepEqual(
        revisionAt('2026-10-25T09:30'),
        revisionAt('2026-10-25T09:44'),
    )
    assert.notDeepEqual(
        revisionAt('2026-10-25T09:44'),
        revisionAt('2026-10-25T09:45'),
    )
    assert.deepEqual(
        revisionAt('2026-10-25T09:45'),
        revisionAt('2026-10-25T10:14'),
    )
    assert.notDeepEqual(
        revisionAt('2026-10-25T10:14'),
        revisionAt('2026-10-25T10:15'),
    )
})

test('event revision includes changes outside the visible eight entries', () => {
    const now = DateTime.fromISO('2026-10-25T06:00', {
        zone: 'Europe/Moscow',
    })
    const events = Array.from({ length: 9 }, (_, index) => ({
        text: `event-${index}`,
        start: now.plus({ hours: index + 1 }),
    }))
    const hiddenChanged = events.map((item, index) =>
        index === 8 ? { ...item, text: 'changed outside screen' } : item,
    )
    const visibleChanged = events.map((item, index) =>
        index === 7 ? { ...item, text: 'changed on screen' } : item,
    )

    assert.notDeepEqual(
        getEventsRevision(events, now),
        getEventsRevision(hiddenChanged, now),
    )
    assert.notDeepEqual(
        getEventsRevision(events, now),
        getEventsRevision(visibleChanged, now),
    )
})

test('deadline revision changes when a deadline becomes important', () => {
    const due = DateTime.fromISO('2026-10-28T12:00', {
        zone: 'Europe/Moscow',
    })
    const record = {
        id: 1,
        title: 'deadline',
        description: null,
        due: due.toJSDate(),
        dueIsDate: false,
        completed: false,
        createdAt: due.toJSDate(),
        updatedAt: due.toJSDate(),
    }
    const before = due.minus({ days: 3, milliseconds: 1 })
    const boundary = due.minus({ days: 3 })

    assert.notDeepEqual(
        getDeadlinesRevision([convertDeadline(record, before)]),
        getDeadlinesRevision([convertDeadline(record, boundary)]),
    )
})
