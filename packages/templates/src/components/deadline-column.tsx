import { calculateQuad } from '@takt/ui'
import { Column, Rect, Text, type FlexProps } from '@takt/ui/components'
import type { DateTime } from 'luxon'

export interface Deadline {
    date: DateTime
    text: string
    important?: boolean
}

export interface DeadlineColumnProps extends FlexProps {
    deadlines: Deadline[]
}

export default function DeadlineColumn({
    deadlines,
    ...props
}: DeadlineColumnProps) {
    const padding = calculateQuad(props.padding ?? 0)
    const maxWidth = props.width ? props.width - padding[1] - padding[3] : -1

    return (
        <Column gap={4} {...props}>
            {deadlines.map((d, i) => {
                return (
                    <>
                        <Column key={i}>
                            <Text>{d.date.toFormat('dd.MM HH:mm')}</Text>
                            <Text
                                fontSize={d.important ? 20 : 16}
                                fontWeight={d.important ? 600 : 400}
                                maxLineWidth={maxWidth}
                            >
                                {d.text}
                            </Text>
                        </Column>
                        {i != deadlines.length - 1 && (
                            <Rect
                                width={maxWidth}
                                height={1}
                                fill
                                fillColor="gray_50"
                            />
                        )}
                    </>
                )
            })}
        </Column>
    )
}
