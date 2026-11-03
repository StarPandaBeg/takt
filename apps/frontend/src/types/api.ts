// Типы и интерфейсы API Takt, полностью соответствующие API.md

export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface RecurrenceDaily {
    frequency: 'daily'
    interval?: number // 1..1000
    count?: number
    until?: string // ISO 8601 string
}

export interface RecurrenceWeekly {
    frequency: 'weekly'
    weekdays: Weekday[] // 1..7 unique days
    interval?: number
    count?: number
    until?: string
}

export interface RecurrenceMonthlyDate {
    frequency: 'monthly-date'
    day: number // 1..31
    interval?: number
    count?: number
    until?: string
}

export interface RecurrenceMonthlyWeekday {
    frequency: 'monthly-weekday'
    weekday: Weekday
    occurrence: 1 | 2 | 3 | 4 | 5 | -1
    interval?: number
    count?: number
    until?: string
}

export interface RecurrenceYearly {
    frequency: 'yearly'
    interval?: number
    count?: number
    until?: string
}

export type Recurrence =
    | RecurrenceDaily
    | RecurrenceWeekly
    | RecurrenceMonthlyDate
    | RecurrenceMonthlyWeekday
    | RecurrenceYearly

export type UpdateScope = 'series' | 'occurrence' | 'this_and_future'

export interface ApplicationSettings {
    timezone: string
}

export interface UpdateSettingsPayload {
    timezone?: string
}

// --- Notes ---

export interface Note {
    id: number
    text: string
    completedAt: string | null
}

export interface CreateNotePayload {
    text: string
}

export interface UpdateNotePayload {
    text?: string
    completedAt?: string | null
}

export interface ListNotesQuery {
    limit?: number
    withDone?: boolean
}

// --- Events ---

export type EventOccurrenceException =
    | { recurrenceId: string; status: 'cancelled' }
    | {
          recurrenceId: string
          status: 'rescheduled'
          start: string
          end: string | null
      }
    | {
          recurrenceId: string
          status: 'updated'
          title: string
          description: string | null
          start: string
          end: string | null
          timezone: string | null
          allDay: boolean
      }

export interface EventEntity {
    id: number
    title: string
    description: string | null
    start: string
    end: string | null
    timezone: string | null
    allDay: boolean
    cancelledAt: string | null
    createdAt: string
    updatedAt: string
    recurrence: Recurrence | null
    exceptions: EventOccurrenceException[]
}

export interface ResolvedEvent {
    id: number
    title: string
    description: string | null
    start: string
    end: string | null
    timezone: string | null
    allDay: boolean
    recurrenceId: string | null
}

export interface CreateEventPayload {
    title: string
    description?: string | null
    start: string
    end?: string | null
    timezone?: string | null
    allDay?: boolean
    recurrence?: Recurrence | null
}

export interface UpdateEventChanges {
    title?: string
    description?: string | null
    start?: string
    end?: string | null
    timezone?: string | null
    allDay?: boolean
    recurrence?: Recurrence | null
}

export interface UpdateEventPayload {
    scope?: UpdateScope
    recurrenceId?: string
    changes: UpdateEventChanges
}

export interface CancelEventPayload {
    scope: UpdateScope
    recurrenceId?: string
}

export interface EventOccurrenceListQuery {
    from: string
    to: string
    limit?: number
}

export interface EventSearchQuery {
    from?: string
    to?: string
    query?: string
    limit?: number
}

// --- Deadlines ---

export interface DeadlineVisibility {
    show: { type: 'always' } | { type: 'before'; days: number }
    hide: 'on_due' | 'on_complete'
}

export interface DeadlineCompletion {
    recurrenceId: string | null
    completedAt: string
}

export type DeadlineOccurrenceException =
    | { recurrenceId: string; status: 'cancelled' }
    | { recurrenceId: string; status: 'rescheduled'; due: string }
    | {
          recurrenceId: string
          status: 'updated'
          title: string
          description: string | null
          due: string
          dueIsDate: boolean
          timezone: string
      }

export interface DeadlineEntity {
    id: number
    title: string
    description: string | null
    due: string
    dueIsDate: boolean
    timezone: string
    cancelledAt: string | null
    createdAt: string
    updatedAt: string
    recurrence: Recurrence | null
    visibility: DeadlineVisibility
    completedAt: string | null
    completions: DeadlineCompletion[]
    exceptions: DeadlineOccurrenceException[]
}

export interface ResolvedDeadline {
    id: number
    title: string
    description: string | null
    due: string
    dueIsDate: boolean
    timezone: string
    completed: boolean
    completedAt: string | null
    recurrenceId: string | null
    visibility: DeadlineVisibility
}

export interface CreateDeadlinePayload {
    title: string
    description?: string | null
    due: string
    dueIsDate?: boolean
    timezone?: string
    completed?: boolean
    recurrence?: Recurrence | null
    visibility?: DeadlineVisibility
}

export interface UpdateDeadlineChanges {
    title?: string
    description?: string | null
    due?: string
    dueIsDate?: boolean
    timezone?: string
    recurrence?: Recurrence | null
    visibility?: DeadlineVisibility
}

export interface UpdateDeadlinePayload {
    scope?: UpdateScope
    recurrenceId?: string
    changes: UpdateDeadlineChanges
}

export interface CancelDeadlinePayload {
    scope: UpdateScope
    recurrenceId?: string
}

export interface SetDeadlineCompletionPayload {
    recurrenceId?: string
    completed: boolean
}

export interface DeadlineListQuery {
    from?: string
    to?: string
    query?: string
    limit?: number
    withCompleted?: boolean
}

export interface DeadlineOccurrenceListQuery {
    from: string
    to: string
    limit?: number
    withCompleted?: boolean
}

// --- Screens ---

export interface ScreenInfo {
    width: number
    height: number
    hash: string
}

export interface ScreenChange {
    name: 'main' | 'splash'
    hash: string
}
