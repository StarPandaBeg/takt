import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const getNoteInputSchema = z.object({
    id: z.int().describe('ID of the note'),
})
export const getNoteOutputSchema = noteSchema.nullable()

export const getNote: ToolCallback<typeof getNoteInputSchema> = async ({
    id,
}) => {
    const note = await notesRepository.get(id)
    return toToolResponse(note ? serializeNote(note) : null)
}
