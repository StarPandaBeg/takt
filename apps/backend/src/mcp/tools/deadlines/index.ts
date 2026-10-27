import type { McpServer } from '@modelcontextprotocol/server'
import {
    cancelDeadlineInputSchema,
    cancelDeadlineOutputSchema,
    cancelDeadlineTool,
} from './cancel-deadline.tool.js'
import {
    createDeadline,
    createDeadlineInputSchema,
    createDeadlineOutputSchema,
} from './create-deadline.tool.js'
import {
    getDeadline,
    getDeadlineInputSchema,
    getDeadlineOutputSchema,
} from './get-deadline.tool.js'
import {
    getDeadlines,
    getDeadlinesInputSchema,
    getDeadlinesOutputSchema,
} from './get-deadlines.tool.js'
import {
    searchDeadlines,
    searchDeadlinesInputSchema,
    searchDeadlinesOutputSchema,
} from './search-deadlines.tool.js'
import {
    setDeadlineCompletion,
    setDeadlineCompletionInputSchema,
    setDeadlineCompletionOutputSchema,
} from './set-deadline-completion.tool.js'
import {
    updateDeadlineInputSchema,
    updateDeadlineOutputSchema,
    updateDeadlineTool,
} from './update-deadline.tool.js'

export function registerDeadlineTools(server: McpServer) {
    server.registerTool(
        'get_deadline',
        {
            title: 'Get Deadline',
            description:
                'Retrieve one deadline master by ID, including recurrence, soft-cancellation time, and occurrence overrides.',
            inputSchema: getDeadlineInputSchema,
            outputSchema: getDeadlineOutputSchema,
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
                'Retrieve effective deadline occurrences from a time boundary. Recurrence and occurrence overrides are applied.',
            inputSchema: getDeadlinesInputSchema,
            outputSchema: getDeadlinesOutputSchema,
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
                'Search active deadline masters by title, description, and master due time. Recurrence is not expanded.',
            inputSchema: searchDeadlinesInputSchema,
            outputSchema: searchDeadlinesOutputSchema,
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
            description:
                'Create a one-time or recurring deadline with optional date-only semantics.',
            inputSchema: createDeadlineInputSchema,
            outputSchema: createDeadlineOutputSchema,
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
                'Update a deadline series, one occurrence, or the selected occurrence and all future occurrences.',
            inputSchema: updateDeadlineInputSchema,
            outputSchema: updateDeadlineOutputSchema,
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
                'Cancel a deadline series, one occurrence, or the selected occurrence and all future occurrences.',
            inputSchema: cancelDeadlineInputSchema,
            outputSchema: cancelDeadlineOutputSchema,
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
            description:
                'Complete or reopen a one-time deadline or one specific occurrence of a recurring deadline. Completion is independent from cancellation and rescheduling.',
            inputSchema: setDeadlineCompletionInputSchema,
            outputSchema: setDeadlineCompletionOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            },
        },
        setDeadlineCompletion,
    )
}
