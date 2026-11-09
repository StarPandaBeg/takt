import { db } from '#src/database/index.js'
import {
    diagnosticCoredumpsTable,
    diagnosticRecordsTable,
    type DiagnosticCoredump,
    type DiagnosticRecord,
    type DiagnosticRecordInsert,
} from '#src/database/schema.js'
import { and, asc, count, desc, eq, gte, like, lte, ne, sql } from 'drizzle-orm'

export type RecordSortBy =
    | 'received_at'
    | 'timestamp'
    | 'uptime'
    | 'sequence'
    | 'level'
    | 'module'
    | 'type'
    | 'firmware_version'

export interface RecordFilters {
    readonly deviceId?: string
    readonly from?: Date
    readonly to?: Date
    readonly level?: string
    readonly module?: string
    readonly source?: string
    readonly query?: string
    readonly recordType?: string
    readonly bootId?: string
    readonly sequence?: number
    readonly firmwareVersion?: string
    readonly gitSha?: string
    readonly eventType?: string
    readonly hasFields?: boolean
    readonly sortBy: RecordSortBy
    readonly sortDirection: 'asc' | 'desc'
    readonly limit: number
    readonly offset: number
}

function recordCondition(filters: RecordFilters) {
    return and(
        filters.deviceId === undefined
            ? undefined
            : eq(diagnosticRecordsTable.deviceId, filters.deviceId),
        filters.from === undefined
            ? undefined
            : gte(diagnosticRecordsTable.receivedAt, filters.from),
        filters.to === undefined
            ? undefined
            : lte(diagnosticRecordsTable.receivedAt, filters.to),
        filters.level === undefined
            ? undefined
            : eq(diagnosticRecordsTable.level, filters.level),
        filters.module === undefined
            ? undefined
            : eq(diagnosticRecordsTable.module, filters.module),
        filters.source === undefined
            ? undefined
            : eq(diagnosticRecordsTable.source, filters.source),
        filters.query === undefined
            ? undefined
            : like(diagnosticRecordsTable.message, `%${filters.query}%`),
        filters.recordType === undefined
            ? undefined
            : eq(diagnosticRecordsTable.recordType, filters.recordType),
        filters.bootId === undefined
            ? undefined
            : eq(diagnosticRecordsTable.bootId, filters.bootId),
        filters.sequence === undefined
            ? undefined
            : eq(diagnosticRecordsTable.sequence, filters.sequence),
        filters.firmwareVersion === undefined
            ? undefined
            : eq(
                  diagnosticRecordsTable.firmwareVersion,
                  filters.firmwareVersion,
              ),
        filters.gitSha === undefined
            ? undefined
            : eq(diagnosticRecordsTable.gitSha, filters.gitSha),
        filters.eventType === undefined
            ? undefined
            : sql`coalesce(json_extract(${diagnosticRecordsTable.fieldsJson}, '$.event_type'), json_extract(${diagnosticRecordsTable.fieldsJson}, '$.eventType')) = ${filters.eventType}`,
        filters.hasFields === undefined
            ? undefined
            : filters.hasFields
              ? ne(diagnosticRecordsTable.fieldsJson, '{}')
              : eq(diagnosticRecordsTable.fieldsJson, '{}'),
    )
}

function recordOrderColumn(sortBy: RecordSortBy) {
    switch (sortBy) {
        case 'timestamp':
            return diagnosticRecordsTable.timestampUnixMs
        case 'uptime':
            return diagnosticRecordsTable.uptimeMs
        case 'sequence':
            return diagnosticRecordsTable.sequence
        case 'level':
            return diagnosticRecordsTable.level
        case 'module':
            return diagnosticRecordsTable.module
        case 'type':
            return diagnosticRecordsTable.recordType
        case 'firmware_version':
            return diagnosticRecordsTable.firmwareVersion
        case 'received_at':
            return diagnosticRecordsTable.receivedAt
    }
}

export async function acceptRecords(
    records: readonly DiagnosticRecordInsert[],
): Promise<number> {
    return await db.transaction(async (tx) => {
        const inserted = await tx
            .insert(diagnosticRecordsTable)
            .values([...records])
            .onConflictDoNothing({
                target: [
                    diagnosticRecordsTable.deviceId,
                    diagnosticRecordsTable.recordId,
                ],
            })
            .returning({ id: diagnosticRecordsTable.id })
        return inserted.length
    })
}

export async function listRecords(
    filters: RecordFilters,
): Promise<DiagnosticRecord[]> {
    const order = filters.sortDirection === 'asc' ? asc : desc
    return await db
        .select()
        .from(diagnosticRecordsTable)
        .where(recordCondition(filters))
        .orderBy(
            order(recordOrderColumn(filters.sortBy)),
            order(diagnosticRecordsTable.id),
        )
        .limit(filters.limit)
        .offset(filters.offset)
}

export async function countRecords(filters: RecordFilters): Promise<number> {
    const result = await db
        .select({ total: count() })
        .from(diagnosticRecordsTable)
        .where(recordCondition(filters))
    return result[0]?.total ?? 0
}

export async function deleteAllRecords(): Promise<number> {
    const deleted = await db
        .delete(diagnosticRecordsTable)
        .returning({ id: diagnosticRecordsTable.id })
    return deleted.length
}

export async function findCoredump(
    deviceId: string,
    dumpId: string,
): Promise<DiagnosticCoredump | undefined> {
    return await db.query.diagnosticCoredumpsTable.findFirst({
        where: { deviceId, dumpId },
    })
}

export async function getCoredump(
    id: number,
): Promise<DiagnosticCoredump | undefined> {
    return await db.query.diagnosticCoredumpsTable.findFirst({ where: { id } })
}

export interface CoredumpFilters {
    readonly deviceId?: string
    readonly bootId?: string
    readonly from?: Date
    readonly to?: Date
    readonly limit: number
    readonly offset: number
}

function coredumpCondition(filters: CoredumpFilters) {
    return and(
        filters.deviceId === undefined
            ? undefined
            : eq(diagnosticCoredumpsTable.deviceId, filters.deviceId),
        filters.bootId === undefined
            ? undefined
            : eq(diagnosticCoredumpsTable.bootId, filters.bootId),
        filters.from === undefined
            ? undefined
            : gte(diagnosticCoredumpsTable.receivedAt, filters.from),
        filters.to === undefined
            ? undefined
            : lte(diagnosticCoredumpsTable.receivedAt, filters.to),
    )
}

export async function listCoredumps(
    filters: CoredumpFilters,
): Promise<DiagnosticCoredump[]> {
    return await db
        .select()
        .from(diagnosticCoredumpsTable)
        .where(coredumpCondition(filters))
        .orderBy(
            desc(diagnosticCoredumpsTable.receivedAt),
            desc(diagnosticCoredumpsTable.id),
        )
        .limit(filters.limit)
        .offset(filters.offset)
}

export async function countCoredumps(
    filters: CoredumpFilters,
): Promise<number> {
    const result = await db
        .select({ total: count() })
        .from(diagnosticCoredumpsTable)
        .where(coredumpCondition(filters))
    return result[0]?.total ?? 0
}

export interface BootSummary {
    readonly deviceId: string
    readonly bootId: string
    readonly firmwareVersion: string | null
    readonly firstReceivedAt: number
    readonly lastReceivedAt: number
    readonly recordCount: number
}

export async function listBoots(options: {
    readonly deviceId?: string
    readonly limit: number
}): Promise<BootSummary[]> {
    return await db
        .select({
            deviceId: diagnosticRecordsTable.deviceId,
            bootId: diagnosticRecordsTable.bootId,
            firmwareVersion: sql<
                string | null
            >`max(${diagnosticRecordsTable.firmwareVersion})`,
            firstReceivedAt: sql<number>`min(${diagnosticRecordsTable.receivedAt})`,
            lastReceivedAt: sql<number>`max(${diagnosticRecordsTable.receivedAt})`,
            recordCount: count(),
        })
        .from(diagnosticRecordsTable)
        .where(
            options.deviceId === undefined
                ? undefined
                : eq(diagnosticRecordsTable.deviceId, options.deviceId),
        )
        .groupBy(diagnosticRecordsTable.deviceId, diagnosticRecordsTable.bootId)
        .orderBy(desc(sql`max(${diagnosticRecordsTable.receivedAt})`))
        .limit(options.limit)
}

export async function createCoredump(data: {
    readonly deviceId: string
    readonly bootId: string
    readonly dumpId: string
    readonly firmwareVersion?: string
    readonly filePath: string
    readonly fileSize: number
    readonly sha256: string
    readonly receivedAt: Date
}): Promise<DiagnosticCoredump> {
    const inserted = await db
        .insert(diagnosticCoredumpsTable)
        .values(data)
        .returning()
    return inserted[0]!
}
