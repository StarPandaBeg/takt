import { AlertTriangle } from 'lucide-react'
import { Modal } from './modal'

interface ConfirmDialogProps {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    isDanger?: boolean
    onConfirm: () => void
    onClose: () => void
}

export function ConfirmDialog({
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    isDanger = true,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    return (
        <Modal title={title} onClose={onClose}>
            <div className="confirm-dialog-content">
                <div className="confirm-dialog-message">
                    {isDanger && (
                        <div className="confirm-dialog-icon">
                            <AlertTriangle size={24} />
                        </div>
                    )}
                    <p>{message}</p>
                </div>
                <div className="form__actions form__actions--end">
                    <button
                        className="button button--quiet"
                        type="button"
                        onClick={onClose}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={`button ${isDanger ? 'button--danger' : 'button--primary'}`}
                        type="button"
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
