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
        cancelledAt: event.cancelledAt?.toISOString() ?? null,
        recurrence: serializeRecurrence(event.recurrence),
        exceptions: event.exceptions.map((exception) =>
            exception.status === 'cancelled'
                ? {
                      status: exception.status,
                      recurrenceId: exception.recurrenceId.toISOString(),
                  }
                : exception.status === 'rescheduled'
                  ? {
                        status: exception.status,
                        recurrenceId: exception.recurrenceId.toISOString(),
                        start: exception.start.toISOString(),
                        end: exception.end?.toISOString() ?? null,
                    }
                  : {
                      status: exception.status,
                      recurrenceId: exception.recurrenceId.toISOString(),
                      title: exception.title,
                      description: exception.description,
                      start: exception.start.toISOString(),
                      end: exception.end?.toISOString() ?? null,
                      timezone: exception.timezone,
                      allDay: exception.allDay,
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
