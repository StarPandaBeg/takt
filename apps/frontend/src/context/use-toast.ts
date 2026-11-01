import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
    id: string
    message: string
    type: ToastType
}

export interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
