import { db } from '#src/database/index.js'
import {
    diagnosticCoredumpsTable,
    diagnosticRecordsTable,
    type DiagnosticCoredump,
    type DiagnosticRecord,
    type DiagnosticRecordInsert,
} from '#src/database/schema.js'
import { and, count, desc, eq, gte, lte } from 'drizzle-orm'

export interface RecordFilters {
    readonly deviceId?: string
    readonly from?: Date
    readonly to?: Date
    readonly level?: string
    readonly module?: string
    readonly recordType?: string
    readonly bootId?: string
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
        filters.recordType === undefined
            ? undefined
            : eq(diagnosticRecordsTable.recordType, filters.recordType),
        filters.bootId === undefined
            ? undefined
            : eq(diagnosticRecordsTable.bootId, filters.bootId),
    )
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
    return await db
        .select()
        .from(diagnosticRecordsTable)
        .where(recordCondition(filters))
        .orderBy(
            desc(diagnosticRecordsTable.receivedAt),
            desc(diagnosticRecordsTable.id),
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
