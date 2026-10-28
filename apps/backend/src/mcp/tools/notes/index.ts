import type { McpServer } from '@modelcontextprotocol/server'
import {
    createNote,
    createNoteInputSchema,
    createNoteOutputSchema,
} from './create-note.tool.js'
import {
    getNote,
    getNoteInputSchema,
    getNoteOutputSchema,
} from './get-note.tool.js'
import {
    listNotes,
    listNotesInputSchema,
    listNotesOutputSchema,
} from './list-notes.tool.js'
import {
    updateNote,
    updateNoteInputSchema,
    updateNoteOutputSchema,
} from './update-note.tool.js'

export function registerNoteTools(server: McpServer) {
    server.registerTool(
        'get_notes',
        {
            title: 'Get Notes',
            description:
                'Retrieve list of all notes. By default, returns only active notes',
            inputSchema: listNotesInputSchema,
            outputSchema: listNotesOutputSchema,
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
            description: 'Retrieve one note by ID',
            inputSchema: getNoteInputSchema,
            outputSchema: getNoteOutputSchema,
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
            description:
                'Create new note entry from text and return the complete created note. Note must be a short line of text, meaning small reminder',
            inputSchema: createNoteInputSchema,
            outputSchema: createNoteOutputSchema,
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
                'Update note text and/or completion date and return the complete updated note. Not included fields remain untouched. You can soft remove a note by setting completion time',
            inputSchema: updateNoteInputSchema,
            outputSchema: updateNoteOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
            },
        },
        updateNote,
    )
}
