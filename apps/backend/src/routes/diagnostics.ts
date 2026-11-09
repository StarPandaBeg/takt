import type { DiagnosticRecordInsert } from '#src/database/schema.js'
import * as diagnostics from '#src/repository/diagnostics.js'
import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, unlink } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import * as z from 'zod'

const JSON_BODY_LIMIT = 64 * 1024
const DEFAULT_COREDUMP_LIMIT = 4 * 1024 * 1024
const DEFAULT_RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000
const MAX_FIELDS_BYTES = 8 * 1024

const identifier = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
const shortText = z.string().min(1).max(64)
const fieldsSchema = z
    .record(z.string().min(1).max(64), z.json())
    .refine(
        (value) =>
            Buffer.byteLength(JSON.stringify(value), 'utf8') <=
            MAX_FIELDS_BYTES,
        `fields must not exceed ${MAX_FIELDS_BYTES} bytes`,
    )
const recordSchema = z
    .object({
        record_id: identifier,
        sequence: z.number().int().nonnegative().safe(),
        type: z.enum(['log', 'event', 'metric']),
        level: z.enum([
            'TRACE',
            'DEBUG',
            'INFO',
            'WARN',
            'ERROR',
            'CRITICAL',
            'FATAL',
            'VERBOSE',
        ]),
        source: shortText,
        module: shortText,
        message: z.string().max(2048),
        uptime_ms: z.number().int().nonnegative().safe(),
        timestamp_unix_ms: z.number().int().nonnegative().safe().nullable(),
        fields: fieldsSchema,
    })
    .strict()
const batchSchema = z
    .object({
        schema_version: z.literal(1),
        device_id: identifier,
        firmware_version: shortText,
        git_sha: z.string().min(1).max(64),
        boot_id: identifier,
        records: z.array(recordSchema).min(1).max(50),
    })
    .strict()
    .superRefine(({ records }, context) => {
        const seen = new Set<string>()
        for (const [index, record] of records.entries()) {
            if (seen.has(record.record_id)) {
                context.addIssue({
                    code: 'custom',
                    path: ['records', index, 'record_id'],
                    message: 'record_id must be unique within a batch',
                })
            }
            seen.add(record.record_id)
        }
    })

const recordFilterFields = {
    device_id: identifier.optional(),
    from: z.coerce.number().int().nonnegative().safe().optional(),
    to: z.coerce.number().int().nonnegative().safe().optional(),
    level: recordSchema.shape.level.optional(),
    module: shortText.optional(),
    source: shortText.optional(),
    query: z.string().min(1).max(256).optional(),
    type: recordSchema.shape.type.optional(),
    boot_id: identifier.optional(),
    sequence: z.coerce.number().int().nonnegative().safe().optional(),
    firmware_version: shortText.optional(),
    git_sha: z.string().min(1).max(64).optional(),
    event_type: shortText.optional(),
    has_fields: z.stringbool().optional(),
    sort_by: z
        .enum([
            'received_at',
            'timestamp',
            'uptime',
            'sequence',
            'level',
            'module',
            'type',
            'firmware_version',
        ])
        .default('received_at'),
    sort_direction: z.enum(['asc', 'desc']).default('desc'),
}
const validatePeriod = ({ from, to }: { from?: number; to?: number }) =>
    from === undefined || to === undefined || from <= to
const recordsQuerySchema = z
    .object({
        ...recordFilterFields,
        limit: z.coerce.number().int().positive().max(500).default(100),
        offset: z.coerce.number().int().nonnegative().default(0),
    })
    .strict()
    .refine(validatePeriod, {
        message: 'from must be less than or equal to to',
    })
const exportQuerySchema = z
    .object({
        ...recordFilterFields,
        format: z.enum(['json', 'csv']).default('json'),
        max_records: z.coerce
            .number()
            .int()
            .positive()
            .max(10_000)
            .default(5000),
    })
    .strict()
    .refine(validatePeriod, {
        message: 'from must be less than or equal to to',
    })
const coredumpsQuerySchema = z
    .object({
        device_id: identifier.optional(),
        boot_id: identifier.optional(),
        from: z.coerce.number().int().nonnegative().safe().optional(),
        to: z.coerce.number().int().nonnegative().safe().optional(),
        limit: z.coerce.number().int().positive().max(200).default(50),
        offset: z.coerce.number().int().nonnegative().default(0),
    })
    .strict()
    .refine(validatePeriod, {
        message: 'from must be less than or equal to to',
    })
const bootsQuerySchema = z.object({
    device_id: identifier.optional(),
    limit: z.coerce.number().int().positive().max(500).default(100),
})
const coredumpHeadersSchema = z.object({
    'x-device-id': identifier,
    'x-boot-id': identifier,
    'x-firmware-version': shortText,
    'x-dump-id': identifier,
})
const idParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
})

export interface DiagnosticsRoutesOptions {
    readonly coredumpDirectory?: string
    readonly coredumpMaxBytes?: number
    readonly rateLimitPerMinute?: number | false
}

function serializeRecord(
    record: Awaited<ReturnType<typeof diagnostics.listRecords>>[number],
) {
    return {
        id: record.id,
        device_id: record.deviceId,
        record_id: record.recordId,
        boot_id: record.bootId,
        sequence: record.sequence,
        firmware_version: record.firmwareVersion,
        git_sha: record.gitSha,
        type: record.recordType,
        level: record.level,
        source: record.source,
        module: record.module,
        message: record.message,
        uptime_ms: record.uptimeMs,
        timestamp_unix_ms: record.timestampUnixMs,
        fields:
            record.fieldsJson === null
                ? {}
                : (JSON.parse(record.fieldsJson) as unknown),
        received_at: record.receivedAt.getTime(),
    }
}

function serializeCoredump(
    coredump: NonNullable<Awaited<ReturnType<typeof diagnostics.getCoredump>>>,
) {
    return {
        id: coredump.id,
        device_id: coredump.deviceId,
        boot_id: coredump.bootId,
        dump_id: coredump.dumpId,
        firmware_version: coredump.firmwareVersion,
        file_size: coredump.fileSize,
        sha256: coredump.sha256,
        received_at: coredump.receivedAt.getTime(),
        download_url: `/api/diagnostics/coredumps/${coredump.id}/file`,
    }
}

function toRecordFilters(
    query:
        z.infer<typeof recordsQuerySchema> | z.infer<typeof exportQuerySchema>,
    limit: number,
    offset: number,
): diagnostics.RecordFilters {
    return {
        deviceId: query.device_id,
        from: query.from === undefined ? undefined : new Date(query.from),
        to: query.to === undefined ? undefined : new Date(query.to),
        level: query.level,
        module: query.module,
        source: query.source,
        query: query.query,
        recordType: query.type,
        bootId: query.boot_id,
        sequence: query.sequence,
        firmwareVersion: query.firmware_version,
        gitSha: query.git_sha,
        eventType: query.event_type,
        hasFields: query.has_fields,
        sortBy: query.sort_by,
        sortDirection: query.sort_direction,
        limit,
        offset,
    }
}

function csvCell(value: unknown): string {
    const text =
        typeof value === 'string' ? value : JSON.stringify(value ?? null)
    return `"${text.replaceAll('"', '""')}"`
}

export const diagnosticsRoutes: FastifyPluginAsync<
    DiagnosticsRoutesOptions
> = async (fastify, options) => {
    const coredumpDirectory = resolve(
        options.coredumpDirectory ??
            process.env.TAKT_COREDUMP_DIR ??
            './data/diagnostics/coredumps',
    )
    const coredumpMaxBytes = options.coredumpMaxBytes ?? DEFAULT_COREDUMP_LIMIT
    const rateLimit = options.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT
    const rateCounters = new Map<string, { count: number; resetAt: number }>()

    if (!Number.isSafeInteger(coredumpMaxBytes) || coredumpMaxBytes <= 0) {
        throw new RangeError('coredumpMaxBytes must be a positive safe integer')
    }
    if (
        rateLimit !== false &&
        (!Number.isSafeInteger(rateLimit) || rateLimit <= 0)
    ) {
        throw new RangeError(
            'rateLimitPerMinute must be a positive safe integer or false',
        )
    }

    fastify.addContentTypeParser(
        'application/octet-stream',
        { parseAs: 'buffer' },
        (_request, body, done) => done(null, body),
    )

    fastify.addHook('onRequest', (request, reply, done) => {
        if (rateLimit === false) {
            done()
            return
        }
        const now = Date.now()
        if (rateCounters.size > 1024) {
            for (const [key, value] of rateCounters) {
                if (value.resetAt <= now) rateCounters.delete(key)
            }
        }
        if (rateCounters.size > 4096) {
            const oldestKey = rateCounters.keys().next().value
            if (oldestKey !== undefined) rateCounters.delete(oldestKey)
        }
        const previous = rateCounters.get(request.ip)
        const counter =
            previous === undefined || previous.resetAt <= now
                ? { count: 0, resetAt: now + RATE_WINDOW_MS }
                : previous
        counter.count += 1
        rateCounters.set(request.ip, counter)
        reply.header('x-ratelimit-limit', rateLimit)
        reply.header(
            'x-ratelimit-remaining',
            Math.max(0, rateLimit - counter.count),
        )
        if (counter.count > rateLimit) {
            void reply
                .header(
                    'retry-after',
                    Math.ceil((counter.resetAt - now) / 1000),
                )
                .code(429)
                .send({ error: 'Too Many Requests' })
            return
        }
        done()
    })

    fastify.post('/batch', { bodyLimit: JSON_BODY_LIMIT }, async (request) => {
        const batch = batchSchema.parse(request.body)
        const receivedAt = new Date()
        const records: DiagnosticRecordInsert[] = batch.records.map(
            (record) => ({
                deviceId: batch.device_id,
                recordId: record.record_id,
                bootId: batch.boot_id,
                sequence: record.sequence,
                firmwareVersion: batch.firmware_version,
                gitSha: batch.git_sha,
                recordType: record.type,
                level: record.level,
                source: record.source,
                module: record.module,
                message: record.message,
                uptimeMs: record.uptime_ms,
                timestampUnixMs: record.timestamp_unix_ms,
                fieldsJson: JSON.stringify(record.fields),
                receivedAt,
            }),
        )
        const accepted = await diagnostics.acceptRecords(records)
        return {
            ok: true,
            accepted,
            duplicates: records.length - accepted,
            acknowledged_ids: batch.records.map(({ record_id }) => record_id),
            server_time_ms: Date.now(),
        }
    })

    fastify.get('/records/export', async (request, reply) => {
        const query = exportQuerySchema.parse(request.query)
        const records = (
            await diagnostics.listRecords(
                toRecordFilters(query, query.max_records, 0),
            )
        ).map(serializeRecord)
        const timestamp = new Date().toISOString().replaceAll(':', '-')
        reply.header(
            'content-disposition',
            `attachment; filename="takt-diagnostics-${timestamp}.${query.format}"`,
        )
        if (query.format === 'json') return records

        const columns = [
            'id',
            'device_id',
            'record_id',
            'boot_id',
            'sequence',
            'firmware_version',
            'git_sha',
            'type',
            'level',
            'source',
            'module',
            'message',
            'uptime_ms',
            'timestamp_unix_ms',
            'fields',
            'received_at',
        ] as const
        const csv = [
            columns.join(','),
            ...records.map((record) =>
                columns.map((column) => csvCell(record[column])).join(','),
            ),
        ].join('\n')
        return reply.type('text/csv; charset=utf-8').send(csv)
    })

    fastify.get('/records', async (request, reply) => {
        const query = recordsQuerySchema.parse(request.query)
        const filters = toRecordFilters(query, query.limit, query.offset)
        const [records, total] = await Promise.all([
            diagnostics.listRecords(filters),
            diagnostics.countRecords(filters),
        ])
        reply.header('x-total-count', total)
        reply.header('access-control-expose-headers', 'x-total-count')
        return {
            records: records.map(serializeRecord),
            limit: query.limit,
            offset: query.offset,
        }
    })

    fastify.get('/boots', async (request) => {
        const query = bootsQuerySchema.parse(request.query)
        const boots = await diagnostics.listBoots({
            deviceId: query.device_id,
            limit: query.limit,
        })
        return {
            boots: boots.map((boot) => ({
                device_id: boot.deviceId,
                boot_id: boot.bootId,
                firmware_version: boot.firmwareVersion,
                first_received_at: boot.firstReceivedAt,
                last_received_at: boot.lastReceivedAt,
                record_count: boot.recordCount,
            })),
        }
    })

    fastify.post(
        '/coredump',
        { bodyLimit: coredumpMaxBytes },
        async (request, reply) => {
            const headers = coredumpHeadersSchema.parse(request.headers)
            if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
                return await reply
                    .code(400)
                    .send({ error: 'Core dump body must not be empty' })
            }
            const body = request.body
            const sha256 = createHash('sha256').update(body).digest('hex')
            const existing = await diagnostics.findCoredump(
                headers['x-device-id'],
                headers['x-dump-id'],
            )
            if (existing !== undefined) {
                if (existing.sha256 !== sha256) {
                    return await reply.code(409).send({
                        error: 'Dump ID already exists with different content',
                    })
                }
                return {
                    ok: true,
                    duplicate: true,
                    coredump: serializeCoredump(existing),
                    server_time_ms: Date.now(),
                }
            }

            await mkdir(coredumpDirectory, { recursive: true })
            const storageKey = createHash('sha256')
                .update(headers['x-device-id'])
                .update('\0')
                .update(headers['x-dump-id'])
                .digest('hex')
            const filename = `${storageKey}.bin`
            const absolutePath = join(coredumpDirectory, filename)
            const handle = await open(absolutePath, 'wx', 0o600)
            let persisted = false
            try {
                await handle.writeFile(body)
                await handle.sync()
                await handle.close()
                const coredump = await diagnostics.createCoredump({
                    deviceId: headers['x-device-id'],
                    bootId: headers['x-boot-id'],
                    dumpId: headers['x-dump-id'],
                    firmwareVersion: headers['x-firmware-version'],
                    filePath: filename,
                    fileSize: body.length,
                    sha256,
                    receivedAt: new Date(),
                })
                persisted = true
                return reply.code(201).send({
                    ok: true,
                    duplicate: false,
                    coredump: serializeCoredump(coredump),
                    server_time_ms: Date.now(),
                })
            } finally {
                await handle.close().catch(() => {})
                if (!persisted) await unlink(absolutePath).catch(() => {})
            }
        },
    )

    fastify.get('/coredumps/:id', async (request, reply) => {
        const { id } = idParamsSchema.parse(request.params)
        const coredump = await diagnostics.getCoredump(id)
        if (coredump === undefined) {
            return await reply.code(404).send({ error: 'Core dump not found' })
        }
        return serializeCoredump(coredump)
    })

    fastify.get('/coredumps', async (request, reply) => {
        const query = coredumpsQuerySchema.parse(request.query)
        const filters: diagnostics.CoredumpFilters = {
            deviceId: query.device_id,
            bootId: query.boot_id,
            from: query.from === undefined ? undefined : new Date(query.from),
            to: query.to === undefined ? undefined : new Date(query.to),
            limit: query.limit,
            offset: query.offset,
        }
        const [coredumps, total] = await Promise.all([
            diagnostics.listCoredumps(filters),
            diagnostics.countCoredumps(filters),
        ])
        reply.header('x-total-count', total)
        reply.header('access-control-expose-headers', 'x-total-count')
        return {
            coredumps: coredumps.map(serializeCoredump),
            limit: query.limit,
            offset: query.offset,
        }
    })

    fastify.get('/coredumps/:id/file', async (request, reply) => {
        const { id } = idParamsSchema.parse(request.params)
        const coredump = await diagnostics.getCoredump(id)
        if (coredump === undefined) {
            return await reply.code(404).send({ error: 'Core dump not found' })
        }
        if (basename(coredump.filePath) !== coredump.filePath) {
            request.log.error(
                { coredumpId: id },
                'Unsafe core dump path in database',
            )
            return await reply
                .code(500)
                .send({ error: 'Core dump storage path is invalid' })
        }
        reply.header('content-type', 'application/octet-stream')
        reply.header('content-length', coredump.fileSize)
        reply.header(
            'content-disposition',
            `attachment; filename="takt-coredump-${coredump.id}.bin"`,
        )
        return reply.send(
            createReadStream(join(coredumpDirectory, coredump.filePath)),
        )
    })

    return Promise.resolve()
}
