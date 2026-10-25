import { Column, H2, Image, Line, Row, Text } from '@takt/ui/components'
import type { DateTime } from 'luxon'
import BigDate from '../components/big-date.js'
import DeadlineColumn, { type Deadline } from '../components/deadline-column.js'
import EventList, { type Event } from '../components/event-list.js'
import Notes, { type Note } from '../components/notes.js'
import VerticalCalendar from '../components/vertical-calendar.js'
import { defineScene } from '../scene.js'

export interface CalendarMainContext {
    readonly today: DateTime
    readonly events: Event[]
    readonly deadlines: Deadline[]
    readonly notes: Note[]
}

export const calendarMainScreen = defineScene<CalendarMainContext>(
    ({ today, notes, deadlines, events }) => {
        return (
            <>
                <Line x={170} y={0} dx={0} dy={480} strokeColor="gray_50" />
                <Line x={0} y={150} dx={170} dy={0} strokeColor="gray_50" />

                <Row width={800} justify="end" align="center" gap={4}>
                    <Text fontSize={14} fontWeight={600}>
                        {today.toFormat('HH:mm dd.MM')}
                    </Text>
                    <Image
                        src={
                            new URL(
                                '../../assets/icon-sync.png',
                                import.meta.url,
                            ).href
                        }
                        width={26}
                        height={26}
                        fit="contain"
                        smoothing
                        dithering="floyd-steinberg"
                        threshold={128}
                    />
                </Row>

                <BigDate padding={8} today={today} />
                <DeadlineColumn
                    y={150}
                    width={170}
                    padding={8}
                    deadlines={deadlines}
                    limit={4}
                />

                <Column x={170} padding={16} gap={8}>
                    <H2>СЕГОДНЯ</H2>
                    <EventList events={events} now={today} limit={8} />
                </Column>

                <Column x={170} y={280} padding={16} gap={8} width={550}>
                    <H2>ЗАМЕТКИ</H2>
                    <Notes
                        width={550}
                        notesPerColumn={4}
                        notes={notes}
                        limit={8}
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
    },
)
