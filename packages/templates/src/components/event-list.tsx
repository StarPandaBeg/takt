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

interface EventRowProps {
    event: Event
    state?: 'default' | 'active' | 'disabled'
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
                const periodStart = e.start.minus({ minutes: 15 })
                const periodEnd = e.end ? e.end : e.start.plus({ minutes: 15 })
                const isActive = Interval.fromDateTimes(
                    periodStart,
                    periodEnd,
                ).contains(now)
                const isGone = now > periodEnd

                const state = isActive
                    ? 'active'
                    : isGone
                      ? 'disabled'
                      : 'default'

                return <EventRow event={e} key={i} state={state}></EventRow>
            })}
        </Column>
    )
}
