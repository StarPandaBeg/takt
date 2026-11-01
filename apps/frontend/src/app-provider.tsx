import type { PropsWithChildren } from 'react'
import { TaktProvider } from './context/takt-context'

export function AppProvider({ children }: PropsWithChildren) {
    return <TaktProvider>{children}</TaktProvider>
}
