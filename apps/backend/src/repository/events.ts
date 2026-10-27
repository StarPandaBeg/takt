import {
    and,
    asc,
    eq,
    gt,
    gte,
    isNotNull,
    isNull,
    like,
    lt,
    or,
} from 'drizzle-orm'
import { db } from '../database/index.js'
import {
    eventRecurrenceExceptionsTable,
    eventsTable,
    type Event,
    type EventInsert,
} from '../database/schema.js'

export interface EventFilters {
    readonly from?: Date | undefined
    readonly to?: Date | undefined
    readonly query?: string | undefined
    readonly limit?: number | undefined
}

export const getFiltered = async (filters: EventFilters): Promise<Event[]> => {
    const conditions = []
    if (filters.from !== undefined) {
        conditions.push(gte(eventsTable.start, filters.from))
    }
    if (filters.to !== undefined) {
        conditions.push(lt(eventsTable.start, filters.to))
    }
    if (filters.query !== undefined) {
        const pattern = `%${filters.query}%`
        conditions.push(
            or(
                like(eventsTable.title, pattern),
                like(eventsTable.description, pattern),
            )!,
        )
    }

    let query = db
        .select()
        .from(eventsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(eventsTable.start))
        .$dynamic()

    if (filters.limit !== undefined) query = query.limit(filters.limit)
    return await query.execute()
}

/** Returns point events inside the range and duration events overlapping it. */
export const getOverlapping = async (
    from: Date,
    to: Date,
): Promise<Event[]> => {
    return await db
        .select()
        .from(eventsTable)
        .where(
            or(
                isNotNull(eventsTable.recurrenceRule),
                and(
                    lt(eventsTable.start, to),
                    or(
                        gt(eventsTable.end, from),
                        and(
                            isNull(eventsTable.end),
                            gte(eventsTable.start, from),
                        ),
                    ),
                ),
            ),
        )
        .orderBy(asc(eventsTable.start))
}

export const get = async (id: Event['id']): Promise<Event | undefined> => {
    return await db.query.eventsTable.findFirst({ where: { id } })
}

export const create = async (data: EventInsert): Promise<Event['id']> => {
    const result = await db
        .insert(eventsTable)
        .values(data)
        .returning({ id: eventsTable.id })
    return result[0]!.id
}

export type UpdateEvent = {
    [
        K in keyof Pick<
            Event,
            | 'title'
            | 'description'
            | 'start'
            | 'end'
            | 'timezone'
            | 'allDay'
            | 'recurrenceRule'
        >
    ]?: Event[K] | undefined
}

export const edit = async (
    id: Event['id'],
    data: UpdateEvent,
): Promise<void> => {
    await db.transaction(async (tx) => {
        await tx.update(eventsTable).set(data).where(eq(eventsTable.id, id))
        if (
            data.start !== undefined ||
            data.end !== undefined ||
            data.timezone !== undefined ||
            data.recurrenceRule !== undefined
        ) {
            await tx
                .delete(eventRecurrenceExceptionsTable)
                .where(eq(eventRecurrenceExceptionsTable.eventId, id))
        }
    })
}

export const remove = async (id: Event['id']): Promise<void> => {
    await db.delete(eventsTable).where(eq(eventsTable.id, id))
}
