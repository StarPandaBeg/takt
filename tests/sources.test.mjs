import { DateTime } from 'luxon'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
    convertDeadline,
    selectDeadlinesForScreen,
} from '../apps/backend/dist/services/deadlines.js'
import { selectEventsForScreen } from '../apps/backend/dist/services/events.js'

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
        ).map(({ text }) => text),
        events.slice(0, 8).map(({ text }) => text),
    )
    assert.deepEqual(
        selectEventsForScreen(
            events,
            DateTime.fromISO('2026-10-25T06:30', {
                zone: 'Europe/Moscow',
            }),
        ).map(({ text }) => text),
        events.slice(4).map(({ text }) => text),
    )
    assert.deepEqual(
        selectEventsForScreen(
            events,
            DateTime.fromISO('2026-10-25T23:00', {
                zone: 'Europe/Moscow',
            }),
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
