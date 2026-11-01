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

    const handleToggleNote = useCallback(
        (note: Note) => {
            const id = note.id

            // Если заметка уже была выполнена в БД — сразу возвращаем её в активные
            if (note.completedAt !== null) {
                if (onRevert) {
                    void onRevert(note)
                } else {
                    void onComplete(note)
                }
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
                void onComplete(note)
            }, delayMs)

            timersRef.current.set(id, { timer, note })
        },
        [delayMs, onComplete, onRevert],
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
        handleToggleNote,
        handleCancelCompletion,
    }
}
