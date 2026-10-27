import { db } from '#src/database/index.js'
import {
    deadlineCompletionsTable,
    deadlineRecurrenceExceptionsTable,
    deadlinesTable,
    type Deadline,
    type DeadlineInsert,
} from '#src/database/schema.js'
import {
    and,
    asc,
    eq,
    gte,
    isNotNull,
    isNull,
    like,
    lt,
    or,
} from 'drizzle-orm'

export interface DeadlineFilters {
    readonly from?: Date | undefined
    readonly to?: Date | undefined
    readonly limit?: number | undefined
    readonly withCompleted?: boolean | undefined
    readonly query?: string | undefined
}

export const getFiltered = async (
    filters: DeadlineFilters,
): Promise<Deadline[]> => {
    const conditions = [isNull(deadlinesTable.cancelledAt)]
    if (filters.from !== undefined) {
        conditions.push(
            or(
                gte(deadlinesTable.due, filters.from),
                isNotNull(deadlinesTable.recurrenceRule),
            )!,
        )
    }
    if (filters.to !== undefined) {
        conditions.push(lt(deadlinesTable.due, filters.to))
    }
    if (filters.query !== undefined) {
        const pattern = `%${filters.query}%`
        conditions.push(
            or(
                like(deadlinesTable.title, pattern),
                like(deadlinesTable.description, pattern),
            )!,
        )
    }

    let query = db
        .select()
        .from(deadlinesTable)
        .where(and(...conditions))
        .orderBy(asc(deadlinesTable.due))
        .$dynamic()

    if (filters.limit !== undefined) query = query.limit(filters.limit)
    return await query.execute()
}

/** Masters that can produce an occurrence at or after the requested date. */
export const getScheduleCandidates = async (
    from: Date,
    withCompleted = false,
): Promise<Deadline[]> => {
    const conditions = [
        isNull(deadlinesTable.cancelledAt),
        or(
            gte(deadlinesTable.due, from),
            isNotNull(deadlinesTable.recurrenceRule),
            eq(deadlinesTable.visibilityHide, 'on_complete'),
        )!,
    ]
    void withCompleted
    return await db
        .select()
        .from(deadlinesTable)
        .where(and(...conditions))
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
            | 'visibilityShow'
            | 'visibilityDays'
            | 'visibilityHide'
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

export async function split(
    id: Deadline['id'],
    recurrenceId: Date,
    previous: UpdateDeadline,
    future: DeadlineInsert,
): Promise<Deadline['id']> {
    return await db.transaction(async (tx) => {
        await tx
            .update(deadlinesTable)
            .set(previous)
            .where(eq(deadlinesTable.id, id))
        await tx
            .delete(deadlineRecurrenceExceptionsTable)
            .where(
                and(
                    eq(deadlineRecurrenceExceptionsTable.deadlineId, id),
                    gte(
                        deadlineRecurrenceExceptionsTable.recurrenceId,
                        recurrenceId,
                    ),
                ),
            )
        await tx
            .delete(deadlineCompletionsTable)
            .where(
                and(
                    eq(deadlineCompletionsTable.deadlineId, id),
                    gte(deadlineCompletionsTable.recurrenceId, recurrenceId),
                ),
            )
        const result = await tx
            .insert(deadlinesTable)
            .values(future)
            .returning({ id: deadlinesTable.id })
        return result[0]!.id
    })
}

export async function cancel(
    id: Deadline['id'],
    cancelledAt: Date,
): Promise<void> {
    await db
        .update(deadlinesTable)
        .set({ cancelledAt })
        .where(
            and(eq(deadlinesTable.id, id), isNull(deadlinesTable.cancelledAt)),
        )
}

export async function truncate(
    id: Deadline['id'],
    recurrenceId: Date,
    recurrenceRule: string,
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .update(deadlinesTable)
            .set({ recurrenceRule })
            .where(eq(deadlinesTable.id, id))
        await tx
            .delete(deadlineRecurrenceExceptionsTable)
            .where(
                and(
                    eq(deadlineRecurrenceExceptionsTable.deadlineId, id),
                    gte(
                        deadlineRecurrenceExceptionsTable.recurrenceId,
                        recurrenceId,
                    ),
                ),
            )
        await tx
            .delete(deadlineCompletionsTable)
            .where(
                and(
                    eq(deadlineCompletionsTable.deadlineId, id),
                    gte(deadlineCompletionsTable.recurrenceId, recurrenceId),
                ),
            )
    })
}

export const remove = async (id: Deadline['id']): Promise<void> => {
    await db.delete(deadlinesTable).where(eq(deadlinesTable.id, id))
}
