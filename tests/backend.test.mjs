import { createClient } from '@libsql/client'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { Image } from '@takt/ui/components'
import { DateTime } from 'luxon'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const databaseRoot = mkdtempSync(join(tmpdir(), 'takt-database-'))
process.env.DB_FILE_NAME = `file:${join(databaseRoot, 'test.db')}`
process.env.DEFAULT_TIMEZONE = 'Europe/Moscow'

const databaseClient = createClient({ url: process.env.DB_FILE_NAME })
for (const migration of [
    '../apps/backend/drizzle/20261025112603_real_devos/migration.sql',
    '../apps/backend/drizzle/20261025112701_triggers/migration.sql',
    '../apps/backend/drizzle/20261026072025_breezy_franklin_storm/migration.sql',
    '../apps/backend/drizzle/20261026072829_windy_romulus/migration.sql',
    '../apps/backend/drizzle/20261026073345_wakeful_maximus/migration.sql',
    '../apps/backend/drizzle/20261027074331_free_ego/migration.sql',
    '../apps/backend/drizzle/20261027075110_damp_cannonball/migration.sql',
    '../apps/backend/drizzle/20261027094633_yellow_grim_reaper/migration.sql',
    '../apps/backend/drizzle/20261027103323_parched_kinsey_walden/migration.sql',
]) {
    const sql = readFileSync(new URL(migration, import.meta.url), 'utf8')
    await databaseClient.executeMultiple(
        sql.replaceAll('--> statement-breakpoint', ''),
    )
}
databaseClient.close()

const { buildApp } = await import('../apps/backend/dist/app.js')
const { createNodeEnvironment } =
    await import('../apps/backend/dist/render-environment.js')
const { ScreenChangeService } =
    await import('../apps/backend/dist/services/screen-changes.js')
const { sources } = await import('../apps/backend/dist/services/sources.js')
const { getEvent } =
    await import('../apps/backend/dist/mcp/tools/events/get-event.tool.js')
const { getEvents } =
    await import('../apps/backend/dist/mcp/tools/events/get-events.tool.js')
const { searchEvents } =
    await import('../apps/backend/dist/mcp/tools/events/search-events.tool.js')
const { updateEventTool } =
    await import('../apps/backend/dist/mcp/tools/events/update-event.tool.js')
const { cancelEventTool } =
    await import('../apps/backend/dist/mcp/tools/events/cancel-event.tool.js')
const { createDeadline } =
    await import('../apps/backend/dist/mcp/tools/create-deadline.tool.js')
const { getDeadline } =
    await import('../apps/backend/dist/mcp/tools/get-deadline.tool.js')
const { getDeadlines } =
    await import('../apps/backend/dist/mcp/tools/get-deadlines.tool.js')
const { searchDeadlines } =
    await import('../apps/backend/dist/mcp/tools/search-deadlines.tool.js')
const { updateDeadlineTool } =
    await import('../apps/backend/dist/mcp/tools/update-deadline.tool.js')
const { cancelDeadlineTool } =
    await import('../apps/backend/dist/mcp/tools/cancel-deadline.tool.js')
const { setDeadlineCompletion } =
    await import(
        '../apps/backend/dist/mcp/tools/set-deadline-completion.tool.js'
    )

test.after(() => {
    rmSync(databaseRoot, { recursive: true, force: true })
})

test('backend serves the rendered frame as PNG', async () => {
    const app = buildApp({ logger: false })

    try {
        const response = await app.inject({
            method: 'GET',
            url: '/screens/splash/png',
        })
        const png = response.rawPayload

        assert.equal(response.statusCode, 200)
        assert.equal(response.headers['content-type'], 'image/png')
        assert.equal(response.headers['cache-control'], 'no-store')
        assert.deepEqual(
            [...png.subarray(0, 8)],
            [137, 80, 78, 71, 13, 10, 26, 10],
        )
        assert.equal(png.readUInt32BE(16), 800)
        assert.equal(png.readUInt32BE(20), 480)
        const image = await loadImage(png)
        assert.deepEqual(
            { width: image.width, height: image.height },
            { width: 800, height: 480 },
        )
        const canvas = createCanvas(image.width, image.height)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(
            0,
            0,
            image.width,
            image.height,
        ).data
        let blackPixels = 0
        for (let index = 0; index < pixels.length; index += 4) {
            if ((pixels[index] ?? 255) < 128) blackPixels += 1
        }
        assert.ok(blackPixels > 0)

        const head = await app.inject({
            method: 'HEAD',
            url: '/screens/splash/png',
        })
        assert.equal(head.statusCode, 200)
        assert.equal(head.rawPayload.byteLength, 0)

        const missing = await app.inject({
            method: 'GET',
            url: '/screens/missing/png',
        })
        assert.equal(missing.statusCode, 404)
    } finally {
        await app.close()
    }
})

test('screen hash is stable and changes with visible source data', async () => {
    const app = buildApp({ logger: false })

    try {
        const first = await app.inject({ method: 'GET', url: '/screens/main' })
        const second = await app.inject({ method: 'GET', url: '/screens/main' })
        assert.equal(first.statusCode, 200)
        assert.equal(first.json().hash, second.json().hash)

        const created = await app.inject({
            method: 'POST',
            url: '/api/notes',
            payload: { text: 'revision-visible-note' },
        })
        assert.equal(created.statusCode, 201)

        const changed = await app.inject({
            method: 'GET',
            url: '/screens/main',
        })
        assert.notEqual(changed.json().hash, first.json().hash)
    } finally {
        await app.close()
    }
})

test('screen change service emits initial and changed revisions only', async () => {
    const hashes = new Map([
        ['main', 'main-1'],
        ['splash', 'splash-1'],
    ])
    const changes = []
    const service = new ScreenChangeService({
        names: ['main', 'splash'],
        getHash: async (name) => hashes.get(name),
        pollInterval: 60_000,
    })
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

    const unsubscribe = service.subscribe((change) => changes.push(change))
    await settle()
    assert.deepEqual(changes, [
        { name: 'main', hash: 'main-1' },
        { name: 'splash', hash: 'splash-1' },
    ])

    service.checkNow()
    await settle()
    assert.equal(changes.length, 2)

    hashes.set('main', 'main-2')
    service.checkNow()
    await settle()
    assert.deepEqual(changes.at(-1), { name: 'main', hash: 'main-2' })

    unsubscribe()
    service.close()
})

test('deadline API stores an iCalendar-compatible recurrence rule', async () => {
    const app = buildApp({ logger: false })

    try {
        const created = await app.inject({
            method: 'POST',
            url: '/api/deadlines',
            payload: {
                title: 'Recurring deadline',
                due: '2026-10-20T09:00:00+03:00',
                timezone: 'Europe/Moscow',
                recurrence: {
                    frequency: 'weekly',
                    weekdays: ['MO', 'WE', 'FR'],
                    interval: 2,
                    count: 12,
                },
            },
        })
        assert.equal(created.statusCode, 201, created.body)
        const id = created.json().id

        const list = await app.inject({
            method: 'GET',
            url: '/api/deadlines?from=2026-10-26T00:00:00%2B03:00',
        })
        assert.ok(list.json().some((deadline) => deadline.id === id))

        let response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${id}`,
        })
        assert.deepEqual(response.json().recurrence, {
            frequency: 'weekly',
            weekdays: ['MO', 'WE', 'FR'],
            interval: 2,
            count: 12,
        })

        const recurrenceId = '2026-10-21T06:00:00.000Z'
        const occurrenceUrl = `/api/deadlines/${id}/occurrences/${encodeURIComponent(recurrenceId)}`
        response = await app.inject({
            method: 'PUT',
            url: occurrenceUrl,
            payload: { status: 'cancelled' },
        })
        assert.equal(response.statusCode, 204, response.body)

        response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${id}`,
        })
        assert.deepEqual(response.json().exceptions, [
            { recurrenceId, status: 'cancelled' },
        ])

        response = await app.inject({
            method: 'PUT',
            url: occurrenceUrl,
            payload: {
                status: 'rescheduled',
                due: '2026-10-22T11:30:00+03:00',
            },
        })
        assert.equal(response.statusCode, 204, response.body)
        response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${id}`,
        })
        assert.deepEqual(response.json().exceptions, [
            {
                recurrenceId,
                status: 'rescheduled',
                due: '2026-10-22T08:30:00.000Z',
            },
        ])

        response = await app.inject({
            method: 'DELETE',
            url: occurrenceUrl,
        })
        assert.equal(response.statusCode, 204)
        response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${id}`,
        })
        assert.deepEqual(response.json().exceptions, [])

        response = await app.inject({
            method: 'PUT',
            url: occurrenceUrl,
            payload: { status: 'cancelled' },
        })
        assert.equal(response.statusCode, 204)

        response = await app.inject({
            method: 'PUT',
            url: `/api/deadlines/${id}`,
            payload: { recurrence: null },
        })
        assert.equal(response.statusCode, 200)
        response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${id}`,
        })
        assert.equal(response.json().recurrence, null)
        assert.deepEqual(response.json().exceptions, [])

        await app.inject({ method: 'DELETE', url: `/api/deadlines/${id}` })
    } finally {
        await app.close()
    }
})

test('MCP deadline tools cover create, read, search, update, completion, and cancellation', async () => {
    const created = await createDeadline({
        title: 'Quarterly report',
        description: 'Prepare figures',
        due: '2026-11-16T18:00:00+03:00',
        dueIsDate: false,
        timezone: 'Europe/Moscow',
        recurrence: { frequency: 'daily', count: 4 },
    })
    const id = created.structuredContent.id

    let master = await getDeadline({ id })
    assert.equal(master.structuredContent.title, 'Quarterly report')
    assert.equal(master.structuredContent.cancelledAt, null)
    assert.deepEqual(master.structuredContent.recurrence, {
        frequency: 'daily',
        count: 4,
    })

    let found = await searchDeadlines({
        query: 'quarterly',
        withCompleted: false,
    })
    assert.equal(found.structuredContent.length, 1)
    assert.equal(found.structuredContent[0].id, id)

    let occurrences = await getDeadlines({
        from: '2026-11-16T00:00:00+03:00',
        limit: 8,
        withCompleted: false,
    })
    let ownOccurrences = occurrences.structuredContent.filter(
        (deadline) => deadline.id === id,
    )
    assert.equal(ownOccurrences.length, 4)
    assert.equal(
        ownOccurrences[1].recurrenceId,
        '2026-11-17T15:00:00.000Z',
    )

    await updateDeadlineTool({
        id,
        scope: 'occurrence',
        recurrenceId: '2026-11-17T15:00:00.000Z',
        changes: {
            title: 'Submit revised report',
            due: '2026-11-17T20:00:00+03:00',
            dueIsDate: true,
        },
    })
    master = await getDeadline({ id })
    assert.deepEqual(master.structuredContent.exceptions, [
        {
            recurrenceId: '2026-11-17T15:00:00.000Z',
            status: 'updated',
            title: 'Submit revised report',
            description: 'Prepare figures',
            due: '2026-11-17T17:00:00.000Z',
            dueIsDate: true,
            timezone: 'Europe/Moscow',
            completed: false,
        },
    ])

    await setDeadlineCompletion({
        id,
        scope: 'occurrence',
        recurrenceId: '2026-11-17T15:00:00.000Z',
        completed: true,
    })
    occurrences = await getDeadlines({
        from: '2026-11-17T00:00:00+03:00',
        limit: 8,
        withCompleted: false,
    })
    ownOccurrences = occurrences.structuredContent.filter(
        (deadline) => deadline.id === id,
    )
    assert.equal(
        ownOccurrences.some(
            ({ recurrenceId }) =>
                recurrenceId === '2026-11-17T15:00:00.000Z',
        ),
        false,
    )
    occurrences = await getDeadlines({
        from: '2026-11-17T00:00:00+03:00',
        limit: 8,
        withCompleted: true,
    })
    ownOccurrences = occurrences.structuredContent.filter(
        (deadline) => deadline.id === id,
    )
    assert.equal(
        ownOccurrences.find(
            ({ recurrenceId }) =>
                recurrenceId === '2026-11-17T15:00:00.000Z',
        ).completed,
        true,
    )

    const split = await updateDeadlineTool({
        id,
        scope: 'this_and_future',
        recurrenceId: '2026-11-18T15:00:00.000Z',
        changes: { title: 'Future reports' },
    })
    const futureId = split.structuredContent.id
    assert.notEqual(futureId, id)
    master = await getDeadline({ id })
    assert.deepEqual(master.structuredContent.recurrence, {
        frequency: 'daily',
        count: 2,
    })
    const future = await getDeadline({ id: futureId })
    assert.equal(future.structuredContent.title, 'Future reports')
    assert.deepEqual(future.structuredContent.recurrence, {
        frequency: 'daily',
        count: 2,
    })

    await cancelDeadlineTool({
        id: futureId,
        scope: 'occurrence',
        recurrenceId: '2026-11-18T15:00:00.000Z',
    })
    await cancelDeadlineTool({ id: futureId, scope: 'series' })
    const cancelled = await getDeadline({ id: futureId })
    assert.match(cancelled.structuredContent.cancelledAt, /Z$/)
    found = await searchDeadlines({
        query: 'Future reports',
        withCompleted: true,
    })
    assert.deepEqual(found.structuredContent, [])
    await cancelDeadlineTool({ id, scope: 'series' })
})

test('event API cancels and reschedules one recurring occurrence', async () => {
    const app = buildApp({ logger: false })

    try {
        const created = await app.inject({
            method: 'POST',
            url: '/api/events',
            payload: {
                title: 'Recurring event',
                start: '2026-10-26T10:00:00+03:00',
                end: '2026-10-26T11:00:00+03:00',
                timezone: 'Europe/Moscow',
                recurrence: { frequency: 'daily', count: 3 },
            },
        })
        assert.equal(created.statusCode, 201, created.body)
        const id = created.json().id
        const recurrenceId = '2026-10-27T07:00:00.000Z'
        const occurrenceUrl = `/api/events/${id}/occurrences/${encodeURIComponent(recurrenceId)}`

        let response = await app.inject({
            method: 'PUT',
            url: occurrenceUrl,
            payload: { status: 'cancelled' },
        })
        assert.equal(response.statusCode, 204, response.body)
        response = await app.inject({ method: 'GET', url: `/api/events/${id}` })
        assert.deepEqual(response.json().exceptions, [
            { recurrenceId, status: 'cancelled' },
        ])

        response = await app.inject({
            method: 'PUT',
            url: occurrenceUrl,
            payload: {
                status: 'rescheduled',
                start: '2026-10-27T12:00:00+03:00',
            },
        })
        assert.equal(response.statusCode, 204, response.body)
        response = await app.inject({ method: 'GET', url: `/api/events/${id}` })
        assert.deepEqual(response.json().exceptions, [
            {
                recurrenceId,
                status: 'rescheduled',
                start: '2026-10-27T09:00:00.000Z',
                end: '2026-10-27T10:00:00.000Z',
            },
        ])

        const range = new URLSearchParams({
            from: '2026-10-27T00:00:00+03:00',
            to: '2026-10-28T00:00:00+03:00',
        })
        const expectedOccurrence = {
            id,
            title: 'Recurring event',
            description: null,
            start: '2026-10-27T09:00:00.000Z',
            end: '2026-10-27T10:00:00.000Z',
            timezone: 'Europe/Moscow',
            allDay: false,
            recurrenceId,
        }

        response = await app.inject({
            method: 'GET',
            url: `/api/events/occurrences?${range}`,
        })
        assert.deepEqual(response.json(), [expectedOccurrence])

        response = await app.inject({
            method: 'GET',
            url: `/api/events?${range}`,
        })
        assert.deepEqual(response.json(), [expectedOccurrence])

        const mcpOccurrences = await getEvents({
            start: '2026-10-27T00:00:00+03:00',
            end: '2026-10-28T00:00:00+03:00',
        })
        assert.deepEqual(mcpOccurrences.structuredContent, [expectedOccurrence])

        const mcpMaster = await getEvent({ id })
        assert.deepEqual(mcpMaster.structuredContent.recurrence, {
            frequency: 'daily',
            count: 3,
        })
        assert.deepEqual(mcpMaster.structuredContent.exceptions, [
            {
                recurrenceId,
                status: 'rescheduled',
                start: '2026-10-27T09:00:00.000Z',
                end: '2026-10-27T10:00:00.000Z',
            },
        ])

        const searchResult = await searchEvents({
            from: '2026-10-26T00:00:00+03:00',
            to: '2026-10-27T00:00:00+03:00',
            query: 'recurring',
            limit: 1,
        })
        assert.equal(searchResult.structuredContent.length, 1)
        assert.equal(searchResult.structuredContent[0].id, id)
        assert.equal(
            searchResult.structuredContent[0].start,
            '2026-10-26T07:00:00.000Z',
        )
        assert.deepEqual(searchResult.structuredContent[0].recurrence, {
            frequency: 'daily',
            count: 3,
        })
        assert.deepEqual(
            searchResult.structuredContent[0].exceptions,
            mcpMaster.structuredContent.exceptions,
        )

        response = await app.inject({
            method: 'DELETE',
            url: occurrenceUrl,
        })
        assert.equal(response.statusCode, 204)
        response = await app.inject({ method: 'GET', url: `/api/events/${id}` })
        assert.deepEqual(response.json().exceptions, [])

        await app.inject({ method: 'DELETE', url: `/api/events/${id}` })
    } finally {
        await app.close()
    }
})

test('MCP update_event updates one occurrence and splits this and future', async () => {
    const app = buildApp({ logger: false })

    try {
        const created = await app.inject({
            method: 'POST',
            url: '/api/events',
            payload: {
                title: 'Daily standup',
                description: 'Original description',
                start: '2026-11-02T10:00:00+03:00',
                end: '2026-11-02T11:00:00+03:00',
                timezone: 'Europe/Moscow',
                recurrence: { frequency: 'daily', count: 4 },
            },
        })
        assert.equal(created.statusCode, 201, created.body)
        const id = created.json().id

        let result = await updateEventTool({
            id,
            scope: 'occurrence',
            recurrenceId: '2026-11-03T07:00:00.000Z',
            changes: {
                title: 'Dentist',
                description: null,
                start: '2026-11-03T12:00:00+03:00',
                end: null,
                allDay: true,
                timezone: null,
            },
        })
        assert.deepEqual(result.structuredContent, { id })

        let master = await getEvent({ id })
        assert.deepEqual(master.structuredContent.exceptions, [
            {
                recurrenceId: '2026-11-03T07:00:00.000Z',
                status: 'updated',
                title: 'Dentist',
                description: null,
                start: '2026-11-03T09:00:00.000Z',
                end: null,
                timezone: null,
                allDay: true,
            },
        ])
        const occurrence = await getEvents({
            start: '2026-11-03T00:00:00+03:00',
            end: '2026-11-04T00:00:00+03:00',
        })
        assert.equal(occurrence.structuredContent[0].title, 'Dentist')
        assert.equal(occurrence.structuredContent[0].end, null)

        await updateEventTool({
            id,
            scope: 'occurrence',
            recurrenceId: '2026-11-03T07:00:00.000Z',
            changes: { title: 'Dentist follow-up' },
        })
        const updatedOccurrence = await getEvents({
            start: '2026-11-03T00:00:00+03:00',
            end: '2026-11-04T00:00:00+03:00',
        })
        assert.equal(
            updatedOccurrence.structuredContent[0].title,
            'Dentist follow-up',
        )
        assert.equal(updatedOccurrence.structuredContent[0].end, null)

        result = await updateEventTool({
            id,
            scope: 'this_and_future',
            recurrenceId: '2026-11-04T07:00:00.000Z',
            changes: {
                title: 'Afternoon standup',
                start: '2026-11-04T14:00:00+03:00',
            },
        })
        const futureId = result.structuredContent.id
        assert.notEqual(futureId, id)

        master = await getEvent({ id })
        assert.deepEqual(master.structuredContent.recurrence, {
            frequency: 'daily',
            count: 2,
        })
        assert.equal(master.structuredContent.exceptions.length, 1)

        const future = await getEvent({ id: futureId })
        assert.equal(future.structuredContent.title, 'Afternoon standup')
        assert.equal(future.structuredContent.start, '2026-11-04T11:00:00.000Z')
        assert.equal(future.structuredContent.end, '2026-11-04T12:00:00.000Z')
        assert.deepEqual(future.structuredContent.recurrence, {
            frequency: 'daily',
            count: 2,
        })
        assert.deepEqual(future.structuredContent.exceptions, [])
    } finally {
        await app.close()
    }
})

test('MCP cancel_event cancels one occurrence, this and future, and a series', async () => {
    const app = buildApp({ logger: false })

    try {
        const created = await app.inject({
            method: 'POST',
            url: '/api/events',
            payload: {
                title: 'Cancelable series',
                start: '2026-11-09T10:00:00+03:00',
                end: '2026-11-09T11:00:00+03:00',
                timezone: 'Europe/Moscow',
                recurrence: { frequency: 'daily', count: 4 },
            },
        })
        assert.equal(created.statusCode, 201, created.body)
        const id = created.json().id

        let result = await cancelEventTool({
            id,
            scope: 'occurrence',
            recurrenceId: '2026-11-10T07:00:00.000Z',
        })
        assert.deepEqual(result.structuredContent, { id })
        let master = await getEvent({ id })
        assert.equal(master.structuredContent.cancelledAt, null)
        assert.deepEqual(master.structuredContent.exceptions, [
            {
                recurrenceId: '2026-11-10T07:00:00.000Z',
                status: 'cancelled',
            },
        ])
        let occurrences = await getEvents({
            start: '2026-11-10T00:00:00+03:00',
            end: '2026-11-11T00:00:00+03:00',
        })
        assert.deepEqual(occurrences.structuredContent, [])

        result = await cancelEventTool({
            id,
            scope: 'this_and_future',
            recurrenceId: '2026-11-11T07:00:00.000Z',
        })
        assert.deepEqual(result.structuredContent, { id })
        master = await getEvent({ id })
        assert.deepEqual(master.structuredContent.recurrence, {
            frequency: 'daily',
            count: 2,
        })
        assert.equal(master.structuredContent.exceptions.length, 1)
        occurrences = await getEvents({
            start: '2026-11-11T00:00:00+03:00',
            end: '2026-11-14T00:00:00+03:00',
        })
        assert.deepEqual(occurrences.structuredContent, [])

        result = await cancelEventTool({ id, scope: 'series' })
        assert.deepEqual(result.structuredContent, { id })
        master = await getEvent({ id })
        assert.match(master.structuredContent.cancelledAt, /Z$/)
        const found = await searchEvents({ query: 'Cancelable series' })
        assert.deepEqual(found.structuredContent, [])
        occurrences = await getEvents({
            start: '2026-11-09T00:00:00+03:00',
            end: '2026-11-10T00:00:00+03:00',
        })
        assert.deepEqual(occurrences.structuredContent, [])
    } finally {
        await app.close()
    }
})

test('events and deadlines API feeds complete template inputs', async () => {
    const app = buildApp({ logger: false })
    const post = async (url, body) => {
        const response = await app.inject({
            method: 'POST',
            url,
            payload: body,
        })
        assert.equal(response.statusCode, 201, response.body)
        return response.json().id
    }

    try {
        const eventId = await post('/api/events', {
            title: 'Initial event',
            start: '2026-10-25T10:00:00+03:00',
            end: '2026-10-25T11:00:00+03:00',
            timezone: 'Europe/Moscow',
        })
        let response = await app.inject({
            method: 'PUT',
            url: `/api/events/${eventId}`,
            payload: { title: 'Edited event' },
        })
        assert.equal(response.statusCode, 200)
        response = await app.inject({
            method: 'GET',
            url: `/api/events/${eventId}`,
        })
        assert.equal(response.json().title, 'Edited event')
        response = await app.inject({
            method: 'DELETE',
            url: `/api/events/${eventId}`,
        })
        assert.equal(response.statusCode, 204)

        const deadlineId = await post('/api/deadlines', {
            title: 'Initial deadline',
            due: '2026-10-28T12:00:00+03:00',
        })
        response = await app.inject({
            method: 'POST',
            url: `/api/deadlines/${deadlineId}/markDone`,
        })
        assert.equal(response.statusCode, 204)
        response = await app.inject({ method: 'GET', url: '/api/deadlines' })
        assert.equal(response.json().length, 0)
        response = await app.inject({
            method: 'GET',
            url: '/api/deadlines?withCompleted=true',
        })
        assert.equal(response.json()[0].completed, true)
        await app.inject({
            method: 'POST',
            url: `/api/deadlines/${deadlineId}/markUndone`,
        })
        await app.inject({
            method: 'PUT',
            url: `/api/deadlines/${deadlineId}`,
            payload: { title: 'Edited deadline' },
        })
        response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${deadlineId}`,
        })
        assert.equal(response.json().title, 'Edited deadline')
        await app.inject({
            method: 'DELETE',
            url: `/api/deadlines/${deadlineId}`,
        })

        const now = DateTime.now().setZone('Europe/Moscow')
        for (let hour = 0; hour < 10; hour += 1) {
            await post('/api/events', {
                title: `today-${hour}`,
                start: now.startOf('day').plus({ hours: hour }).toISO(),
                timezone: 'Europe/Moscow',
            })
        }
        await post('/api/events', {
            title: 'tomorrow',
            start: now.plus({ days: 1 }).startOf('day').toISO(),
        })
        const screenEvents = await sources.events.load()
        assert.equal(screenEvents.length, 10)
        assert.ok(screenEvents.every(({ start }) => start.hasSame(now, 'day')))

        for (const days of [-1, 0, 2, 3, 4, 5]) {
            await post('/api/deadlines', {
                title: `deadline-${days}`,
                due: now.plus({ days }).toISO(),
            })
        }
        await post('/api/deadlines', {
            title: 'completed-deadline',
            due: now.plus({ days: 1 }).toISO(),
            completed: true,
        })
        const screenDeadlines = await sources.deadlines.load()
        assert.deepEqual(
            screenDeadlines.map(({ text, important }) => ({ text, important })),
            [
                { text: 'deadline-0', important: true },
                { text: 'deadline-2', important: true },
                { text: 'deadline-3', important: true },
                { text: 'deadline-4', important: false },
                { text: 'deadline-5', important: false },
            ],
        )
    } finally {
        await app.close()
    }
})

test('Node Canvas measures and rasterizes the same text geometry', () => {
    const environment = createNodeEnvironment()
    const style = {
        fontSize: 19,
        fontFamily: 'Arial',
        fontWeight: 600,
        italic: true,
        underline: true,
        strikethrough: true,
        lineHeight: 1.2,
        metrics: 'font',
    }

    const measured = environment.measureText('Takt ритм', style)
    const bitmap = environment.rasterizeText('Takt ритм', style)

    assert.deepEqual({ width: bitmap.width, height: bitmap.height }, measured)
    assert.equal(bitmap.buffer.length, bitmap.width * bitmap.height)
})

test('Node Canvas includes strikethrough in measured text bitmap', () => {
    const environment = createNodeEnvironment()
    const baseStyle = {
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 400,
        italic: false,
        underline: false,
        lineHeight: 1.2,
        metrics: 'tight',
    }
    const plain = environment.rasterizeText('Takt Takt', {
        ...baseStyle,
        strikethrough: false,
    })
    const struckStyle = { ...baseStyle, strikethrough: true }
    const struck = environment.rasterizeText('Takt Takt', struckStyle)

    assert.deepEqual(
        { width: struck.width, height: struck.height },
        environment.measureText('Takt Takt', struckStyle),
    )
    const alphaSum = (bitmap) =>
        bitmap.buffer.reduce((sum, alpha) => sum + alpha, 0)
    assert.ok(alphaSum(struck) > alphaSum(plain))
})

test('Node Canvas uses stable vertical metrics for equal text styles', () => {
    const environment = createNodeEnvironment()
    const style = {
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 400,
        italic: false,
        underline: false,
        strikethrough: false,
        lineHeight: 1.2,
        metrics: 'font',
    }

    const values = ['Р', 'Д', 'g', 'Текст', 'руду']
    const measurements = values.map((value) =>
        environment.measureText(value, style),
    )
    const bitmaps = values.map((value) =>
        environment.rasterizeText(value, style),
    )

    assert.equal(new Set(measurements.map(({ height }) => height)).size, 1)
    assert.equal(new Set(bitmaps.map(({ height }) => height)).size, 1)
    for (let index = 0; index < values.length; index += 1) {
        assert.deepEqual(
            {
                width: bitmaps[index]?.width,
                height: bitmaps[index]?.height,
            },
            measurements[index],
        )
    }
})

test('Node Canvas supports stable font and compact tight metrics', () => {
    const environment = createNodeEnvironment()
    const values = ['24', 'суббота', 'руду', 'ÁÉḍ']
    const baseStyle = {
        fontSize: 32,
        fontFamily: 'Arial',
        fontWeight: 400,
        italic: false,
        underline: false,
        strikethrough: false,
        lineHeight: 1.2,
    }

    const renderMode = (metrics) =>
        values.map((value) => {
            const style = { ...baseStyle, metrics }
            const measured = environment.measureText(value, style)
            const bitmap = environment.rasterizeText(value, style)

            assert.deepEqual(
                { width: bitmap.width, height: bitmap.height },
                measured,
            )
            assert.equal(bitmap.buffer.length, bitmap.width * bitmap.height)

            return { measured, bitmap }
        })

    const font = renderMode('font')
    const tight = renderMode('tight')

    assert.equal(new Set(font.map(({ measured }) => measured.height)).size, 1)
    assert.ok(
        tight.every(
            ({ measured }, index) =>
                measured.height <= (font[index]?.measured.height ?? 0),
        ),
    )
    assert.ok(
        tight.some(
            ({ measured }, index) =>
                measured.height < (font[index]?.measured.height ?? 0),
        ),
    )

    const alphaSum = (bitmap) =>
        bitmap.buffer.reduce((sum, alpha) => sum + alpha, 0)
    for (let index = 0; index < values.length; index += 1) {
        assert.equal(
            alphaSum(font[index].bitmap),
            alphaSum(tight[index].bitmap),
        )
    }

    for (const metrics of ['font', 'tight']) {
        const style = { ...baseStyle, metrics }
        const measured = environment.measureText('', style)
        const bitmap = environment.rasterizeText('', style)

        assert.deepEqual(
            { width: bitmap.width, height: bitmap.height },
            measured,
        )
        assert.equal(bitmap.buffer.length, 0)
    }
})

test('Node environment decodes and caches local raster images', async () => {
    const assetRoot = mkdtempSync(join(tmpdir(), 'takt-images-'))

    try {
        const makeEncoded = (width, height, format) => {
            const canvas = createCanvas(width, height)
            const context = canvas.getContext('2d')
            context.fillStyle = '#fff'
            context.fillRect(0, 0, width, height)
            context.fillStyle = '#000'
            context.fillRect(0, 0, 1, height)
            return canvas.encodeSync(format)
        }
        writeFileSync(join(assetRoot, 'source.png'), makeEncoded(2, 1, 'png'))
        writeFileSync(join(assetRoot, 'source.jpg'), makeEncoded(3, 2, 'jpeg'))
        writeFileSync(join(assetRoot, 'source.webp'), makeEncoded(4, 3, 'webp'))

        const environment = createNodeEnvironment({
            assetRoot,
            imageCacheSize: 4,
        })
        await environment.preloadImages([
            Image({ src: 'source.png' }),
            Image({ src: 'source.jpg' }),
            Image({ src: 'source.webp' }),
        ])
        const first = environment.loadImage('source.png')
        const cached = environment.loadImage('source.png')
        const importedSource = new URL(
            './source.png',
            pathToFileURL(join(assetRoot, 'screen.js')),
        ).href

        assert.strictEqual(cached, first)
        assert.strictEqual(environment.loadImage(importedSource), first)
        assert.deepEqual(
            { width: first.width, height: first.height },
            { width: 2, height: 1 },
        )
        assert.equal(first.data.length, 8)
        assert.deepEqual(
            {
                width: environment.loadImage('source.jpg').width,
                height: environment.loadImage('source.jpg').height,
            },
            { width: 3, height: 2 },
        )
        assert.deepEqual(
            {
                width: environment.loadImage('source.webp').width,
                height: environment.loadImage('source.webp').height,
            },
            { width: 4, height: 3 },
        )

        const render = createRenderer(environment)
        const input = {
            viewport: { width: 4, height: 2 },
            content: Image({
                src: importedSource,
                width: 4,
                height: 2,
                fit: 'fill',
                smoothing: false,
                dithering: 'threshold',
            }),
        }
        const renderedFirst = render(input)
        const renderedSecond = render(input)
        assert.deepEqual(renderedSecond, renderedFirst)

        const encodedFrame = await exportPng(renderedFirst)
        const decodedFrame = await loadImage(encodedFrame)
        assert.deepEqual(
            { width: decodedFrame.width, height: decodedFrame.height },
            { width: 4, height: 2 },
        )

        writeFileSync(join(assetRoot, 'source.png'), makeEncoded(3, 1, 'png'))
        await environment.preloadImages(Image({ src: 'source.png' }))
        const changed = environment.loadImage('source.png')
        assert.notStrictEqual(changed, first)
        assert.deepEqual(
            { width: changed.width, height: changed.height },
            { width: 3, height: 1 },
        )

        writeFileSync(join(assetRoot, 'invalid.png'), 'not an image')
        await assert.rejects(
            environment.preloadImages(Image({ src: 'missing.png' })),
            /missing\.png.*resolved to/,
        )
        await assert.rejects(
            environment.preloadImages(Image({ src: 'invalid.png' })),
            /invalid\.png.*resolved to|invalid\.png.*decode/,
        )
        await assert.rejects(
            environment.preloadImages(
                Image({ src: 'https://example.com/image.png' }),
            ),
            /only supports local images/,
        )

        const smallCache = createNodeEnvironment({
            assetRoot,
            imageCacheSize: 1,
        })
        await smallCache.preloadImages(Image({ src: 'source.png' }))
        const beforeEviction = smallCache.loadImage('source.png')
        await smallCache.preloadImages(Image({ src: 'source.jpg' }))
        await smallCache.preloadImages(Image({ src: 'source.png' }))
        assert.notStrictEqual(
            smallCache.loadImage('source.png'),
            beforeEviction,
        )
    } finally {
        rmSync(assetRoot, { recursive: true, force: true })
    }
})
