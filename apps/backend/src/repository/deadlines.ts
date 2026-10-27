import { db } from '#src/database/index.js'
import {
    deadlineRecurrenceExceptionsTable,
    deadlinesTable,
    type Deadline,
    type DeadlineInsert,
} from '#src/database/schema.js'
import { and, asc, eq, gte, isNotNull, or } from 'drizzle-orm'

export interface DeadlineFilters {
    readonly from?: Date | undefined
    readonly limit?: number | undefined
    readonly withCompleted?: boolean | undefined
}

export const getFiltered = async (
    filters: DeadlineFilters,
): Promise<Deadline[]> => {
    const conditions = []
    if (filters.from !== undefined) {
        conditions.push(
            or(
                gte(deadlinesTable.due, filters.from),
                isNotNull(deadlinesTable.recurrenceRule),
            )!,
        )
    }
    if (!filters.withCompleted) {
        conditions.push(eq(deadlinesTable.completed, false))
    }

    let query = db
        .select()
        .from(deadlinesTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(deadlinesTable.due))
        .$dynamic()

    if (filters.limit !== undefined) query = query.limit(filters.limit)
    return await query.execute()
}

/** Masters that can produce an occurrence at or after the requested date. */
export const getScheduleCandidates = async (
    from: Date,
): Promise<Deadline[]> => {
    return await db
        .select()
        .from(deadlinesTable)
        .where(
            and(
                eq(deadlinesTable.completed, false),
                or(
                    gte(deadlinesTable.due, from),
                    isNotNull(deadlinesTable.recurrenceRule),
                ),
            ),
        )
        .orderBy(asc(deadlinesTable.due))
}

export const get = async (
    id: Deadline['id'],
): Promise<Deadline | undefined> => {
    return await db.query.deadlinesTable.findFirst({ where: { id } })
}

export const create = async (data: DeadlineInsert): Promise<Deadline['id']> => {
    const result = await db
        .insert(deadlinesTable)
        .values(data)
        .returning({ id: deadlinesTable.id })
    return result[0]!.id
}

export type UpdateDeadline = {
    [
        K in keyof Pick<
            Deadline,
            | 'title'
            | 'description'
            | 'due'
            | 'dueIsDate'
            | 'timezone'
            | 'recurrenceRule'
            | 'completed'
        >
    ]?: Deadline[K] | undefined
}

export const edit = async (
    id: Deadline['id'],
    data: UpdateDeadline,
): Promise<void> => {
    await db.transaction(async (tx) => {
        await tx
            .update(deadlinesTable)
            .set(data)
            .where(eq(deadlinesTable.id, id))

        if (
            data.due !== undefined ||
            data.timezone !== undefined ||
            data.recurrenceRule !== undefined
        ) {
            await tx
                .delete(deadlineRecurrenceExceptionsTable)
                .where(eq(deadlineRecurrenceExceptionsTable.deadlineId, id))
        }
    })
}

export const markCompleted = async (
    id: Deadline['id'],
    completed: boolean,
): Promise<void> => {
    await db
        .update(deadlinesTable)
        .set({ completed })
        .where(eq(deadlinesTable.id, id))
}

export const remove = async (id: Deadline['id']): Promise<void> => {
    await db.delete(deadlinesTable).where(eq(deadlinesTable.id, id))
}
