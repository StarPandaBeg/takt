import { db } from '#/database/index.js'
import { notesTable, type Note, type NoteInsert } from '#/database/schema.js'
import { eq, isNull } from 'drizzle-orm'

export const getAll = async (): Promise<Note[]> => {
    return await db.query.notesTable.findMany()
}

export const getFiltered = async (filters: {
    limit?: number | undefined
    withDone?: boolean | undefined
}): Promise<Note[]> => {
    let query = db.select().from(notesTable).$dynamic()

    if (!filters.withDone) {
        query = query.where(isNull(notesTable.completed_at))
    }
    if (filters.limit !== undefined) {
        query = query.limit(filters.limit)
    }

    return query.execute()
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
