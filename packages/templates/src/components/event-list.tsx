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

/** Finds the current event or the nearest upcoming event. */
export function getFeaturedEvent(
    events: readonly Event[],
    now: DateTime,
): Event | undefined {
    const sorted = [...events].sort(
        (a, b) => a.start.toMillis() - b.start.toMillis(),
    )

    return (
        sorted.find((event) => getEventState(event, now) === 'active') ??
        sorted.find((event) => event.start.toMillis() > now.toMillis())
    )
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
        (a, b) => a.start.toMillis() - b.start.toMillis(),
    )

    if (limit === undefined || sorted.length <= limit) return sorted
    if (limit === 0) return []

    const firstCurrentOrFuture = sorted.findIndex(
        (event) => getDisplayEnd(event).toMillis() > now.toMillis(),
    )

    const preferredStart =
        firstCurrentOrFuture === -1
            ? sorted.length - limit
            : firstCurrentOrFuture

    const start = Math.min(preferredStart, sorted.length - limit)

    return sorted.slice(start, start + limit)
}

function formatEventTime(event: Event): string {
    const start = event.start.toFormat('HH:mm')

    return event.end ? `${start}-${event.end.toFormat('HH:mm')}` : start
}

function EventRow({ event, state = 'default' }: EventRowProps) {
    const lineWidth = state === 'active' ? 4 : 2
    const color = state === 'disabled' ? 'gray_75' : 'black'

    return (
        <Group>
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
                fontWeight={state === 'active' ? 600 : 400}
            >
                {formatEventTime(event)}
            </Text>
            <Text
                x={140}
                height={20}
                alignVertical="center"
                fontSize={20}
                color={color}
                fontWeight={state === 'active' ? 600 : 400}
            >
                {event.text}
            </Text>
        </Group>
    )
}

function FeaturedEvent({ event, now }: { event: Event; now: DateTime }) {
    const isActive = getEventState(event, now) === 'active'

    return (
        <Column>
            <Text fontSize={16}>
                {isActive ? 'СЕЙЧАС' : 'БЛИЖАЙШЕЕ СОБЫТИЕ'}
            </Text>
            <Text fontSize={28} fontWeight={600}>
                {event.text}
            </Text>
            <Text fontSize={16}>{formatEventTime(event)}</Text>
        </Column>
    )
}

export default function EventList({
    events,
    now,
    limit,
    ...props
}: EventListProps) {
    const featuredEvent = getFeaturedEvent(events, now)
    const visibleEvents = selectEventsForScreen(events, now, limit)

    return (
        <Column gap={20} {...props}>
            {featuredEvent && <FeaturedEvent event={featuredEvent} now={now} />}

            <Column gap={8}>
                {visibleEvents.map((event, i) => (
                    <EventRow
                        key={i}
                        event={event}
                        state={getEventState(event, now)}
                    />
                ))}

                {visibleEvents.length === 0 && (
                    <Text italic fontSize={16}>
                        {'<Кажется, планов нет! Отдыхай!>'}
                    </Text>
                )}
            </Column>
        </Column>
    )
}
