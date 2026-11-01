import { Loader2 } from 'lucide-react'

export function LoadingIndicator({
    message = 'Загрузка...',
}: {
    message?: string
}) {
    return (
        <div className="loading-state">
            <Loader2 size={24} className="loading-spinner" />
            <span>{message}</span>
        </div>
    )
}
