import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../database/index.js'
import {
    eventRecurrenceExceptionsTable,
    type EventRecurrenceException,
} from '../database/schema.js'

export async function getForEventIds(
    eventIds: readonly number[],
): Promise<EventRecurrenceException[]> {
    if (eventIds.length === 0) return []
    return await db
        .select()
        .from(eventRecurrenceExceptionsTable)
        .where(inArray(eventRecurrenceExceptionsTable.eventId, eventIds))
        .orderBy(
            asc(eventRecurrenceExceptionsTable.eventId),
            asc(eventRecurrenceExceptionsTable.recurrenceId),
        )
}

export async function set(
    eventId: number,
    recurrenceId: Date,
    replacementStart: Date | null,
    replacementEnd: Date | null,
): Promise<void> {
    await db
        .insert(eventRecurrenceExceptionsTable)
        .values({ eventId, recurrenceId, replacementStart, replacementEnd })
        .onConflictDoUpdate({
            target: [
                eventRecurrenceExceptionsTable.eventId,
                eventRecurrenceExceptionsTable.recurrenceId,
            ],
            set: {
                replacementStart,
                replacementEnd,
                updatedAt: new Date(),
            },
        })
}

export async function remove(
    eventId: number,
    recurrenceId: Date,
): Promise<void> {
    await db
        .delete(eventRecurrenceExceptionsTable)
        .where(
            and(
                eq(eventRecurrenceExceptionsTable.eventId, eventId),
                eq(eventRecurrenceExceptionsTable.recurrenceId, recurrenceId),
            ),
        )
}
