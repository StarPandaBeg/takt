import { Column, Rect, Row, Text, type FlexProps } from '@takt/ui/components'

export interface NotesProps extends FlexProps {
    notes: string[]
    notesPerColumn?: number
}

export default function Notes({
    notes,
    notesPerColumn = 4,
    ...props
}: NotesProps) {
    const columns: string[][] = []
    const count = Math.max(1, Math.floor(notesPerColumn))

    for (let i = 0; i < notes.length; i += count) {
        columns.push(notes.slice(i, i + count))
    }

    const columnWidth =
        props.width !== undefined && props.width >= 0
            ? (props.width - (columns.length - 1) * 8) / columns.length
            : -1

    return (
        <Row gap={8} {...props}>
            {columns.map((column, i) => (
                <Column key={i} width={columnWidth} gap={4}>
                    {column.map((note, j) => (
                        <Row align="center" gap={8}>
                            <Rect width={6} height={6} fill borderRadius={16} />
                            <Text
                                key={j}
                                fontSize={20}
                                maxLineWidth={columnWidth - 20}
                                overflow="emphasis"
                            >
                                {note}
                            </Text>
                        </Row>
                    ))}
                </Column>
            ))}
        </Row>
    )
}
