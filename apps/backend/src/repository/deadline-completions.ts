import { db } from '#src/database/index.js'
import {
    deadlineCompletionsTable,
    type DeadlineCompletion,
} from '#src/database/schema.js'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

export async function getForDeadlineIds(
    deadlineIds: readonly number[],
): Promise<DeadlineCompletion[]> {
    if (deadlineIds.length === 0) return []
    return await db
        .select()
        .from(deadlineCompletionsTable)
        .where(inArray(deadlineCompletionsTable.deadlineId, deadlineIds))
        .orderBy(
            asc(deadlineCompletionsTable.deadlineId),
            asc(deadlineCompletionsTable.recurrenceId),
        )
}

function occurrenceCondition(deadlineId: number, recurrenceId: Date | null) {
    return and(
        eq(deadlineCompletionsTable.deadlineId, deadlineId),
        recurrenceId === null
            ? isNull(deadlineCompletionsTable.recurrenceId)
            : eq(deadlineCompletionsTable.recurrenceId, recurrenceId),
    )
}

export async function set(
    deadlineId: number,
    recurrenceId: Date | null,
    completedAt: Date,
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .insert(deadlineCompletionsTable)
            .values({ deadlineId, recurrenceId, completedAt })
            .onConflictDoNothing()
        await tx
            .update(deadlineCompletionsTable)
            .set({ completedAt })
            .where(occurrenceCondition(deadlineId, recurrenceId))
    })
}

export async function remove(
    deadlineId: number,
    recurrenceId: Date | null,
): Promise<void> {
    await db
        .delete(deadlineCompletionsTable)
        .where(occurrenceCondition(deadlineId, recurrenceId))
}
