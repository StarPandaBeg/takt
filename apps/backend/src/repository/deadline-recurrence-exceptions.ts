import { db } from '#src/database/index.js'
import {
    deadlineRecurrenceExceptionsTable,
    type DeadlineRecurrenceException,
} from '#src/database/schema.js'
import { and, asc, eq, inArray } from 'drizzle-orm'

export async function getForDeadlineIds(
    deadlineIds: readonly number[],
): Promise<DeadlineRecurrenceException[]> {
    if (deadlineIds.length === 0) return []
    return await db
        .select()
        .from(deadlineRecurrenceExceptionsTable)
        .where(
            inArray(deadlineRecurrenceExceptionsTable.deadlineId, deadlineIds),
        )
        .orderBy(
            asc(deadlineRecurrenceExceptionsTable.deadlineId),
            asc(deadlineRecurrenceExceptionsTable.recurrenceId),
        )
}

export async function set(
    deadlineId: number,
    recurrenceId: Date,
    replacementDue: Date | null,
): Promise<void> {
    const now = new Date()
    await db
        .insert(deadlineRecurrenceExceptionsTable)
        .values({ deadlineId, recurrenceId, replacementDue })
        .onConflictDoUpdate({
            target: [
                deadlineRecurrenceExceptionsTable.deadlineId,
                deadlineRecurrenceExceptionsTable.recurrenceId,
            ],
            set: { replacementDue, updatedAt: now },
        })
}

export async function remove(
    deadlineId: number,
    recurrenceId: Date,
): Promise<void> {
    await db
        .delete(deadlineRecurrenceExceptionsTable)
        .where(
            and(
                eq(deadlineRecurrenceExceptionsTable.deadlineId, deadlineId),
                eq(
                    deadlineRecurrenceExceptionsTable.recurrenceId,
                    recurrenceId,
                ),
            ),
        )
}
