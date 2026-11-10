import { createClient } from '@libsql/client'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { project } from '@takt/templates'
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
    '../apps/backend/drizzle/20261101190606_application_settings/migration.sql',
    '../apps/backend/drizzle/20261109094846_right_madrox/migration.sql',
]) {
    const sql = readFileSync(new URL(migration, import.meta.url), 'utf8')
    await databaseClient.executeMultiple(
        sql.replaceAll('--> statement-breakpoint', ''),
    )
}
databaseClient.close()

const { buildApp: buildBackendApp } =
    await import('../apps/backend/dist/app.js')
const buildApp = (options = {}) =>
    buildBackendApp({ ...options, authToken: false })
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
const { createEvent } =
    await import('../apps/backend/dist/mcp/tools/events/create-event.tool.js')
const { createDeadline } =
    await import('../apps/backend/dist/mcp/tools/deadlines/create-deadline.tool.js')
const { getDeadline } =
    await import('../apps/backend/dist/mcp/tools/deadlines/get-deadline.tool.js')
const { getDeadlines, getDeadlinesInputSchema } =
    await import('../apps/backend/dist/mcp/tools/deadlines/get-deadlines.tool.js')
const { searchDeadlines } =
    await import('../apps/backend/dist/mcp/tools/deadlines/search-deadlines.tool.js')
const { updateDeadlineTool } =
    await import('../apps/backend/dist/mcp/tools/deadlines/update-deadline.tool.js')
const { cancelDeadlineTool } =
    await import('../apps/backend/dist/mcp/tools/deadlines/cancel-deadline.tool.js')
const { setDeadlineCompletion, setDeadlineCompletionInputSchema } =
    await import('../apps/backend/dist/mcp/tools/deadlines/set-deadline-completion.tool.js')
const { createNote } =
    await import('../apps/backend/dist/mcp/tools/notes/create-note.tool.js')
const { getNote } =
    await import('../apps/backend/dist/mcp/tools/notes/get-note.tool.js')
const { listNotes } =
    await import('../apps/backend/dist/mcp/tools/notes/list-notes.tool.js')
const { updateNote } =
    await import('../apps/backend/dist/mcp/tools/notes/update-note.tool.js')
const { deadlineIdSchema, eventIdSchema, noteIdSchema } =
    await import('../apps/backend/dist/mcp/util/ids.js')
const { db: backendDb } = await import('../apps/backend/dist/database/index.js')

const diagnosticRecord = (overrides = {}) => ({
    record_id: 'diagnostic-test-000001',
    sequence: 1,
    type: 'log',
    level: 'INFO',
    source: 'esp_log',
    module: 'wifi',
    message: 'WiFi connected',
    uptime_ms: 1500,
    timestamp_unix_ms: 1794234000000,
    fields: { rssi: -54 },
    ...overrides,
})

const diagnosticBatch = (records, overrides = {}) => ({
    schema_version: 1,
    device_id: 'takt-dev-001',
    firmware_version: '0.3.1',
    git_sha: 'abcdef123',
    boot_id: 'diagnostic-test-boot',
    records,
    ...overrides,
})

const flattenEventGroups = (groups) =>
    groups.flatMap(({ occurrences, ...event }) =>
        occurrences.map((occurrence) => ({ ...event, ...occurrence })),
    )

const flattenDeadlineGroups = (groups) =>
    groups.flatMap(({ occurrences, ...deadline }) =>
        occurrences.map((occurrence) => ({ ...deadline, ...occurrence })),
    )

test.after(() => {
    rmSync(databaseRoot, { recursive: true, force: true })
})

test('MCP entity IDs require the matching lowercase prefix', async () => {
    assert.equal(eventIdSchema.parse('event:123'), 'event:123')
    assert.equal(deadlineIdSchema.parse('deadline:456'), 'deadline:456')
    assert.equal(noteIdSchema.parse('note:789'), 'note:789')

    assert.equal(eventIdSchema.safeParse('deadline:123').success, false)
    assert.equal(deadlineIdSchema.safeParse('note:456').success, false)
    assert.equal(noteIdSchema.safeParse('event:789').success, false)
    assert.equal(eventIdSchema.safeParse('Event:123').success, false)
    assert.equal(eventIdSchema.safeParse('event:0').success, false)

    await assert.rejects(getEvent({ id: 'deadline:123' }))
    await assert.rejects(getDeadline({ id: 'note:456' }))
    await assert.rejects(getNote({ id: 'event:789' }))
})

test('MCP deadline range requires to to be later than from', () => {
    assert.equal(
        getDeadlinesInputSchema.safeParse({
            from: '2026-11-04T00:00:00+03:00',
            to: '2026-11-05T00:00:00+03:00',
        }).success,
        true,
    )
    assert.equal(
        getDeadlinesInputSchema.safeParse({
            from: '2026-11-04T00:00:00+03:00',
            to: '2026-11-03T00:00:00+03:00',
        }).success,
        false,
    )
    assert.equal(
        getDeadlinesInputSchema.safeParse({
            from: '2026-11-04T00:00:00+03:00',
        }).success,
        false,
    )
})

test('backend exposes a health check', async () => {
    const app = buildApp({ logger: false })

    try {
        const response = await app.inject({ method: 'GET', url: '/health' })

        assert.equal(response.statusCode, 200)
        assert.deepEqual(response.json(), { status: 'ok' })
    } finally {
        await app.close()
    }
})

test('application settings expose and update timezone and tutorial state', async () => {
    const app = buildApp({ logger: false })
    try {
        const initial = await app.inject({
            method: 'GET',
            url: '/api/settings',
        })
        assert.equal(initial.statusCode, 200)
        assert.deepEqual(initial.json(), {
            timezone: 'Europe/Moscow',
            tutorial: 0,
        })

        const updated = await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { timezone: 'Asia/Yekaterinburg' },
        })
        assert.equal(updated.statusCode, 200)
        assert.deepEqual(updated.json(), {
            timezone: 'Asia/Yekaterinburg',
            tutorial: 0,
        })

        const tutorialCompleted = await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { tutorial: 1 },
        })
        assert.equal(tutorialCompleted.statusCode, 200)
        assert.deepEqual(tutorialCompleted.json(), {
            timezone: 'Asia/Yekaterinburg',
            tutorial: 1,
        })

        const invalid = await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { timezone: 'Mars/Olympus' },
        })
        assert.equal(invalid.statusCode, 400)

        const invalidTutorial = await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { tutorial: 2 },
        })
        assert.equal(invalidTutorial.statusCode, 400)

        await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { timezone: 'Europe/Moscow', tutorial: 0 },
        })
    } finally {
        await app.close()
    }
})

test('backend requires the configured bearer token', async () => {
    assert.throws(
        () => buildBackendApp({ logger: false, authToken: '' }),
        /AUTH_TOKEN must contain a non-empty bearer token/,
    )
    assert.throws(
        () => buildBackendApp({ logger: false, authToken: 'not valid' }),
        /AUTH_TOKEN must not contain whitespace/,
    )

    const app = buildBackendApp({ logger: false, authToken: 'test-token' })

    try {
        for (const authorization of [
            undefined,
            'Basic test-token',
            'Bearer wrong-token',
        ]) {
            const response = await app.inject({
                method: 'GET',
                url: '/api/notes',
                headers: authorization === undefined ? {} : { authorization },
            })

            assert.equal(response.statusCode, 401)
            assert.equal(response.headers['www-authenticate'], 'Bearer')
            assert.deepEqual(response.json(), { error: 'Unauthorized' })
        }

        const authorized = await app.inject({
            method: 'GET',
            url: '/api/notes',
            headers: { authorization: 'Bearer test-token' },
        })
        assert.equal(authorized.statusCode, 200)

        const health = await app.inject({ method: 'GET', url: '/health' })
        assert.equal(health.statusCode, 200)
    } finally {
        await app.close()
    }
})

test('diagnostics batch accepts records, missing device time, and exposes filters', async () => {
    const app = buildApp({
        logger: false,
        diagnosticsRateLimitPerMinute: false,
    })
    const records = [
        diagnosticRecord(),
        diagnosticRecord({
            record_id: 'diagnostic-test-000002',
            sequence: 2,
            type: 'metric',
            source: 'diagnostics',
            module: 'system',
            message: 'System snapshot',
            uptime_ms: 60_000,
            timestamp_unix_ms: null,
            fields: { free_heap: 180_000 },
        }),
    ]
    try {
        const accepted = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch(records),
        })
        assert.equal(accepted.statusCode, 200, accepted.body)
        assert.equal(accepted.json().accepted, 2)
        assert.equal(accepted.json().duplicates, 0)
        assert.deepEqual(
            accepted.json().acknowledged_ids,
            records.map(({ record_id }) => record_id),
        )

        const listed = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/records?type=metric&module=system&boot_id=diagnostic-test-boot&limit=10',
        })
        assert.equal(listed.statusCode, 200, listed.body)
        assert.equal(listed.headers['x-total-count'], '1')
        assert.equal(listed.json().records.length, 1)
        assert.equal(listed.json().records[0].timestamp_unix_ms, null)
        assert.deepEqual(listed.json().records[0].fields, {
            free_heap: 180_000,
        })
    } finally {
        await app.close()
    }
})

test('diagnostics batch is idempotent for full and partial retries', async () => {
    const app = buildApp({
        logger: false,
        diagnosticsRateLimitPerMinute: false,
    })
    const first = diagnosticRecord({ record_id: 'idempotency-000001' })
    const second = diagnosticRecord({
        record_id: 'idempotency-000002',
        sequence: 2,
    })
    const third = diagnosticRecord({
        record_id: 'idempotency-000003',
        sequence: 3,
    })
    try {
        let response = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch([first, second], {
                boot_id: 'idempotency-boot',
            }),
        })
        assert.deepEqual(
            {
                accepted: response.json().accepted,
                duplicates: response.json().duplicates,
            },
            { accepted: 2, duplicates: 0 },
        )

        response = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch([first, second], {
                boot_id: 'idempotency-boot',
            }),
        })
        assert.deepEqual(
            {
                accepted: response.json().accepted,
                duplicates: response.json().duplicates,
            },
            { accepted: 0, duplicates: 2 },
        )

        response = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch([second, third], {
                boot_id: 'idempotency-boot',
            }),
        })
        assert.deepEqual(
            {
                accepted: response.json().accepted,
                duplicates: response.json().duplicates,
            },
            { accepted: 1, duplicates: 1 },
        )
        assert.deepEqual(response.json().acknowledged_ids, [
            second.record_id,
            third.record_id,
        ])

        const listed = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/records?boot_id=idempotency-boot',
        })
        assert.equal(listed.headers['x-total-count'], '3')
    } finally {
        await app.close()
    }
})

test('diagnostics combines analysis filters, sorting, boot history, and export', async () => {
    const app = buildApp({
        logger: false,
        diagnosticsRateLimitPerMinute: false,
    })
    const bootId = 'analysis-filter-boot'
    const payload = diagnosticBatch(
        [
            diagnosticRecord({
                record_id: 'analysis-filter-000001',
                sequence: 10,
                type: 'event',
                level: 'CRITICAL',
                source: 'panic_handler',
                module: 'system',
                message: 'Core panic detected',
                fields: { event_type: 'crash', cause: 'watchdog' },
            }),
            diagnosticRecord({
                record_id: 'analysis-filter-000002',
                sequence: 11,
                type: 'metric',
                source: 'diagnostics',
                module: 'heap',
                message: 'Heap snapshot',
                fields: {},
            }),
        ],
        { boot_id: bootId, firmware_version: '9.9.9', git_sha: 'feedface' },
    )
    try {
        const accepted = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload,
        })
        assert.equal(accepted.statusCode, 200, accepted.body)

        const filtered = await app.inject({
            method: 'GET',
            url: `/api/diagnostics/records?boot_id=${bootId}&level=CRITICAL&type=event&module=system&source=panic_handler&query=panic&sequence=10&firmware_version=9.9.9&git_sha=feedface&event_type=crash&has_fields=true&sort_by=sequence&sort_direction=asc`,
        })
        assert.equal(filtered.statusCode, 200, filtered.body)
        assert.equal(filtered.headers['x-total-count'], '1')
        assert.equal(
            filtered.json().records[0].record_id,
            'analysis-filter-000001',
        )

        const withoutFields = await app.inject({
            method: 'GET',
            url: `/api/diagnostics/records?boot_id=${bootId}&has_fields=false`,
        })
        assert.equal(withoutFields.headers['x-total-count'], '1')
        assert.equal(
            withoutFields.json().records[0].record_id,
            'analysis-filter-000002',
        )

        const boots = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/boots?limit=200',
        })
        const boot = boots.json().boots.find((item) => item.boot_id === bootId)
        assert.equal(boot.record_count, 2)
        assert.equal(boot.firmware_version, '9.9.9')

        const csv = await app.inject({
            method: 'GET',
            url: `/api/diagnostics/records/export?boot_id=${bootId}&format=csv`,
        })
        assert.equal(csv.statusCode, 200, csv.body)
        assert.match(csv.headers['content-type'], /^text\/csv/)
        assert.match(csv.body, /analysis-filter-000001/)
        assert.match(csv.body, /analysis-filter-000002/)
    } finally {
        await app.close()
    }
})

test('diagnostics deletes all records only after an authorized request', async () => {
    const app = buildBackendApp({
        logger: false,
        authToken: 'admin-token',
        diagnosticsRateLimitPerMinute: false,
    })
    const authorization = { authorization: 'Bearer admin-token' }
    try {
        const unauthorized = await app.inject({
            method: 'DELETE',
            url: '/api/diagnostics/records',
        })
        assert.equal(unauthorized.statusCode, 401)

        const deleted = await app.inject({
            method: 'DELETE',
            url: '/api/diagnostics/records',
            headers: authorization,
        })
        assert.equal(deleted.statusCode, 200, deleted.body)
        assert.equal(deleted.json().ok, true)
        assert.ok(deleted.json().deleted > 0)

        const listed = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/records',
            headers: authorization,
        })
        assert.equal(listed.headers['x-total-count'], '0')
    } finally {
        await app.close()
    }
})

test('diagnostics rejects unauthorized, invalid, and oversized batches', async () => {
    const protectedApp = buildBackendApp({
        logger: false,
        authToken: 'admin-token',
        diagnosticsToken: 'device-token',
        diagnosticsRateLimitPerMinute: false,
    })
    try {
        const unauthorized = await protectedApp.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch([
                diagnosticRecord({ record_id: 'auth-test-000001' }),
            ]),
        })
        assert.equal(unauthorized.statusCode, 401)

        const authorized = await protectedApp.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            headers: { authorization: 'Bearer device-token' },
            payload: diagnosticBatch([
                diagnosticRecord({ record_id: 'auth-test-000001' }),
            ]),
        })
        assert.equal(authorized.statusCode, 200, authorized.body)
    } finally {
        await protectedApp.close()
    }

    const app = buildApp({
        logger: false,
        diagnosticsRateLimitPerMinute: false,
    })
    try {
        const invalid = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch([
                diagnosticRecord({
                    type: 'unknown',
                    record_id: 'invalid-000001',
                }),
            ]),
        })
        assert.equal(invalid.statusCode, 400, invalid.body)

        const oversized = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch([
                diagnosticRecord({
                    record_id: 'oversized-000001',
                    message: 'x'.repeat(70 * 1024),
                }),
            ]),
        })
        assert.equal(oversized.statusCode, 413, oversized.body)
    } finally {
        await app.close()
    }
})

test('diagnostics applies an in-memory per-IP rate limit', async () => {
    const app = buildApp({
        logger: false,
        diagnosticsRateLimitPerMinute: 1,
    })
    try {
        const first = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/records',
        })
        assert.equal(first.statusCode, 200, first.body)

        const limited = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/records',
        })
        assert.equal(limited.statusCode, 429, limited.body)
        assert.equal(limited.headers['retry-after'], '60')
    } finally {
        await app.close()
    }
})

test('diagnostics batch rolls back atomically on a SQLite error', async () => {
    await backendDb.$client.executeMultiple(`
        CREATE TRIGGER diagnostic_records_test_abort
        BEFORE INSERT ON diagnostic_records
        WHEN NEW.record_id = 'sqlite-error-000002'
        BEGIN
            SELECT RAISE(ABORT, 'forced diagnostics test failure');
        END;
    `)
    const app = buildApp({
        logger: false,
        diagnosticsRateLimitPerMinute: false,
    })
    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/batch',
            payload: diagnosticBatch(
                [
                    diagnosticRecord({ record_id: 'sqlite-error-000001' }),
                    diagnosticRecord({
                        record_id: 'sqlite-error-000002',
                        sequence: 2,
                    }),
                ],
                { boot_id: 'sqlite-error-boot' },
            ),
        })
        assert.equal(response.statusCode, 500)

        const listed = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/records?boot_id=sqlite-error-boot',
        })
        assert.equal(listed.headers['x-total-count'], '0')
    } finally {
        await app.close()
        await backendDb.$client.execute(
            'DROP TRIGGER IF EXISTS diagnostic_records_test_abort',
        )
    }
})

test('diagnostics stores, deduplicates, and downloads binary core dumps', async () => {
    const coredumpRoot = mkdtempSync(join(tmpdir(), 'takt-coredumps-'))
    const app = buildApp({
        logger: false,
        diagnosticsCoredumpDirectory: coredumpRoot,
        diagnosticsCoredumpMaxBytes: 1024,
        diagnosticsRateLimitPerMinute: false,
    })
    const headers = {
        'content-type': 'application/octet-stream',
        'x-device-id': 'takt-dev-001',
        'x-boot-id': 'coredump-test-boot',
        'x-firmware-version': '0.3.1',
        'x-dump-id': 'coredump-test-001',
    }
    const payload = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 1, 2, 3])
    try {
        let response = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/coredump',
            headers,
            payload,
        })
        assert.equal(response.statusCode, 201, response.body)
        assert.equal(response.json().duplicate, false)
        const id = response.json().coredump.id

        response = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/coredump',
            headers,
            payload,
        })
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.json().duplicate, true)
        assert.equal(response.json().coredump.id, id)

        const metadata = await app.inject({
            method: 'GET',
            url: `/api/diagnostics/coredumps/${id}`,
        })
        assert.equal(metadata.statusCode, 200, metadata.body)
        assert.equal(metadata.json().file_size, payload.length)

        const listed = await app.inject({
            method: 'GET',
            url: '/api/diagnostics/coredumps?boot_id=coredump-test-boot',
        })
        assert.equal(listed.statusCode, 200, listed.body)
        assert.equal(listed.headers['x-total-count'], '1')
        assert.equal(listed.json().coredumps[0].id, id)

        const download = await app.inject({
            method: 'GET',
            url: `/api/diagnostics/coredumps/${id}/file`,
        })
        assert.equal(download.statusCode, 200, download.body)
        assert.deepEqual(download.rawPayload, payload)

        const empty = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/coredump',
            headers: { ...headers, 'x-dump-id': 'coredump-test-empty' },
            payload: Buffer.alloc(0),
        })
        assert.equal(empty.statusCode, 400, empty.body)

        const wrongContentType = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/coredump',
            headers: {
                ...headers,
                'content-type': 'application/json',
                'x-dump-id': 'coredump-test-json',
            },
            payload: { dump: 'not binary' },
        })
        assert.equal(wrongContentType.statusCode, 400, wrongContentType.body)

        const oversized = await app.inject({
            method: 'POST',
            url: '/api/diagnostics/coredump',
            headers: { ...headers, 'x-dump-id': 'coredump-test-large' },
            payload: Buffer.alloc(1025),
        })
        assert.equal(oversized.statusCode, 413, oversized.body)
    } finally {
        await app.close()
        rmSync(coredumpRoot, { recursive: true, force: true })
    }
})

test('MCP note create and update return the complete entity', async () => {
    const created = await createNote({ text: 'Remember the adapter' })
    const id = created.structuredContent.id
    assert.deepEqual(created.structuredContent, {
        id,
        text: 'Remember the adapter',
        completedAt: null,
    })

    const completedAt = '2026-10-28T12:00:00.000Z'
    const updated = await updateNote({
        id,
        text: 'Adapter is packed',
        completedAt,
    })
    assert.deepEqual(updated.structuredContent, {
        id,
        text: 'Adapter is packed',
        completedAt,
    })
    assert.deepEqual(
        (await getNote({ id })).structuredContent,
        updated.structuredContent,
    )
})

test('MCP notes use a typed cursor to expose every page', async () => {
    const first = await createNote({ text: 'Pagination anchor' })
    const second = await createNote({ text: 'Pagination second' })
    const third = await createNote({ text: 'Pagination third' })

    const firstPage = await listNotes({
        cursor: first.structuredContent.id,
        limit: 1,
        withDone: true,
    })
    assert.deepEqual(firstPage.structuredContent, {
        notes: [second.structuredContent],
        nextCursor: second.structuredContent.id,
    })

    const secondPage = await listNotes({
        cursor: firstPage.structuredContent.nextCursor,
        limit: 1,
        withDone: true,
    })
    assert.deepEqual(secondPage.structuredContent, {
        notes: [third.structuredContent],
        nextCursor: null,
    })
    await assert.rejects(
        listNotes({ cursor: 'event:1', limit: 1, withDone: true }),
    )
})

test('HTTP note mutations return the complete MCP-compatible entity', async () => {
    const app = buildApp({ logger: false })

    try {
        let response = await app.inject({
            method: 'POST',
            url: '/api/notes',
            payload: { text: 'HTTP note' },
        })
        assert.equal(response.statusCode, 201, response.body)
        const id = response.json().id
        assert.deepEqual(response.json(), {
            id,
            text: 'HTTP note',
            completedAt: null,
        })

        response = await app.inject({
            method: 'PUT',
            url: `/api/notes/${id}`,
            payload: {
                text: 'Updated HTTP note',
                completedAt: '2026-11-01T09:00:00.000Z',
            },
        })
        assert.deepEqual(response.json(), {
            id,
            text: 'Updated HTTP note',
            completedAt: '2026-11-01T09:00:00.000Z',
        })
        response = await app.inject({
            method: 'PUT',
            url: `/api/notes/${id}`,
            payload: { completedAt: null },
        })
        assert.equal(response.json().completedAt, null)
    } finally {
        await app.close()
    }
})

test('backend serves the rendered frame as PNG', async () => {
    const app = buildApp({ logger: false })

    try {
        await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { tutorial: 1 },
        })
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

test('unfinished tutorial overrides every requested screen', async () => {
    const app = buildApp({ logger: false })

    try {
        await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { tutorial: 0 },
        })

        const lockedMainInfo = await app.inject({
            method: 'GET',
            url: '/screens/main',
        })
        const lockedSplashInfo = await app.inject({
            method: 'GET',
            url: '/screens/splash',
        })
        assert.equal(lockedMainInfo.statusCode, 200)
        assert.equal(lockedSplashInfo.statusCode, 200)
        assert.equal(lockedMainInfo.json().hash, lockedSplashInfo.json().hash)

        const lockedMainPng = await app.inject({
            method: 'GET',
            url: '/screens/main/png',
        })
        const lockedSplashPng = await app.inject({
            method: 'GET',
            url: '/screens/splash/png',
        })
        assert.deepEqual(lockedMainPng.rawPayload, lockedSplashPng.rawPayload)

        const completed = await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { tutorial: 1 },
        })
        assert.equal(completed.statusCode, 200)

        const mainInfo = await app.inject({
            method: 'GET',
            url: '/screens/main',
        })
        const splashInfo = await app.inject({
            method: 'GET',
            url: '/screens/splash',
        })
        assert.notEqual(mainInfo.json().hash, lockedMainInfo.json().hash)
        assert.notEqual(splashInfo.json().hash, lockedSplashInfo.json().hash)
        assert.notEqual(mainInfo.json().hash, splashInfo.json().hash)

        const reservedWelcome = await app.inject({
            method: 'GET',
            url: '/screens/welcome',
        })
        assert.equal(reservedWelcome.statusCode, 404)
    } finally {
        await app.close()
    }
})

test('screen hash is stable and changes with visible source data', async () => {
    const app = buildApp({ logger: false })

    try {
        await app.inject({
            method: 'PATCH',
            url: '/api/settings',
            payload: { tutorial: 1 },
        })
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

        response = await app.inject({
            method: 'GET',
            url: '/api/deadlines/occurrences?from=2026-10-20T00:00:00%2B03:00&to=2026-11-01T00:00:00%2B03:00&withCompleted=true',
        })
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.json().length, 2)
        assert.ok(
            response
                .json()
                .every(
                    (deadline) =>
                        deadline.due >= '2026-10-19T21:00:00.000Z' &&
                        deadline.due < '2026-10-31T21:00:00.000Z',
                ),
        )

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

    await assert.rejects(
        setDeadlineCompletion({ id, completed: true }),
        /recurrenceId is required for a recurring deadline/,
    )

    let master = await getDeadline({ id })
    assert.deepEqual(created.structuredContent, master.structuredContent)
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
        to: '2026-11-18T00:00:00+03:00',
        limit: 8,
        withCompleted: false,
    })
    const ownGroups = occurrences.structuredContent.filter(
        (deadline) => deadline.id === id,
    )
    assert.equal(ownGroups.length, 1)
    assert.equal(ownGroups[0].occurrences.length, 2)
    let ownOccurrences = flattenDeadlineGroups(
        occurrences.structuredContent,
    ).filter((deadline) => deadline.id === id)
    assert.equal(ownOccurrences.length, 2)
    assert.equal(ownOccurrences[1].recurrenceId, '2026-11-17T15:00:00.000Z')

    const updated = await updateDeadlineTool({
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
    assert.deepEqual(updated.structuredContent, master.structuredContent)
    assert.deepEqual(master.structuredContent.exceptions, [
        {
            recurrenceId: '2026-11-17T15:00:00.000Z',
            status: 'updated',
            title: 'Submit revised report',
            description: 'Prepare figures',
            due: '2026-11-17T17:00:00.000Z',
            dueIsDate: true,
            timezone: 'Europe/Moscow',
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
        to: '2026-11-22T00:00:00+03:00',
        limit: 8,
        withCompleted: false,
    })
    ownOccurrences = flattenDeadlineGroups(
        occurrences.structuredContent,
    ).filter((deadline) => deadline.id === id)
    assert.equal(
        ownOccurrences.some(
            ({ recurrenceId }) => recurrenceId === '2026-11-17T15:00:00.000Z',
        ),
        false,
    )
    occurrences = await getDeadlines({
        from: '2026-11-17T00:00:00+03:00',
        to: '2026-11-22T00:00:00+03:00',
        limit: 8,
        withCompleted: true,
    })
    ownOccurrences = flattenDeadlineGroups(
        occurrences.structuredContent,
    ).filter((deadline) => deadline.id === id)
    assert.equal(
        ownOccurrences.find(
            ({ recurrenceId }) => recurrenceId === '2026-11-17T15:00:00.000Z',
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
    assert.deepEqual(split.structuredContent, future.structuredContent)
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
    let dlOccurrences = await getDeadlines({
        from: '2026-11-18T00:00:00+03:00',
        to: '2026-11-19T00:00:00+03:00',
        withCancelled: false,
    })
    let foundDl = flattenDeadlineGroups(dlOccurrences.structuredContent).filter(
        (d) => d.id === futureId,
    )
    assert.equal(foundDl.length, 0)

    dlOccurrences = await getDeadlines({
        from: '2026-11-18T00:00:00+03:00',
        to: '2026-11-19T00:00:00+03:00',
        withCancelled: true,
    })
    foundDl = flattenDeadlineGroups(dlOccurrences.structuredContent).filter(
        (d) => d.id === futureId,
    )
    assert.equal(foundDl.length, 1)
    assert.equal(foundDl[0].cancelled, true)

    await updateDeadlineTool({
        id: futureId,
        scope: 'occurrence',
        recurrenceId: '2026-11-18T15:00:00.000Z',
        changes: { restore: true },
    })
    dlOccurrences = await getDeadlines({
        from: '2026-11-18T00:00:00+03:00',
        to: '2026-11-19T00:00:00+03:00',
    })
    foundDl = flattenDeadlineGroups(dlOccurrences.structuredContent).filter(
        (d) => d.id === futureId,
    )
    assert.equal(foundDl.length, 1)
    assert.equal(foundDl[0].cancelled, undefined)

    await cancelDeadlineTool({ id: futureId, scope: 'series' })
    const cancelled = await getDeadline({ id: futureId })
    assert.match(cancelled.structuredContent.cancelledAt, /Z$/)
    found = await searchDeadlines({
        query: 'Future reports',
        withCompleted: true,
    })
    assert.deepEqual(found.structuredContent, [])
    found = await searchDeadlines({
        query: 'Future reports',
        withCompleted: true,
        withCancelled: true,
    })
    assert.equal(found.structuredContent.length, 1)
    await cancelDeadlineTool({ id, scope: 'series' })
})

test('MCP completion safely tolerates a one-time deadline due as recurrenceId', async () => {
    assert.equal(
        setDeadlineCompletionInputSchema.safeParse({
            id: 'deadline:1',
            recurrenceId: null,
            completed: true,
        }).success,
        true,
    )

    const created = await createDeadline({
        title: 'One-time completion compatibility',
        due: '2026-11-20T18:00:00+03:00',
        timezone: 'Europe/Moscow',
    })
    const id = created.structuredContent.id

    try {
        await setDeadlineCompletion({
            id,
            recurrenceId: '2026-11-20T15:00:00.000Z',
            completed: true,
        })
        assert.notEqual(
            (await getDeadline({ id })).structuredContent.completedAt,
            null,
        )

        await setDeadlineCompletion({
            id,
            recurrenceId: null,
            completed: false,
        })
        assert.equal(
            (await getDeadline({ id })).structuredContent.completedAt,
            null,
        )

        await assert.rejects(
            setDeadlineCompletion({
                id,
                recurrenceId: '2026-11-21T15:00:00.000Z',
                completed: true,
            }),
            /recurrenceId does not match due for a one-time deadline/,
        )
    } finally {
        await cancelDeadlineTool({ id, scope: 'series' })
    }
})

test('HTTP deadline API matches MCP update, completion, search, and cancellation scopes', async () => {
    const app = buildApp({ logger: false })
    const createdIds = []

    try {
        let response = await app.inject({
            method: 'POST',
            url: '/api/deadlines',
            payload: {
                title: 'HTTP recurring deadline',
                due: '2026-11-02T18:00:00+03:00',
                timezone: 'Europe/Moscow',
                recurrence: { frequency: 'daily', count: 4 },
            },
        })
        assert.equal(response.statusCode, 201, response.body)
        const id = response.json().id
        createdIds.push(id)
        assert.deepEqual(response.json().recurrence, {
            frequency: 'daily',
            count: 4,
        })

        response = await app.inject({
            method: 'PUT',
            url: `/api/deadlines/${id}`,
            payload: {
                scope: 'occurrence',
                recurrenceId: '2026-11-03T15:00:00.000Z',
                changes: { title: 'Only this deadline' },
            },
        })
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.json().exceptions[0].title, 'Only this deadline')

        response = await app.inject({
            method: 'GET',
            url: '/api/deadlines/occurrences?from=2026-11-03T00:00:00%2B03:00',
        })
        assert.equal(
            response.json().find((deadline) => deadline.id === id).title,
            'Only this deadline',
        )

        response = await app.inject({
            method: 'PUT',
            url: `/api/deadlines/${id}/completion`,
            payload: {
                recurrenceId: '2026-11-03T15:00:00.000Z',
                completed: true,
            },
        })
        assert.deepEqual(response.json(), { id })
        response = await app.inject({
            method: 'GET',
            url: '/api/deadlines/occurrences?from=2026-11-03T00:00:00%2B03:00&withCompleted=true',
        })
        assert.equal(
            response
                .json()
                .find(
                    (deadline) =>
                        deadline.recurrenceId === '2026-11-03T15:00:00.000Z',
                ).completed,
            true,
        )

        response = await app.inject({
            method: 'PUT',
            url: `/api/deadlines/${id}`,
            payload: {
                scope: 'this_and_future',
                recurrenceId: '2026-11-04T15:00:00.000Z',
                changes: { title: 'Future HTTP deadlines' },
            },
        })
        const futureId = response.json().id
        createdIds.push(futureId)
        assert.notEqual(futureId, id)
        response = await app.inject({
            method: 'GET',
            url: '/api/deadlines?query=Future%20HTTP&withCompleted=true',
        })
        assert.deepEqual(
            response.json().map((deadline) => deadline.id),
            [futureId],
        )

        response = await app.inject({
            method: 'POST',
            url: `/api/deadlines/${futureId}/cancel`,
            payload: { scope: 'series' },
        })
        assert.deepEqual(response.json(), { id: futureId })
        response = await app.inject({
            method: 'GET',
            url: `/api/deadlines/${futureId}`,
        })
        assert.match(response.json().cancelledAt, /Z$/)
    } finally {
        for (const id of createdIds) {
            await app.inject({
                method: 'DELETE',
                url: `/api/deadlines/${id}`,
            })
        }
        await app.close()
    }
})

test('HTTP event API matches MCP update, search, and cancellation scopes', async () => {
    const app = buildApp({ logger: false })
    const createdIds = []

    try {
        let response = await app.inject({
            method: 'POST',
            url: '/api/events',
            payload: {
                title: 'HTTP recurring event',
                start: '2026-11-02T10:00:00+03:00',
                end: '2026-11-02T11:00:00+03:00',
                timezone: 'Europe/Moscow',
                recurrence: { frequency: 'daily', count: 4 },
            },
        })
        assert.equal(response.statusCode, 201, response.body)
        const id = response.json().id
        createdIds.push(id)
        assert.equal(response.json().title, 'HTTP recurring event')

        response = await app.inject({
            method: 'PUT',
            url: `/api/events/${id}`,
            payload: {
                scope: 'occurrence',
                recurrenceId: '2026-11-03T07:00:00.000Z',
                changes: { title: 'Only this event', end: null },
            },
        })
        assert.equal(response.statusCode, 200, response.body)
        assert.equal(response.json().exceptions[0].title, 'Only this event')

        response = await app.inject({
            method: 'GET',
            url: '/api/events/occurrences?from=2026-11-03T00:00:00%2B03:00&to=2026-11-04T00:00:00%2B03:00',
        })
        assert.equal(response.json()[0].title, 'Only this event')
        assert.equal(response.json()[0].end, null)

        response = await app.inject({
            method: 'PUT',
            url: `/api/events/${id}`,
            payload: {
                scope: 'this_and_future',
                recurrenceId: '2026-11-04T07:00:00.000Z',
                changes: { title: 'Future HTTP events' },
            },
        })
        const futureId = response.json().id
        createdIds.push(futureId)
        assert.notEqual(futureId, id)
        response = await app.inject({
            method: 'GET',
            url: '/api/events/search?query=Future%20HTTP',
        })
        assert.deepEqual(
            response.json().map((event) => event.id),
            [futureId],
        )

        response = await app.inject({
            method: 'POST',
            url: `/api/events/${futureId}/cancel`,
            payload: { scope: 'series' },
        })
        assert.deepEqual(response.json(), { id: futureId })
        response = await app.inject({
            method: 'GET',
            url: `/api/events/${futureId}`,
        })
        assert.match(response.json().cancelledAt, /Z$/)
    } finally {
        for (const id of createdIds) {
            await app.inject({ method: 'DELETE', url: `/api/events/${id}` })
        }
        await app.close()
    }
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
        const mcpId = `event:${id}`
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
        assert.deepEqual(mcpOccurrences.structuredContent, [
            {
                id: mcpId,
                title: expectedOccurrence.title,
                description: expectedOccurrence.description,
                timezone: expectedOccurrence.timezone,
                allDay: expectedOccurrence.allDay,
                occurrences: [
                    {
                        start: expectedOccurrence.start,
                        end: expectedOccurrence.end,
                        recurrenceId: expectedOccurrence.recurrenceId,
                    },
                ],
            },
        ])

        const mcpMaster = await getEvent({ id: mcpId })
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
        assert.equal(searchResult.structuredContent[0].id, mcpId)
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

test('weekly event excludes a DTSTART whose weekday is not selected', async () => {
    const created = await createEvent({
        title: 'daily',
        start: '2026-10-28T10:00:00Z',
        end: '2026-10-28T10:30:00Z',
        timezone: 'Europe/Moscow',
        recurrence: {
            frequency: 'weekly',
            weekdays: ['MO', 'TU', 'TH', 'FR'],
        },
    })
    const id = created.structuredContent.id
    assert.deepEqual(
        created.structuredContent,
        (await getEvent({ id })).structuredContent,
    )
    assert.equal(created.structuredContent.title, 'daily')
    assert.deepEqual(created.structuredContent.recurrence, {
        frequency: 'weekly',
        weekdays: ['MO', 'TU', 'TH', 'FR'],
    })

    try {
        const wednesday = await getEvents({
            start: '2026-10-28T00:00:00Z',
            end: '2026-10-29T00:00:00Z',
        })
        assert.deepEqual(
            flattenEventGroups(wednesday.structuredContent).filter(
                (event) => event.id === id,
            ),
            [],
        )

        const thursday = await getEvents({
            start: '2026-10-29T00:00:00Z',
            end: '2026-10-30T00:00:00Z',
        })
        const ownGroups = thursday.structuredContent.filter(
            (event) => event.id === id,
        )
        assert.equal(ownGroups.length, 1)
        assert.equal(ownGroups[0].occurrences.length, 1)
        assert.deepEqual(
            flattenEventGroups(thursday.structuredContent)
                .filter((event) => event.id === id)
                .map(({ start, end }) => ({ start, end })),
            [
                {
                    start: '2026-10-29T10:00:00.000Z',
                    end: '2026-10-29T10:30:00.000Z',
                },
            ],
        )

        const updated = await updateEventTool({
            id,
            scope: 'this_and_future',
            recurrenceId: '2026-10-29T10:00:00.000Z',
            changes: { title: 'updated daily' },
        })
        assert.equal(updated.structuredContent.id, id)
        assert.deepEqual(
            updated.structuredContent,
            (await getEvent({ id })).structuredContent,
        )
    } finally {
        await cancelEventTool({ id, scope: 'series' })
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
        const mcpId = `event:${id}`

        let result = await updateEventTool({
            id: mcpId,
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
        let master = await getEvent({ id: mcpId })
        assert.deepEqual(result.structuredContent, master.structuredContent)
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
        assert.equal(occurrence.structuredContent[0].occurrences[0].end, null)

        await updateEventTool({
            id: mcpId,
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
        assert.equal(
            updatedOccurrence.structuredContent[0].occurrences[0].end,
            null,
        )

        result = await updateEventTool({
            id: mcpId,
            scope: 'this_and_future',
            recurrenceId: '2026-11-04T07:00:00.000Z',
            changes: {
                title: 'Afternoon standup',
                start: '2026-11-04T14:00:00+03:00',
            },
        })
        const futureId = result.structuredContent.id
        assert.notEqual(futureId, mcpId)

        master = await getEvent({ id: mcpId })
        assert.deepEqual(master.structuredContent.recurrence, {
            frequency: 'daily',
            count: 2,
        })
        assert.equal(master.structuredContent.exceptions.length, 1)

        const future = await getEvent({ id: futureId })
        assert.deepEqual(result.structuredContent, future.structuredContent)
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
        const mcpId = `event:${id}`

        let result = await cancelEventTool({
            id: mcpId,
            scope: 'occurrence',
            recurrenceId: '2026-11-10T07:00:00.000Z',
        })
        assert.deepEqual(result.structuredContent, { id: mcpId })
        let master = await getEvent({ id: mcpId })
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
        let cancelledOccurrences = await getEvents({
            start: '2026-11-10T00:00:00+03:00',
            end: '2026-11-11T00:00:00+03:00',
            withCancelled: true,
        })
        let ownCancelled = flattenEventGroups(
            cancelledOccurrences.structuredContent,
        ).filter((e) => e.id === mcpId)
        assert.equal(ownCancelled.length, 1)
        assert.equal(ownCancelled[0].cancelled, true)

        await updateEventTool({
            id: mcpId,
            scope: 'occurrence',
            recurrenceId: '2026-11-10T07:00:00.000Z',
            changes: { restore: true },
        })
        occurrences = await getEvents({
            start: '2026-11-10T00:00:00+03:00',
            end: '2026-11-11T00:00:00+03:00',
        })
        let ownRestored = flattenEventGroups(
            occurrences.structuredContent,
        ).filter((e) => e.id === mcpId)
        assert.equal(ownRestored.length, 1)
        assert.equal(ownRestored[0].cancelled, undefined)

        result = await cancelEventTool({
            id: mcpId,
            scope: 'occurrence',
            recurrenceId: '2026-11-10T07:00:00.000Z',
        })

        result = await cancelEventTool({
            id: mcpId,
            scope: 'this_and_future',
            recurrenceId: '2026-11-11T07:00:00.000Z',
        })
        assert.deepEqual(result.structuredContent, { id: mcpId })
        master = await getEvent({ id: mcpId })
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

        result = await cancelEventTool({ id: mcpId, scope: 'series' })
        assert.deepEqual(result.structuredContent, { id: mcpId })
        master = await getEvent({ id: mcpId })
        assert.match(master.structuredContent.cancelledAt, /Z$/)
        const found = await searchEvents({ query: 'Cancelable series' })
        assert.deepEqual(found.structuredContent, [])
        const foundWithCancelled = await searchEvents({
            query: 'Cancelable series',
            withCancelled: true,
        })
        assert.equal(foundWithCancelled.structuredContent.length, 1)
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
        assert.match(response.json()[0].completedAt, /Z$/)
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
        const createdTodayEvents = screenEvents.filter(({ text }) =>
            text.startsWith('today-'),
        )
        assert.equal(createdTodayEvents.length, 10)
        assert.ok(
            createdTodayEvents.every(({ start }) => start.hasSame(now, 'day')),
        )

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

test('bundled project registers all required Inter weights', () => {
    assert.equal(project.settings.fonts.length, 3)
    createNodeEnvironment({ fonts: project.settings.fonts })

    const inter = GlobalFonts.families.find(({ family }) => family === 'Inter')
    assert.ok(inter)
    assert.deepEqual(
        [...new Set(inter.styles.map(({ weight }) => weight))].sort(
            (left, right) => left - right,
        ),
        [400, 500, 600],
    )
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
