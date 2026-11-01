export * from './api'

// Вспомогательные типы для форм и UI компонентов
export type CreateKind = 'event' | 'deadline' | 'note'

export interface EventFormData {
    title: string
    description: string
    date: string // YYYY-MM-DD
    allDay: boolean
    start: string // HH:mm
    end: string // HH:mm or ''
    timezone: string
    isRecurring: boolean
    recurrence: import('./api').Recurrence | null
    scope?: import('./api').UpdateScope
}

export interface DeadlineFormData {
    title: string
    description: string
    date: string // YYYY-MM-DD
    time: string // HH:mm
    dueIsDate: boolean
    timezone: string
    visibilityShowType: 'always' | 'before'
    visibilityShowDays: number
    visibilityHide: 'on_due' | 'on_complete'
    isRecurring: boolean
    recurrence: import('./api').Recurrence | null
    scope?: import('./api').UpdateScope
    completed?: boolean
}
