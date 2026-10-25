import {
    defineRelations,
    type InferInsertModel,
    type InferSelectModel,
} from 'drizzle-orm'
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
    ...timestamps,
})
export type Event = InferSelectModel<typeof eventsTable>
export type EventInsert = InferInsertModel<typeof eventsTable>

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
    completed: int({ mode: 'boolean' }).notNull().default(false),
    ...timestamps,
})
export type Deadline = InferSelectModel<typeof deadlinesTable>
export type DeadlineInsert = InferInsertModel<typeof deadlinesTable>

export const relations = defineRelations({
    eventsTable,
    notesTable,
    deadlinesTable,
})
