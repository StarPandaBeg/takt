import { useContext } from 'react'
import { TaktContext, type TaktContextValue } from './takt-context-base'

export function useTakt(): TaktContextValue {
    const context = useContext(TaktContext)
    if (!context) {
        throw new Error('useTakt must be used within a TaktProvider')
    }
    return context
}

export type { TaktContextValue }
