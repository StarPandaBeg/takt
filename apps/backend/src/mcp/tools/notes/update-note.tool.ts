import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const updateNoteInputSchema = z.object({
    id: z.int().describe('ID of the note'),
    text: z.string().min(1).max(256).optional(),
    completedAt: z.iso
        .datetime({ offset: true })
        .optional()
        .nullable()
        .describe(
            'Note completion time. Set to null to mark note as incompleted',
        ),
})
export const updateNoteOutputSchema = noteSchema.describe(
    'The complete updated note, in the same format as get_note',
)

export const updateNote: ToolCallback<typeof updateNoteInputSchema> = async ({
    id,
    text,
    completedAt,
}) => {
    if (text !== undefined) await notesRepository.edit(id, { text })
    if (completedAt !== undefined)
        await notesRepository.markDoneAt(
            id,
            completedAt ? new Date(completedAt) : null,
        )
    const note = await notesRepository.get(id)
    if (note === undefined) throw new RangeError('Note not found')
    return toToolResponse(serializeNote(note))
}
