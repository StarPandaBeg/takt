import type { McpServer } from '@modelcontextprotocol/server'
import { createNote, createNoteInputSchema } from './create-note.tool.js'
import { getNote, getNoteInputSchema } from './get-note.tool.js'
import { listNotes, listNotesInputSchema } from './list-notes.tool.js'
import { updateNote, updateNoteInputSchema } from './update-note.tool.js'

export function registerNoteTools(server: McpServer) {
    server.registerTool(
        'get_notes',
        {
            title: 'Get Notes',
            description: 'List notes; active only by default.',
            inputSchema: listNotesInputSchema,
            // outputSchema: listNotesOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        listNotes,
    )

    server.registerTool(
        'get_note',
        {
            title: 'Get Note',
            description: 'Get a note by ID.',
            inputSchema: getNoteInputSchema,
            // outputSchema: getNoteOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        getNote,
    )

    server.registerTool(
        'create_note',
        {
            title: 'Create Note',
            description: 'Create a short note.',
            inputSchema: createNoteInputSchema,
            // outputSchema: createNoteOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            },
        },
        createNote,
    )

    server.registerTool(
        'update_note',
        {
            title: 'Update Note',
            description:
                'Update note text or completion state. Omitted fields stay unchanged.',
            inputSchema: updateNoteInputSchema,
            // outputSchema: updateNoteOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
            },
        },
        updateNote,
    )
}
