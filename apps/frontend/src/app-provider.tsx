import type { PropsWithChildren } from 'react'
import { TaktProvider } from './context/takt-context'
import { ToastProvider } from './context/toast-context'

export function AppProvider({ children }: PropsWithChildren) {
    return (
        <ToastProvider>
            <TaktProvider>{children}</TaktProvider>
        </ToastProvider>
    )
}
