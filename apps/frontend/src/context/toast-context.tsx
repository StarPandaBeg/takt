import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { ToastContext, type ToastItem, type ToastType } from './use-toast'

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const showToast = useCallback(
        (message: string, type: ToastType = 'info') => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            const newToast: ToastItem = { id, message, type }

            setToasts((prev) => [...prev.slice(-4), newToast])

            setTimeout(() => {
                removeToast(id)
            }, 3500)
        },
        [removeToast],
    )

    const success = useCallback(
        (message: string) => showToast(message, 'success'),
        [showToast],
    )
    const error = useCallback(
        (message: string) => showToast(message, 'error'),
        [showToast],
    )
    const info = useCallback(
        (message: string) => showToast(message, 'info'),
        [showToast],
    )

    const value = useMemo(
        () => ({ showToast, success, error, info }),
        [showToast, success, error, info],
    )

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                className="toast-container"
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`toast toast--${toast.type}`}
                        role="alert"
                    >
                        <div className="toast__icon">
                            {toast.type === 'success' && (
                                <CheckCircle2 size={16} />
                            )}
                            {toast.type === 'error' && (
                                <AlertCircle size={16} />
                            )}
                            {toast.type === 'info' && <Info size={16} />}
                        </div>
                        <span className="toast__message">{toast.message}</span>
                        <button
                            type="button"
                            className="toast__close"
                            onClick={() => removeToast(toast.id)}
                            aria-label="Закрыть уведомление"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
