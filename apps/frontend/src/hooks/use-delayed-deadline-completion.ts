import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResolvedDeadline } from '../types/api'

interface UseDelayedDeadlineCompletionOptions {
    onComplete: (deadline: ResolvedDeadline) => Promise<void>
    delayMs?: number
}

export function getDeadlineKey(deadline: ResolvedDeadline): string {
    return `${deadline.id}:${deadline.recurrenceId ?? 'master'}`
}

export function useDelayedDeadlineCompletion({
    onComplete,
    delayMs = 5000,
}: UseDelayedDeadlineCompletionOptions) {
    const [completingKeys, setCompletingKeys] = useState<Set<string>>(
        () => new Set(),
    )
    const [submittingKeys, setSubmittingKeys] = useState<Set<string>>(
        () => new Set(),
    )
    const timersRef = useRef<
        Map<
            string,
            {
                timer: NodeJS.Timeout
                completedDeadline: ResolvedDeadline
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
        (deadlineOrKey: ResolvedDeadline | string) => {
            const key =
                typeof deadlineOrKey === 'string'
                    ? deadlineOrKey
                    : getDeadlineKey(deadlineOrKey)
            return completingKeys.has(key)
        },
        [completingKeys],
    )

    const isSubmitting = useCallback(
        (deadlineOrKey: ResolvedDeadline | string) => {
            const key =
                typeof deadlineOrKey === 'string'
                    ? deadlineOrKey
                    : getDeadlineKey(deadlineOrKey)
            return submittingKeys.has(key)
        },
        [submittingKeys],
    )

    const executeComplete = useCallback(
        async (deadline: ResolvedDeadline) => {
            const key = getDeadlineKey(deadline)
            setSubmittingKeys((prev) => new Set(prev).add(key))
            try {
                await onComplete(deadline)
            } finally {
                setSubmittingKeys((prev) => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            }
        },
        [onComplete],
    )

    const handleCancelCompletion = useCallback(
        (deadline: ResolvedDeadline) => {
            const key = getDeadlineKey(deadline)
            const pending = timersRef.current.get(key)
            if (pending === undefined) return

            clearTimeout(pending.timer)
            timersRef.current.delete(key)
            setCompletingKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })

            void pending.completion
                .then(() => executeComplete(pending.completedDeadline))
                .catch(() => undefined)
        },
        [executeComplete],
    )

    const handleToggleDeadline = useCallback(
        (deadline: ResolvedDeadline) => {
            const key = getDeadlineKey(deadline)

            // Если дедлайн уже был выполнен — сразу возвращаем в активные с лоадером
            if (deadline.completed) {
                void executeComplete(deadline).catch(() => undefined)
                return
            }

            if (timersRef.current.has(key)) {
                handleCancelCompletion(deadline)
                return
            }

            setCompletingKeys((prev) => new Set(prev).add(key))
            const completedDeadline: ResolvedDeadline = {
                ...deadline,
                completed: true,
                completedAt: new Date().toISOString(),
            }
            const completion = executeComplete(deadline)

            const timer = setTimeout(() => {
                timersRef.current.delete(key)
                setCompletingKeys((prev) => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            }, delayMs)

            timersRef.current.set(key, {
                timer,
                completedDeadline,
                completion,
            })
            void completion.catch(() => {
                const pending = timersRef.current.get(key)
                if (pending?.completion !== completion) return
                clearTimeout(pending.timer)
                timersRef.current.delete(key)
                setCompletingKeys((prev) => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            })
        },
        [delayMs, executeComplete, handleCancelCompletion],
    )

    return {
        isCompleting,
        isSubmitting,
        handleToggleDeadline,
        handleCancelCompletion,
    }
}
