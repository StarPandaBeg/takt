import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note } from '../types/api'

interface UseDelayedNoteCompletionOptions {
    onComplete: (note: Note) => Promise<void>
    onRevert?: (note: Note) => Promise<void>
    delayMs?: number
}

export function useDelayedNoteCompletion({
    onComplete,
    onRevert,
    delayMs = 5000,
}: UseDelayedNoteCompletionOptions) {
    const [completingIds, setCompletingIds] = useState<Set<number>>(
        () => new Set(),
    )
    const [submittingIds, setSubmittingIds] = useState<Set<number>>(
        () => new Set(),
    )
    const timersRef = useRef<
        Map<number, { timer: NodeJS.Timeout; note: Note }>
    >(new Map())

    // Очистка при размонтировании: если были таймеры, мгновенно завершаем их
    useEffect(() => {
        const timers = timersRef.current
        return () => {
            timers.forEach(({ timer, note }) => {
                clearTimeout(timer)
                void onComplete(note)
            })
            timers.clear()
        }
    }, [onComplete])

    const isCompleting = useCallback(
        (id: number) => completingIds.has(id),
        [completingIds],
    )

    const isSubmitting = useCallback(
        (id: number) => submittingIds.has(id),
        [submittingIds],
    )

    const executeComplete = useCallback(
        async (note: Note, isRevert: boolean) => {
            setSubmittingIds((prev) => new Set(prev).add(note.id))
            try {
                if (isRevert && onRevert) {
                    await onRevert(note)
                } else {
                    await onComplete(note)
                }
            } finally {
                setSubmittingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(note.id)
                    return next
                })
            }
        },
        [onComplete, onRevert],
    )

    const handleToggleNote = useCallback(
        (note: Note) => {
            const id = note.id

            // Если заметка уже была выполнена в БД — сразу возвращаем её в активные
            if (note.completedAt !== null) {
                void executeComplete(note, true)
                return
            }

            // Если заметка сейчас в процессе отложенного завершения — отменяем
            if (timersRef.current.has(id)) {
                const item = timersRef.current.get(id)
                if (item) {
                    clearTimeout(item.timer)
                    timersRef.current.delete(id)
                }
                setCompletingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
                return
            }

            // Иначе инициируем отложенное завершение
            setCompletingIds((prev) => new Set(prev).add(id))

            const timer = setTimeout(() => {
                timersRef.current.delete(id)
                setCompletingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
                void executeComplete(note, false)
            }, delayMs)

            timersRef.current.set(id, { timer, note })
        },
        [delayMs, executeComplete],
    )

    const handleCancelCompletion = useCallback((note: Note) => {
        const id = note.id
        if (timersRef.current.has(id)) {
            const item = timersRef.current.get(id)
            if (item) {
                clearTimeout(item.timer)
                timersRef.current.delete(id)
            }
            setCompletingIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }, [])

    return {
        isCompleting,
        isSubmitting,
        handleToggleNote,
        handleCancelCompletion,
    }
}
