import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteIdSchema, parseNoteId } from '#src/mcp/util/ids.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeMcpNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const updateNoteInputSchema = z.object({
    id: noteIdSchema,
    text: z.string().min(1).max(256).optional(),
    completedAt: z.iso
        .datetime({ offset: true })
        .optional()
        .nullable()
        .describe('ISO 8601 completion time; null reopens'),
})
export const updateNoteOutputSchema = noteSchema

export const updateNote: ToolCallback<typeof updateNoteInputSchema> = async ({
    id,
    text,
    completedAt,
}) => {
    const noteId = parseNoteId(id)
    if (text !== undefined) await notesRepository.edit(noteId, { text })
    if (completedAt !== undefined)
        await notesRepository.markDoneAt(
            noteId,
            completedAt ? new Date(completedAt) : null,
        )
    const note = await notesRepository.get(noteId)
    if (note === undefined) throw new RangeError('Note not found')
    return toToolResponse(serializeMcpNote(note))
}
