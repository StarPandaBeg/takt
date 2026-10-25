import { Column, H1, Text, type FlexProps } from '@takt/ui/components'
import type { DateTime } from 'luxon'

const weekdays = [
    'понедельник',
    'вторник',
    'среда',
    'четверг',
    'пятница',
    'суббота',
    'воскресенье',
]
const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
]

export interface BigDateProps extends FlexProps {
    today: DateTime
}

export default function BigDate({ today, ...props }: BigDateProps) {
    return (
        <Column gap={12} {...props}>
            <Text fontSize={20} metrics="tight">
                {weekdays[today.weekday - 1] ?? '??'}
            </Text>
            <H1 fontSize={80} color="gray_75" metrics="tight">
                {today.day}
            </H1>
            <Text fontSize={20} metrics="tight">
                {months[today.month - 1] ?? '??'}, {today.year}
            </Text>
        </Column>
    )
}
