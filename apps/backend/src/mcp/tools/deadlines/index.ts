import type { McpServer } from '@modelcontextprotocol/server'
import {
    cancelDeadlineInputSchema,
    cancelDeadlineTool,
} from './cancel-deadline.tool.js'
import {
    createDeadline,
    createDeadlineInputSchema,
} from './create-deadline.tool.js'
import { getDeadline, getDeadlineInputSchema } from './get-deadline.tool.js'
import { getDeadlines, getDeadlinesInputSchema } from './get-deadlines.tool.js'
import {
    searchDeadlines,
    searchDeadlinesInputSchema,
} from './search-deadlines.tool.js'
import {
    setDeadlineCompletion,
    setDeadlineCompletionInputSchema,
} from './set-deadline-completion.tool.js'
import {
    updateDeadlineInputSchema,
    updateDeadlineTool,
} from './update-deadline.tool.js'

export function registerDeadlineTools(server: McpServer) {
    server.registerTool(
        'get_deadline',
        {
            title: 'Get Deadline',
            description:
                'Get a deadline master by ID, including recurrence data.',
            inputSchema: getDeadlineInputSchema,
            // outputSchema: getDeadlineOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        getDeadline,
    )

    server.registerTool(
        'get_deadlines',
        {
            title: 'Get Deadlines',
            description:
                'Get occurrences from a time boundary. Recurrence and overrides are applied.',
            inputSchema: getDeadlinesInputSchema,
            // outputSchema: getDeadlinesOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        getDeadlines,
    )

    server.registerTool(
        'search_deadlines',
        {
            title: 'Search Deadlines',
            description:
                'Search active deadline masters. Recurrence is not expanded.',
            inputSchema: searchDeadlinesInputSchema,
            // outputSchema: searchDeadlinesOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        searchDeadlines,
    )

    server.registerTool(
        'create_deadline',
        {
            title: 'Create Deadline',
            description: 'Create a one-time or recurring deadline.',
            inputSchema: createDeadlineInputSchema,
            // outputSchema: createDeadlineOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            },
        },
        createDeadline,
    )

    server.registerTool(
        'update_deadline',
        {
            title: 'Update Deadline',
            description:
                'Update a series, one occurrence, or this and future occurrences.',
            inputSchema: updateDeadlineInputSchema,
            // outputSchema: updateDeadlineOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
            },
        },
        updateDeadlineTool,
    )

    server.registerTool(
        'cancel_deadline',
        {
            title: 'Cancel Deadline',
            description:
                'Cancel a series, one occurrence, or this and future occurrences.',
            inputSchema: cancelDeadlineInputSchema,
            // outputSchema: cancelDeadlineOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
            },
        },
        cancelDeadlineTool,
    )

    server.registerTool(
        'set_deadline_completion',
        {
            title: 'Set Deadline Completion',
            description: 'Complete or reopen a deadline occurrence.',
            inputSchema: setDeadlineCompletionInputSchema,
            // outputSchema: setDeadlineCompletionOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            },
        },
        setDeadlineCompletion,
    )
}
