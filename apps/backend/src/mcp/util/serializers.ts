import type { Note } from '#src/database/schema.js'
import type {
    DeadlineEntity,
    ResolvedDeadline,
} from '#src/services/deadlines.js'
import type { EventEntity, ResolvedEvent } from '#src/services/events.js'
import type { Recurrence } from '#src/services/recurrence.js'

function serializeRecurrence(recurrence: Recurrence | null) {
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

export function serializeDeadlineEntity(deadline: DeadlineEntity) {
    return {
        ...deadline,
        due: deadline.due.toISOString(),
        createdAt: deadline.createdAt.toISOString(),
        updatedAt: deadline.updatedAt.toISOString(),
        cancelledAt: deadline.cancelledAt?.toISOString() ?? null,
        completedAt: deadline.completedAt?.toISOString() ?? null,
        recurrence: serializeRecurrence(deadline.recurrence),
        completions: deadline.completions.map((completion) => ({
            recurrenceId: completion.recurrenceId?.toISOString() ?? null,
            completedAt: completion.completedAt.toISOString(),
        })),
        exceptions: deadline.exceptions.map((exception) => ({
            ...exception,
            recurrenceId: exception.recurrenceId.toISOString(),
            ...('due' in exception
                ? { due: exception.due.toISOString() }
                : {}),
        })),
    }
}

export function serializeResolvedDeadline(deadline: ResolvedDeadline) {
    return {
        ...deadline,
        due: deadline.due.toISOString(),
        completedAt: deadline.completedAt?.toISOString() ?? null,
        recurrenceId: deadline.recurrenceId?.toISOString() ?? null,
    }
}

export function serializeNote(note: Note) {
    return {
        id: note.id,
        text: note.text,
        completedAt: note.completed_at?.toISOString() ?? null,
    }
}
