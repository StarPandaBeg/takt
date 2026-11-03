import { QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { TaktProvider } from './context/takt-context'
import { ToastProvider } from './context/toast-context'
import { queryClient } from './lib/query-client'

export function AppProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <TaktProvider>{children}</TaktProvider>
            </ToastProvider>
        </QueryClientProvider>
    )
}
