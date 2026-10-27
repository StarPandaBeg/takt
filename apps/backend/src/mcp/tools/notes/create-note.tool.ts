import { toToolResponse } from '#src/mcp/util/helpers.js'
import * as notesRepository from '#src/repository/notes.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const createNoteInputSchema = z.object({
    text: z.string().min(1).max(256),
})
export const createNoteOutputSchema = z.object({
    id: z.int().describe('ID of the created note'),
})

export const createNote: ToolCallback<typeof createNoteInputSchema> = async ({
    text,
}) => {
    const id = await notesRepository.create({ text })
    return toToolResponse({ id })
}
