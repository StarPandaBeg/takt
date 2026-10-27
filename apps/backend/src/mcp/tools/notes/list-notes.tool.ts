import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const listNotesInputSchema = z.object({
    limit: z.number().int().positive().max(8192).optional(),
    withDone: z
        .boolean()
        .default(false)
        .optional()
        .describe(
            'Show done notes. False by default. Use this if you want to find notes to restore',
        ),
})
export const listNotesOutputSchema = z.array(noteSchema)

export const listNotes: ToolCallback<typeof listNotesInputSchema> = async ({
    limit,
    withDone,
}) => {
    const notes = await notesRepository.getFiltered({ limit, withDone })
    const result = notes.map(serializeNote)
    return toToolResponse(result)
}
