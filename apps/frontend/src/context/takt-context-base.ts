import { createContext } from 'react'
import type { OccurrenceRange } from '../lib/date'
import type {
    ApplicationSettings,
    CancelDeadlinePayload,
    CancelEventPayload,
    CreateDeadlinePayload,
    CreateEventPayload,
    DeadlineEntity,
    Note,
    ResolvedDeadline,
    ResolvedEvent,
    UpdateDeadlinePayload,
    UpdateEventPayload,
    UpdateNotePayload,
    UpdateSettingsPayload,
} from '../types/api'

export interface TaktContextValue {
    // Данные
    events: ResolvedEvent[]
    deadlines: ResolvedDeadline[]
    masterDeadlines: DeadlineEntity[]
    notes: Note[]
    settings: ApplicationSettings

    // Состояния загрузки и ошибок
    isLoading: boolean
    error: string | null
    isServerConnected: boolean
    screenRevision: number

    // Методы обновления
    refreshAll: () => Promise<void>
    refreshEvents: (range?: OccurrenceRange) => Promise<void>
    refreshDeadlines: (range?: OccurrenceRange) => Promise<void>
    refreshNotes: () => Promise<void>
    refreshScreen: () => void
    updateSettings: (
        payload: UpdateSettingsPayload,
    ) => Promise<ApplicationSettings>
    clearError: () => void

    // Мутации событий
    createEvent: (payload: CreateEventPayload) => Promise<void>
    updateEvent: (id: number, payload: UpdateEventPayload) => Promise<void>
    cancelEvent: (id: number, payload: CancelEventPayload) => Promise<void>
    deleteEvent: (id: number) => Promise<void>

    // Мутации дедлайнов
    createDeadline: (payload: CreateDeadlinePayload) => Promise<void>
    updateDeadline: (
        id: number,
        payload: UpdateDeadlinePayload,
    ) => Promise<void>
    toggleDeadline: (deadline: ResolvedDeadline) => Promise<void>
    cancelDeadline: (
        id: number,
        payload: CancelDeadlinePayload,
    ) => Promise<void>
    deleteDeadline: (id: number) => Promise<void>

    // Мутации заметок
    createNote: (text: string) => Promise<void>
    updateNote: (id: number, payload: UpdateNotePayload) => Promise<void>
    toggleNote: (note: Note) => Promise<void>
    deleteNote: (id: number) => Promise<void>
}

export const TaktContext = createContext<TaktContextValue | null>(null)
