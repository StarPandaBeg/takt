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
    const [revertingIds, setRevertingIds] = useState<Set<number>>(
        () => new Set(),
    )
    const timersRef = useRef<
        Map<
            number,
            {
                timer: NodeJS.Timeout
                completedNote: Note
                completion: Promise<void>
            }
        >
    >(new Map())

    // The mutation has already been sent; unmounting only closes the undo UI.
    useEffect(() => {
        const timers = timersRef.current
        return () => {
            timers.forEach(({ timer }) => clearTimeout(timer))
            timers.clear()
        }
    }, [])

    const isCompleting = useCallback(
        (id: number) => completingIds.has(id),
        [completingIds],
    )

    const isSubmitting = useCallback(
        (id: number) => submittingIds.has(id),
        [submittingIds],
    )

    const isReverting = useCallback(
        (id: number) => revertingIds.has(id),
        [revertingIds],
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

    const handleCancelCompletion = useCallback(
        (note: Note) => {
            const id = note.id
            const pending = timersRef.current.get(id)
            if (pending === undefined) return

            clearTimeout(pending.timer)
            timersRef.current.delete(id)
            setCompletingIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
            setRevertingIds((prev) => new Set(prev).add(id))

            // Serialize the compensating mutation after completion so a fast
            // undo cannot be reordered ahead of the original request.
            void pending.completion
                .then(() => executeComplete(pending.completedNote, true))
                .catch(() => undefined)
                .finally(() => {
                    setRevertingIds((prev) => {
                        const next = new Set(prev)
                        next.delete(id)
                        return next
                    })
                })
        },
        [executeComplete],
    )

    const handleToggleNote = useCallback(
        (note: Note) => {
            const id = note.id

            // A second click during the undo window reverts the saved change.
            if (timersRef.current.has(id)) {
                handleCancelCompletion(note)
                return
            }

            // A completed note returns to the active list immediately while
            // the compensating request is in progress.
            if (note.completedAt !== null) {
                setRevertingIds((prev) => new Set(prev).add(id))
                void executeComplete(note, true)
                    .catch(() => undefined)
                    .finally(() => {
                        setRevertingIds((prev) => {
                            const next = new Set(prev)
                            next.delete(id)
                            return next
                        })
                    })
                return
            }

            // Persist immediately and keep only the undo affordance delayed.
            setCompletingIds((prev) => new Set(prev).add(id))
            const completedNote: Note = {
                ...note,
                completedAt: new Date().toISOString(),
            }
            const completion = executeComplete(note, false)

            const timer = setTimeout(() => {
                timersRef.current.delete(id)
                setCompletingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
            }, delayMs)

            timersRef.current.set(id, {
                timer,
                completedNote,
                completion,
            })
            void completion.catch(() => {
                const pending = timersRef.current.get(id)
                if (pending?.completion !== completion) return
                clearTimeout(pending.timer)
                timersRef.current.delete(id)
                setCompletingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
            })
        },
        [delayMs, executeComplete, handleCancelCompletion],
    )

    return {
        isCompleting,
        isSubmitting,
        isReverting,
        handleToggleNote,
        handleCancelCompletion,
    }
}
