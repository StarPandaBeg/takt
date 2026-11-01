import { X } from 'lucide-react'
import { useEffect, type PropsWithChildren } from 'react'

export function Modal({
    title,
    onClose,
    children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) =>
            event.key === 'Escape' && onClose()
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={onClose}
        >
            <section
                className="modal panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="modal__header">
                    <h2 id="modal-title">{title}</h2>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        <X size={18} />
                    </button>
                </header>
                {children}
            </section>
        </div>
    )
}
