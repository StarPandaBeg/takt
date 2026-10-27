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

export function registerTools(server: McpServer) {
    server.registerTool(
        'get_event',
        {
            title: 'Get Event',
            description:
                'Retrieve one stored event master by ID, including soft-cancellation time, its recurrence rule, and all cancelled or updated occurrence exceptions.',
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
                'Retrieve scheduled event occurrences within a specified time range. ' +
                'Recurring events are expanded and cancellation or rescheduling exceptions are already applied. ' +
                'Each occurrence contains recurrenceId for later series-specific operations. ' +
                'Use this tool to answer questions about schedules and availability.',
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
                'Search stored event masters to find their IDs. ' +
                'Soft-cancelled masters are excluded. ' +
                'Unlike get_events, this tool does not expand recurrence: it returns the original event entities with recurrence rules and exceptions. ' +
                'Optional from and to filters apply to the master start time, and query searches title and description.',
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
                'Create a new calendar event, optionally with a recurrence rule. ' +
                'Use this tool to schedule meetings, appointments, tasks, or recurring activities. ' +
                'Events may have no end time. ' +
                'For recurring events, specify the recurrence pattern using the provided schema.',
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
                'Update an entire event series, one occurrence, or the selected occurrence and all future occurrences. ' +
                'Use recurrenceId from get_events to target an occurrence. ' +
                'A single-occurrence update is stored as an override and cannot change recurrence. ' +
                'Updating this_and_future splits the series and returns the ID of the new future master. ' +
                'Omitted fields stay unchanged; set nullable fields to null to clear them.',
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
                'Cancel an entire event series, one occurrence, or the selected occurrence and all future occurrences. ' +
                'Use recurrenceId from get_events to target an occurrence. ' +
                'Series cancellation is a soft deletion and remains visible through get_event by ID. ' +
                'Cancelling this_and_future truncates the series while preserving earlier occurrences.',
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
