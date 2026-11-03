import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteIdSchema, parseNoteId } from '#src/mcp/util/ids.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeMcpNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const getNoteInputSchema = z.object({
    id: noteIdSchema,
})
export const getNoteOutputSchema = noteSchema.nullable()

export const getNote: ToolCallback<typeof getNoteInputSchema> = async ({
    id,
}) => {
    const note = await notesRepository.get(parseNoteId(id))
    return toToolResponse(note ? serializeMcpNote(note) : null)
}
