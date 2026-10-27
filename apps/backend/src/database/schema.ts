import {
    defineRelations,
    type InferInsertModel,
    type InferSelectModel,
} from 'drizzle-orm'
import { int, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
    createdAt: int('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: int('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date()),
}

export const eventsTable = sqliteTable('events', {
    id: int().primaryKey({ autoIncrement: true }),
    title: text().notNull(),
    description: text(),
    start: int({ mode: 'timestamp_ms' }).notNull(),
    end: int({ mode: 'timestamp_ms' }),
    timezone: text().default('Europe/Moscow'),
    allDay: int({ mode: 'boolean' }).notNull().default(false),
    recurrenceRule: text('recurrence_rule'),
    cancelledAt: int('cancelled_at', { mode: 'timestamp_ms' }),
    ...timestamps,
})
export type Event = InferSelectModel<typeof eventsTable>
export type EventInsert = InferInsertModel<typeof eventsTable>

export const eventRecurrenceExceptionsTable = sqliteTable(
    'event_recurrence_exceptions',
    {
        id: int().primaryKey({ autoIncrement: true }),
        eventId: int('event_id')
            .notNull()
            .references(() => eventsTable.id, { onDelete: 'cascade' }),
        recurrenceId: int('recurrence_id', { mode: 'timestamp_ms' }).notNull(),
        replacementStart: int('replacement_start', { mode: 'timestamp_ms' }),
        replacementEnd: int('replacement_end', { mode: 'timestamp_ms' }),
        replacementTitle: text('replacement_title'),
        replacementDescription: text('replacement_description'),
        replacementTimezone: text('replacement_timezone'),
        replacementAllDay: int('replacement_all_day', { mode: 'boolean' }),
        ...timestamps,
    },
    (table) => [
        uniqueIndex('event_recurrence_exception_occurrence_unique').on(
            table.eventId,
            table.recurrenceId,
        ),
    ],
)
export type EventRecurrenceException = InferSelectModel<
    typeof eventRecurrenceExceptionsTable
>

export const notesTable = sqliteTable('notes', {
    id: int().primaryKey({ autoIncrement: true }),
    text: text().notNull(),
    completed_at: int({ mode: 'timestamp_ms' }),
    ...timestamps,
})
export type Note = InferSelectModel<typeof notesTable>
export type NoteInsert = InferInsertModel<typeof notesTable>

export const deadlinesTable = sqliteTable('deadlines', {
    id: int().primaryKey({ autoIncrement: true }),
    title: text().notNull(),
    description: text(),
    due: int({ mode: 'timestamp_ms' }).notNull(),
    dueIsDate: int('due_is_date', { mode: 'boolean' }).notNull().default(false),
    timezone: text().notNull().default('Europe/Moscow'),
    recurrenceRule: text('recurrence_rule'),
    completed: int({ mode: 'boolean' }).notNull().default(false),
    ...timestamps,
})
export type Deadline = InferSelectModel<typeof deadlinesTable>
export type DeadlineInsert = InferInsertModel<typeof deadlinesTable>

export const deadlineRecurrenceExceptionsTable = sqliteTable(
    'deadline_recurrence_exceptions',
    {
        id: int().primaryKey({ autoIncrement: true }),
        deadlineId: int('deadline_id')
            .notNull()
            .references(() => deadlinesTable.id, { onDelete: 'cascade' }),
        recurrenceId: int('recurrence_id', { mode: 'timestamp_ms' }).notNull(),
        replacementDue: int('replacement_due', { mode: 'timestamp_ms' }),
        ...timestamps,
    },
    (table) => [
        uniqueIndex('deadline_recurrence_exception_occurrence_unique').on(
            table.deadlineId,
            table.recurrenceId,
        ),
    ],
)
export type DeadlineRecurrenceException = InferSelectModel<
    typeof deadlineRecurrenceExceptionsTable
>
export type DeadlineRecurrenceExceptionInsert = InferInsertModel<
    typeof deadlineRecurrenceExceptionsTable
>

export const versionsTable = sqliteTable('versions', {
    key: text().primaryKey(),
    value: int().notNull().default(0),
})
export type Version = InferSelectModel<typeof versionsTable>
export type VersionInsert = InferInsertModel<typeof versionsTable>

export const relations = defineRelations({
    eventsTable,
    eventRecurrenceExceptionsTable,
    notesTable,
    deadlinesTable,
    deadlineRecurrenceExceptionsTable,
    versionsTable,
})
