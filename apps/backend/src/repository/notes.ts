import { db } from '#src/database/index.js'
import { notesTable, type Note, type NoteInsert } from '#src/database/schema.js'
import { and, asc, count, eq, gt, isNotNull, isNull } from 'drizzle-orm'

export const getAll = async (): Promise<Note[]> => {
    return await db.query.notesTable.findMany()
}

export const getFiltered = async (filters: {
    limit?: number | undefined
    withDone?: boolean | undefined
    onlyDone?: boolean | undefined
    afterId?: number | undefined
    page?: number | undefined
    offset?: number | undefined
}): Promise<Note[]> => {
    let query = db.select().from(notesTable).$dynamic()

    let condition = undefined
    if (filters.onlyDone) {
        condition = isNotNull(notesTable.completed_at)
    } else if (!filters.withDone) {
        condition = isNull(notesTable.completed_at)
    }

    const where = and(
        condition,
        filters.afterId === undefined
            ? undefined
            : gt(notesTable.id, filters.afterId),
    )
    if (where !== undefined) {
        query = query.where(where)
    }
    query = query.orderBy(asc(notesTable.id))
    const offset =
        filters.offset ??
        (filters.page !== undefined && filters.limit !== undefined
            ? (filters.page - 1) * filters.limit
            : undefined)
    if (offset !== undefined) {
        query = query.offset(offset)
    }
    if (filters.limit !== undefined) {
        query = query.limit(filters.limit)
    }

    return query.execute()
}

export const countFiltered = async (filters: {
    withDone?: boolean | undefined
    onlyDone?: boolean | undefined
}): Promise<number> => {
    let condition = undefined
    if (filters.onlyDone) {
        condition = isNotNull(notesTable.completed_at)
    } else if (!filters.withDone) {
        condition = isNull(notesTable.completed_at)
    }
    let query = db.select({ total: count() }).from(notesTable).$dynamic()
    if (condition !== undefined) {
        query = query.where(condition)
    }
    const result = await query.execute()
    return result[0]?.total ?? 0
}

export const get = async (id: Note['id']) => {
    return await db.query.notesTable.findFirst({ where: { id } })
}

export const create = async (data: NoteInsert) => {
    const result = await db
        .insert(notesTable)
        .values(data)
        .returning({ id: notesTable.id })
    return result[0]!.id
}

export type UpdateNote = {
    text?: string | undefined
}
export const edit = async (id: Note['id'], data: UpdateNote) => {
    await db.update(notesTable).set(data).where(eq(notesTable.id, id))
}

export const markDoneAt = async (id: Note['id'], date: Date | null) => {
    return await db
        .update(notesTable)
        .set({ completed_at: date })
        .where(eq(notesTable.id, id))
}
