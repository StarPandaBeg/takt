import { Column, H2, Line } from '@takt/ui/components'
import { DateTime } from 'luxon'
import BigDate from '../components/big-date.js'
import type { Deadline } from '../components/deadline-column.js'
import DeadlineColumn from '../components/deadline-column.js'
import EventList from '../components/event-list.js'
import Notes from '../components/notes.js'
import VerticalCalendar from '../components/vertical-calendar.js'
import { defineScene } from '../scene.js'

export const calendarBlankScreen = defineScene(() => {
    const today = DateTime.now().plus({ days: 0 })
    const events = [
        {
            start: DateTime.fromISO('2026-10-24T17:00:34.123'),
            text: 'Событие 1',
        },
        {
            start: DateTime.fromISO('2026-10-24T17:20:34.123'),
            text: 'Событие 2',
        },
        {
            start: DateTime.fromISO('2026-10-24T17:00:34.123'),
            end: DateTime.fromISO('2026-10-24T17:30:34.123'),
            text: 'Событие 3',
        },
        {
            start: DateTime.fromISO('2025-10-24T17:50:34.123'),
            end: DateTime.fromISO('2027-10-24T17:55:34.123'),
            text: 'Событие 4',
        },
        {
            start: DateTime.fromISO('2026-10-25T17:50:34.123'),
            end: DateTime.fromISO('2026-10-25T17:55:34.123'),
            text: 'Событие 5',
        },
        {
            start: DateTime.fromISO('2026-10-25T17:50:34.123'),
            end: DateTime.fromISO('2026-10-25T17:55:34.123'),
            text: 'Событие 6',
        },
        {
            start: DateTime.fromISO('2026-10-25T17:50:34.123'),
            end: DateTime.fromISO('2026-10-25T17:55:34.123'),
            text: 'Событие 7',
        },
        {
            start: DateTime.fromISO('2026-10-25T17:50:34.123'),
            end: DateTime.fromISO('2026-10-25T17:55:34.123'),
            text: 'Событие 8',
        },
    ]

    const deadlines: Deadline[] = [
        {
            date: DateTime.fromISO('2026-10-19T15:50:34.123'),
            text: 'Решить со встречей ВИШ',
            important: true,
        },
        {
            date: DateTime.fromISO('2026-10-19T15:50:34.123'),
            text: 'Решить со встречей ВИШ',
        },
    ]

    return (
        <>
            <Line x={170} y={0} dx={0} dy={480} strokeColor="gray_50" />
            <Line x={0} y={150} dx={170} dy={0} strokeColor="gray_50" />

            <BigDate padding={8} today={today} />
            <DeadlineColumn
                y={150}
                width={170}
                padding={8}
                deadlines={deadlines}
            />

            <Column x={170} padding={16} gap={8}>
                <H2>СЕГОДНЯ</H2>
                <EventList events={events} now={today} />
            </Column>

            <Column x={170} y={280} padding={16} gap={8} width={550}>
                <H2>ЗАМЕТКИ</H2>
                <Notes
                    width={550}
                    notesPerColumn={4}
                    notes={[
                        'Перенести пароли',
                        'Заказать рамку',
                        'Обновить сервер',
                        'Купить продукты',
                        'Закончить календарь',
                        'Проверить бэкапы',
                        'Позвонить другу',
                        'Разобрать задачи',
                    ]}
                />
            </Column>
            <Column
                x={0}
                y={0}
                width={800}
                height={480}
                justify="center"
                align="end"
            >
                <VerticalCalendar today={today} />
            </Column>
        </>
    )
})
