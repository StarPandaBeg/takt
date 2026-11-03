import { toToolResponse } from '#src/mcp/util/helpers.js'
import { noteIdSchema, parseNoteId } from '#src/mcp/util/ids.js'
import { noteSchema } from '#src/mcp/util/objects.js'
import { serializeMcpNote } from '#src/mcp/util/serializers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const listNotesInputSchema = z.object({
    limit: z
        .number()
        .int()
        .positive()
        .max(64)
        .optional()
        .describe('Defaults to 32'),
    cursor: noteIdSchema
        .optional()
        .describe('Previous nextCursor; keep withDone unchanged'),
    withDone: z
        .boolean()
        .default(false)
        .optional()
        .describe('Include completed notes; defaults to false'),
})
export const listNotesOutputSchema = z.object({
    notes: z.array(noteSchema),
    nextCursor: noteIdSchema.nullable(),
})

export const listNotes: ToolCallback<typeof listNotesInputSchema> = async ({
    limit,
    cursor,
    withDone,
}) => {
    const pageSize = Math.min(limit ?? 32, 64)
    const page = await notesRepository.getFiltered({
        limit: pageSize + 1,
        afterId: cursor === undefined ? undefined : parseNoteId(cursor),
        withDone,
    })
    const hasNextPage = page.length > pageSize
    const notes = page.slice(0, pageSize).map(serializeMcpNote)
    return toToolResponse({
        notes,
        nextCursor: hasNextPage ? notes.at(-1)!.id : null,
    })
}
