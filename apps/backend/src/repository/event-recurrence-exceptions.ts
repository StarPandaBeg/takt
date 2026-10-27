import { db } from '#/database/index.js'
import {
    eventRecurrenceExceptionsTable,
    type EventRecurrenceException,
} from '#/database/schema.js'
import { and, asc, eq, inArray } from 'drizzle-orm'

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
    replacement?: {
        readonly title: string
        readonly description: string | null
        readonly timezone: string | null
        readonly allDay: boolean
    },
): Promise<void> {
    await db
        .insert(eventRecurrenceExceptionsTable)
        .values({
            eventId,
            recurrenceId,
            replacementStart,
            replacementEnd,
            replacementTitle: replacement?.title,
            replacementDescription: replacement?.description,
            replacementTimezone: replacement?.timezone,
            replacementAllDay: replacement?.allDay,
        })
        .onConflictDoUpdate({
            target: [
                eventRecurrenceExceptionsTable.eventId,
                eventRecurrenceExceptionsTable.recurrenceId,
            ],
            set: {
                replacementStart,
                replacementEnd,
                replacementTitle: replacement?.title ?? null,
                replacementDescription: replacement?.description ?? null,
                replacementTimezone: replacement?.timezone ?? null,
                replacementAllDay: replacement?.allDay ?? null,
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
