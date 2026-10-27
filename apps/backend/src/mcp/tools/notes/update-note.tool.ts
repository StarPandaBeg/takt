import { toToolResponse } from '#src/mcp/util/helpers.js'
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
export const updateNoteOutputSchema = z.object({
    id: z.int().describe('ID of the updated note'),
})

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
    return toToolResponse({ id })
}
