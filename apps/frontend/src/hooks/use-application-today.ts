import { useEffect, useRef, useState } from 'react'
import { Temporal } from 'temporal-polyfill'

import { getTodayIso } from '../lib/date'

type DayChangeHandler = (today: string, previousToday: string) => void

function millisecondsUntilNextDay(timezone: string): number {
    const now = Temporal.Now.zonedDateTimeISO(timezone)
    return (
        now.add({ days: 1 }).startOfDay().epochMilliseconds -
        now.epochMilliseconds
    )
}

/** Keeps the application calendar day synchronized with its configured timezone. */
export function useApplicationToday(
    timezone: string,
    onDayChange?: DayChangeHandler,
): string {
    const [today, setToday] = useState(() => getTodayIso(timezone))
    const todayRef = useRef(today)
    const onDayChangeRef = useRef(onDayChange)

    useEffect(() => {
        onDayChangeRef.current = onDayChange
    }, [onDayChange])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined

        const refreshToday = () => {
            const nextToday = getTodayIso(timezone)
            const previousToday = todayRef.current
            if (nextToday === previousToday) return

            todayRef.current = nextToday
            setToday(nextToday)
            onDayChangeRef.current?.(nextToday, previousToday)
        }

        const scheduleRollover = () => {
            if (timer !== undefined) clearTimeout(timer)
            timer = setTimeout(
                () => {
                    refreshToday()
                    scheduleRollover()
                },
                millisecondsUntilNextDay(timezone) + 250,
            )
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return
            refreshToday()
            scheduleRollover()
        }
        const handleFocus = () => {
            refreshToday()
            scheduleRollover()
        }

        scheduleRollover()
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleFocus)
        return () => {
            if (timer !== undefined) clearTimeout(timer)
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            )
            window.removeEventListener('focus', handleFocus)
        }
    }, [timezone])

    return today
}
