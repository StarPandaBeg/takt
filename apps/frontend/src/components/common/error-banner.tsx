import { AlertCircle, RefreshCw, X } from 'lucide-react'

interface ErrorBannerProps {
    message: string
    onRetry?: () => void
    onDismiss?: () => void
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
    if (!message) return null

    return (
        <div className="error-banner" role="alert">
            <div className="error-banner__content">
                <AlertCircle size={18} className="error-banner__icon" />
                <span className="error-banner__text">{message}</span>
            </div>
            <div className="error-banner__actions">
                {onRetry && (
                    <button
                        type="button"
                        className="button button--small button--quiet"
                        onClick={onRetry}
                    >
                        <RefreshCw size={14} /> Повторить
                    </button>
                )}
                {onDismiss && (
                    <button
                        type="button"
                        className="icon-button"
                        onClick={onDismiss}
                        aria-label="Закрыть уведомление"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    )
}
