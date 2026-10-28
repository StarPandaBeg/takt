import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const createNoteInputSchema = z.object({
    text: z.string().min(1).max(256),
})
export const createNoteOutputSchema = noteSchema.describe(
    'The complete created note, in the same format as get_note',
)

export const createNote: ToolCallback<typeof createNoteInputSchema> = async ({
    text,
}) => {
    const id = await notesRepository.create({ text })
    const note = await notesRepository.get(id)
    if (note === undefined) {
        throw new Error(`Created note ${id} could not be read back`)
    }
    return toToolResponse(serializeNote(note))
}
