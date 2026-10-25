import { Column, Group, Rect, Text, type FlexProps } from '@takt/ui/components'
import { DateTime } from 'luxon'

export interface VerticalCalendarProps extends FlexProps {
    today: DateTime
}

const weekdays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

function CalendarItem({
    day,
    date,
    active,
    ...props
}: {
    day: string
    date: string | number
    active?: boolean
}) {
    return (
        <Group {...props}>
            <Rect
                width={70}
                height={50}
                fill={active ?? false}
                fillColor="gray_25"
                borderRadius={[10, 0, 0, 10]}
            />
            <Text
                x={active ? 0 : 10}
                width={70}
                height={50}
                align="center"
                alignVertical="center"
                fontWeight={active ? 600 : 400}
                lineHeight={1.4}
            >{`${day}\n${date}`}</Text>
        </Group>
    )
}

export default function VerticalCalendar({
    today,
    ...props
}: VerticalCalendarProps) {
    const weekDay = today.weekday
    const monday = today.minus({ days: weekDay - 1 })

    return (
        <Column width={70} gap={4} {...props}>
            {...Array(7)
                .fill(0)
                .map((_, i) => {
                    const day = monday.plus({ days: i })
                    const active = day.hasSame(today, 'day')

                    return (
                        <CalendarItem
                            day={weekdays[i] ?? '??'}
                            date={day.day}
                            active={active}
                            key={i}
                        />
                    )
                })}
        </Column>
    )
}
