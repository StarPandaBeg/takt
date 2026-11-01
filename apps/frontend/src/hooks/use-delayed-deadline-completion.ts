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
        Map<string, { timer: NodeJS.Timeout; deadline: ResolvedDeadline }>
    >(new Map())

    // Очистка при размонтировании: если были таймеры, мгновенно завершаем их
    useEffect(() => {
        const timers = timersRef.current
        return () => {
            timers.forEach(({ timer, deadline }) => {
                clearTimeout(timer)
                void onComplete(deadline)
            })
            timers.clear()
        }
    }, [onComplete])

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

    const handleToggleDeadline = useCallback(
        (deadline: ResolvedDeadline) => {
            const key = getDeadlineKey(deadline)

            // Если дедлайн уже был выполнен — сразу возвращаем в активные с лоадером
            if (deadline.completed) {
                void executeComplete(deadline)
                return
            }

            // Если дедлайн сейчас в процессе отложенного завершения — отменяем
            if (timersRef.current.has(key)) {
                const item = timersRef.current.get(key)
                if (item) {
                    clearTimeout(item.timer)
                    timersRef.current.delete(key)
                }
                setCompletingKeys((prev) => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
                return
            }

            // Иначе инициируем отложенное завершение
            setCompletingKeys((prev) => new Set(prev).add(key))

            const timer = setTimeout(() => {
                timersRef.current.delete(key)
                setCompletingKeys((prev) => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
                void executeComplete(deadline)
            }, delayMs)

            timersRef.current.set(key, { timer, deadline })
        },
        [delayMs, executeComplete],
    )

    const handleCancelCompletion = useCallback((deadline: ResolvedDeadline) => {
        const key = getDeadlineKey(deadline)
        if (timersRef.current.has(key)) {
            const item = timersRef.current.get(key)
            if (item) {
                clearTimeout(item.timer)
                timersRef.current.delete(key)
            }
            setCompletingKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })
        }
    }, [])

    return {
        isCompleting,
        isSubmitting,
        handleToggleDeadline,
        handleCancelCompletion,
    }
}
