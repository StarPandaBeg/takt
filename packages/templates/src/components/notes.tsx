import { Column, Rect, Row, Text, type FlexProps } from '@takt/ui/components'

export interface Note {
    text: string
    done?: boolean
}

export interface NotesProps extends FlexProps {
    notes: Note[]
    notesPerColumn?: number
    limit?: number
}

export default function Notes({
    notes,
    notesPerColumn = 4,
    limit,
    ...props
}: NotesProps) {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
        throw new RangeError('Note limit must be a non-negative integer')
    }

    const visibleNotes = limit === undefined ? notes : notes.slice(0, limit)
    const columns: Note[][] = []
    const count = Math.max(1, Math.floor(notesPerColumn))

    for (let i = 0; i < visibleNotes.length; i += count) {
        columns.push(visibleNotes.slice(i, i + count))
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
                                strikethrough={note.done ?? false}
                            >
                                {note.text}
                            </Text>
                        </Row>
                    ))}
                </Column>
            ))}
            {visibleNotes.length == 0 && (
                <Text italic fontSize={16}>
                    &lt;Сейчас тут пусто!&gt;
                </Text>
            )}
        </Row>
    )
}
