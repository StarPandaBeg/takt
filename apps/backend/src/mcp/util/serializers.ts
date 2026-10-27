import type { EventEntity, ResolvedEvent } from '../../services/events.js'

function serializeRecurrence(recurrence: EventEntity['recurrence']) {
    if (recurrence === null || recurrence.until === undefined) {
        return recurrence
    }
    return { ...recurrence, until: recurrence.until.toISOString() }
}

export function serializeEventEntity(event: EventEntity) {
    return {
        ...event,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        recurrence: serializeRecurrence(event.recurrence),
        exceptions: event.exceptions.map((exception) =>
            exception.status === 'cancelled'
                ? {
                      status: exception.status,
                      recurrenceId: exception.recurrenceId.toISOString(),
                  }
                : {
                      status: exception.status,
                      recurrenceId: exception.recurrenceId.toISOString(),
                      start: exception.start.toISOString(),
                      end: exception.end?.toISOString() ?? null,
                  },
        ),
    }
}

export function serializeResolvedEvent(event: ResolvedEvent) {
    return {
        ...event,
        start: event.start.toISOString(),
        end: event.end?.toISOString() ?? null,
        recurrenceId: event.recurrenceId?.toISOString() ?? null,
    }
}
