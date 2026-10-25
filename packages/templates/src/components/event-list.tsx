import { Column, Group, Rect, Text, type FlexProps } from '@takt/ui/components'
import { DateTime, Interval } from 'luxon'

export interface Event {
    start: DateTime
    end?: DateTime
    text: string
}

export interface EventListProps extends FlexProps {
    events: Event[]
    now: DateTime
    limit?: number
}

export type EventState = 'default' | 'active' | 'disabled'

interface EventRowProps {
    event: Event
    state?: EventState
}

export function getEventState(event: Event, now: DateTime): EventState {
    const periodStart = event.start.minus({ minutes: 15 })
    const periodEnd = event.end ?? event.start.plus({ minutes: 15 })
    const isActive = Interval.fromDateTimes(periodStart, periodEnd).contains(
        now,
    )
    if (isActive) return 'active'
    return now.toMillis() >= periodEnd.toMillis() ? 'disabled' : 'default'
}

function getDisplayEnd(event: Event): DateTime {
    return event.end ?? event.start.plus({ minutes: 15 })
}

/** Selects a chronological window that follows the current point in the day. */
export function selectEventsForScreen(
    events: readonly Event[],
    now: DateTime,
    limit?: number,
): Event[] {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
        throw new RangeError('Event limit must be a non-negative integer')
    }

    const sorted = [...events].sort(
        (left, right) => left.start.toMillis() - right.start.toMillis(),
    )
    if (limit === undefined || sorted.length <= limit) return sorted
    if (limit === 0) return []

    const firstCurrentOrFuture = sorted.findIndex(
        (event) => getDisplayEnd(event).toMillis() > now.toMillis(),
    )
    const preferredStart =
        firstCurrentOrFuture === -1 ? sorted.length - limit : firstCurrentOrFuture
    const start = Math.min(preferredStart, sorted.length - limit)
    return sorted.slice(start, start + limit)
}

function EventRow({ event, state, ...props }: EventRowProps) {
    const lineWidth = state == 'active' ? 4 : 2
    const color = state == 'disabled' ? 'gray_50' : 'black'

    const timeText =
        event.end == undefined
            ? `${event.start.toFormat('HH:mm')}`
            : `${event.start.toFormat('HH:mm')}-${event.end.toFormat('HH:mm')}`

    return (
        <Group {...props}>
            <Rect
                x={4 - lineWidth / 2}
                width={lineWidth}
                height={20}
                fill
                fillColor={color}
            />
            <Text
                x={12}
                height={20}
                alignVertical="center"
                fontSize={20}
                color={color}
                fontWeight={state == 'active' ? 600 : 400}
            >
                {timeText}
            </Text>
            <Text
                x={140}
                height={20}
                alignVertical="center"
                fontSize={20}
                color={color}
                fontWeight={state == 'active' ? 600 : 400}
            >
                {event.text}
            </Text>
        </Group>
    )
}

export default function EventList({
    events,
    now,
    limit,
    ...props
}: EventListProps) {
    const visibleEvents = selectEventsForScreen(events, now, limit)

    return (
        <Column gap={8} {...props}>
            {visibleEvents.map((e, i) => {
                return (
                    <EventRow
                        event={e}
                        key={i}
                        state={getEventState(e, now)}
                    ></EventRow>
                )
            })}
            {visibleEvents.length == 0 && (
                <Text italic fontSize={14}>
                    &lt;Кажется, планов нет! Отдыхай!&gt;
                </Text>
            )}
        </Column>
    )
}
