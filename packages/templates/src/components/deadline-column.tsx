import { calculateQuad } from '@takt/ui'
import { Column, Rect, Text, type FlexProps } from '@takt/ui/components'
import type { DateTime } from 'luxon'

export interface Deadline {
    date: DateTime
    dateOnly?: boolean
    text: string
    important?: boolean
    showRule?: string
    showDays?: number
}

export interface DeadlineColumnProps extends FlexProps {
    deadlines: Deadline[]
    limit?: number
}

export function selectDeadlinesForScreen(
    deadlines: readonly Deadline[],
    limit?: number,
): Deadline[] {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
        throw new RangeError('Deadline limit must be a non-negative integer')
    }

    const sorted = [...deadlines].sort(
        (left, right) => left.date.toMillis() - right.date.toMillis(),
    )
    return limit === undefined ? sorted : sorted.slice(0, limit)
}

export default function DeadlineColumn({
    deadlines,
    limit,
    ...props
}: DeadlineColumnProps) {
    const visibleDeadlines = selectDeadlinesForScreen(deadlines, limit)
    const padding = calculateQuad(props.padding ?? 0)
    const maxWidth = props.width ? props.width - padding[1] - padding[3] : -1

    return (
        <Column gap={4} {...props}>
            {visibleDeadlines.map((d, i) => {
                const datetimeFormat = d.dateOnly ? 'dd.MM' : 'dd.MM HH:mm'
                const isDueSelectedDate =
                    d.showRule == 'always' ||
                    (d.showRule == 'before' && d.showDays != 0)

                return (
                    <>
                        <Column key={i}>
                            <Text>
                                {isDueSelectedDate ? 'до ' : ''}
                                {d.date.toFormat(datetimeFormat)}
                            </Text>
                            <Text
                                fontSize={d.important ? 20 : 16}
                                fontWeight={d.important ? 600 : 400}
                                maxLineWidth={maxWidth}
                            >
                                {d.text}
                            </Text>
                        </Column>
                        {i != visibleDeadlines.length - 1 && (
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
