import { DateTime } from 'luxon'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
    selectDeadlinesForScreen,
    selectEventsForScreen,
} from '@takt/templates'
import {
    convertDeadline,
    getUpcomingDeadlineOccurrences,
} from '../apps/backend/dist/services/deadlines.js'
import { getEventOccurrences } from '../apps/backend/dist/services/events.js'
import {
    getDayRevision,
    getDeadlinesRevision,
    getEventsRevision,
} from '../apps/backend/dist/services/screen-revision.js'
import {
    getRecurrenceOccurrences,
    parseRecurrence,
    serializeRecurrence,
} from '../apps/backend/dist/services/recurrence.js'

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

test('recurrence rules use canonical iCalendar RRULE values', () => {
    const rules = [
        [{ frequency: 'daily' }, 'FREQ=DAILY'],
        [
            {
                frequency: 'weekly',
                weekdays: ['MO', 'WE', 'FR'],
                interval: 2,
            },
            'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR',
        ],
        [
            { frequency: 'monthly-date', day: 15 },
            'FREQ=MONTHLY;BYMONTHDAY=15',
        ],
        [
            {
                frequency: 'monthly-weekday',
                weekday: 'FR',
                occurrence: -1,
            },
            'FREQ=MONTHLY;BYDAY=-1FR',
        ],
        [
            { frequency: 'yearly', count: 3 },
            'FREQ=YEARLY;COUNT=3',
        ],
    ]

    for (const [rule, serialized] of rules) {
        assert.equal(serializeRecurrence(rule), serialized)
        assert.deepEqual(parseRecurrence(serialized), rule)
    }
})

test('recurrence expansion handles all supported calendar patterns', () => {
    const zone = 'Europe/Moscow'
    const dates = (start, rule, from = start, limit = 4) =>
        getRecurrenceOccurrences(
            DateTime.fromISO(start, { zone }),
            rule,
            DateTime.fromISO(from, { zone }),
            limit,
        ).map((date) => date.toFormat('yyyy-MM-dd HH:mm'))

    assert.deepEqual(
        dates('2026-10-26T09:00', { frequency: 'daily' }, undefined, 3),
        ['2026-10-26 09:00', '2026-10-27 09:00', '2026-10-28 09:00'],
    )
    assert.deepEqual(
        dates(
            '2026-10-26T09:00',
            { frequency: 'weekly', weekdays: ['MO', 'WE'] },
            undefined,
            4,
        ),
        [
            '2026-10-26 09:00',
            '2026-10-28 09:00',
            '2026-11-02 09:00',
            '2026-11-04 09:00',
        ],
    )
    assert.deepEqual(
        dates(
            '2026-01-31T09:00',
            { frequency: 'monthly-date', day: 31 },
            undefined,
            3,
        ),
        ['2026-01-31 09:00', '2026-03-31 09:00', '2026-05-31 09:00'],
    )
    assert.deepEqual(
        dates(
            '2026-01-30T09:00',
            {
                frequency: 'monthly-weekday',
                weekday: 'FR',
                occurrence: -1,
            },
            undefined,
            3,
        ),
        ['2026-01-30 09:00', '2026-02-27 09:00', '2026-03-27 09:00'],
    )
    assert.deepEqual(
        dates(
            '2024-02-29T09:00',
            { frequency: 'yearly', count: 3 },
            undefined,
            3,
        ),
        ['2024-02-29 09:00', '2028-02-29 09:00', '2032-02-29 09:00'],
    )
})

test('deadline source expands a past recurring master into future occurrences', () => {
    const zone = 'Europe/Moscow'
    const start = DateTime.fromISO('2026-10-20T09:00', { zone })
    const master = {
        id: 1,
        title: 'repeat',
        description: null,
        due: start.toJSDate(),
        dueIsDate: false,
        timezone: zone,
        recurrenceRule: 'FREQ=DAILY;COUNT=10',
        completed: false,
        createdAt: start.toJSDate(),
        updatedAt: start.toJSDate(),
    }

    assert.deepEqual(
        getUpcomingDeadlineOccurrences(
            [master],
            [],
            DateTime.fromISO('2026-10-26T00:00', { zone }),
            3,
        ).map(({ due }) =>
            DateTime.fromJSDate(due).setZone(zone).toFormat('yyyy-MM-dd HH:mm'),
        ),
        ['2026-10-26 09:00', '2026-10-27 09:00', '2026-10-28 09:00'],
    )
})

test('deadline occurrences apply cancellation and rescheduling exceptions', () => {
    const zone = 'Europe/Moscow'
    const start = DateTime.fromISO('2026-10-20T09:00', { zone })
    const master = {
        id: 1,
        title: 'repeat',
        description: null,
        due: start.toJSDate(),
        dueIsDate: false,
        timezone: zone,
        recurrenceRule: 'FREQ=DAILY;COUNT=10',
        completed: false,
        createdAt: start.toJSDate(),
        updatedAt: start.toJSDate(),
    }
    const exceptionBase = {
        deadlineId: master.id,
        createdAt: start.toJSDate(),
        updatedAt: start.toJSDate(),
    }
    const exceptions = [
        {
            ...exceptionBase,
            id: 1,
            recurrenceId: DateTime.fromISO('2026-10-26T09:00', {
                zone,
            }).toJSDate(),
            replacementDue: null,
        },
        {
            ...exceptionBase,
            id: 2,
            recurrenceId: DateTime.fromISO('2026-10-27T09:00', {
                zone,
            }).toJSDate(),
            replacementDue: DateTime.fromISO('2026-10-26T12:00', {
                zone,
            }).toJSDate(),
        },
    ]

    assert.deepEqual(
        getUpcomingDeadlineOccurrences(
            [master],
            exceptions,
            DateTime.fromISO('2026-10-26T00:00', { zone }),
            3,
        ).map(({ due }) =>
            DateTime.fromJSDate(due).setZone(zone).toFormat('yyyy-MM-dd HH:mm'),
        ),
        ['2026-10-26 12:00', '2026-10-28 09:00', '2026-10-29 09:00'],
    )
})

test('event occurrences preserve duration and apply a moved override', () => {
    const zone = 'Europe/Moscow'
    const start = DateTime.fromISO('2026-10-25T23:00', { zone })
    const master = {
        id: 1,
        title: 'night event',
        description: null,
        start: start.toJSDate(),
        end: start.plus({ hours: 2 }).toJSDate(),
        timezone: zone,
        allDay: false,
        recurrenceRule: 'FREQ=DAILY;COUNT=3',
        createdAt: start.toJSDate(),
        updatedAt: start.toJSDate(),
    }
    const movedStart = DateTime.fromISO('2026-10-26T12:00', { zone })
    const exceptions = [
        {
            id: 1,
            eventId: master.id,
            recurrenceId: start.plus({ days: 1 }).toJSDate(),
            replacementStart: movedStart.toJSDate(),
            replacementEnd: movedStart.plus({ hours: 2 }).toJSDate(),
            createdAt: start.toJSDate(),
            updatedAt: start.toJSDate(),
        },
    ]
    const occurrences = getEventOccurrences(
        [master],
        exceptions,
        DateTime.fromISO('2026-10-26T00:00', { zone }),
        DateTime.fromISO('2026-10-27T00:00', { zone }),
    )

    assert.deepEqual(
        occurrences.map(({ start: occurrenceStart, end }) => ({
            start: DateTime.fromJSDate(occurrenceStart)
                .setZone(zone)
                .toFormat('yyyy-MM-dd HH:mm'),
            end:
                end === null
                    ? null
                    : DateTime.fromJSDate(end)
                          .setZone(zone)
                          .toFormat('yyyy-MM-dd HH:mm'),
        })),
        [
            { start: '2026-10-25 23:00', end: '2026-10-26 01:00' },
            { start: '2026-10-26 12:00', end: '2026-10-26 14:00' },
        ],
    )
})
