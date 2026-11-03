import type { McpServer } from '@modelcontextprotocol/server'
import {
    cancelEventInputSchema,
    cancelEventOutputSchema,
    cancelEventTool,
} from './cancel-event.tool.js'
import {
    createEvent,
    createEventInputSchema,
    createEventOutputSchema,
} from './create-event.tool.js'
import {
    getEvent,
    getEventInputSchema,
    getEventOutputSchema,
} from './get-event.tool.js'
import {
    getEvents,
    getEventsInputSchema,
    getEventsOutputSchema,
} from './get-events.tool.js'
import {
    searchEvents,
    searchEventsInputSchema,
    searchEventsOutputSchema,
} from './search-events.tool.js'
import {
    updateEventInputSchema,
    updateEventOutputSchema,
    updateEventTool,
} from './update-event.tool.js'

export function registerEventTools(server: McpServer) {
    server.registerTool(
        'get_event',
        {
            title: 'Get Event',
            description:
                'Get an event master by ID, including recurrence data.',
            inputSchema: getEventInputSchema,
            outputSchema: getEventOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        getEvent,
    )

    server.registerTool(
        'get_events',
        {
            title: 'Get Events',
            description:
                'Get events in a time range, with resolved occurrences grouped by effective fields.',
            inputSchema: getEventsInputSchema,
            outputSchema: getEventsOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        getEvents,
    )

    server.registerTool(
        'search_events',
        {
            title: 'Search Events',
            description:
                'Search active event masters. Recurrence is not expanded.',
            inputSchema: searchEventsInputSchema,
            outputSchema: searchEventsOutputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
            },
        },
        searchEvents,
    )

    server.registerTool(
        'create_event',
        {
            title: 'Create Event',
            description:
                'Create a one-time or recurring event. End time is optional.',
            inputSchema: createEventInputSchema,
            outputSchema: createEventOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            },
        },
        createEvent,
    )

    server.registerTool(
        'update_event',
        {
            title: 'Update Event',
            description:
                'Update a series, one occurrence, or this and future occurrences.',
            inputSchema: updateEventInputSchema,
            outputSchema: updateEventOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
            },
        },
        updateEventTool,
    )

    server.registerTool(
        'cancel_event',
        {
            title: 'Cancel Event',
            description:
                'Cancel a series, one occurrence, or this and future occurrences.',
            inputSchema: cancelEventInputSchema,
            outputSchema: cancelEventOutputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
            },
        },
        cancelEventTool,
    )
}
