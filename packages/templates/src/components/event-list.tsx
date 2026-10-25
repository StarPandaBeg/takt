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
}

export type EventState = 'default' | 'active' | 'disabled'

interface EventRowProps {
    event: Event
    state?: EventState
}

export function getEventState(event: Event, now: DateTime): EventState {
    const periodStart = event.start.minus({ minutes: 15 })
    const periodEnd = event.end ?? event.start.plus({ minutes: 15 })
    const isActive = Interval.fromDateTimes(periodStart, periodEnd).contains(now)
    if (isActive) return 'active'
    return now.toMillis() >= periodEnd.toMillis() ? 'disabled' : 'default'
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

export default function EventList({ events, now, ...props }: EventListProps) {
    return (
        <Column gap={8} {...props}>
            {events.map((e, i) => {
                return (
                    <EventRow
                        event={e}
                        key={i}
                        state={getEventState(e, now)}
                    ></EventRow>
                )
            })}
        </Column>
    )
}
