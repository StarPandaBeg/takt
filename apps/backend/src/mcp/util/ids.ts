import * as z from 'zod'

type EntityKind = 'event' | 'deadline' | 'note'

function createEntityIdSchema<const Kind extends EntityKind>(kind: Kind) {
    return z
        .string()
        .regex(new RegExp(`^${kind}:[1-9]\\d*$`), {
            message: `Expected ${kind}:<positive integer>`,
        })
        .refine(
            (value) =>
                Number.isSafeInteger(Number(value.slice(kind.length + 1))),
            { message: 'ID exceeds the safe integer range' },
        )
        .describe(`${kind}:<number>`)
}

function parseEntityId(kind: EntityKind, value: string) {
    const separator = value.indexOf(':')
    return Number(value.slice(separator + 1))
}

function formatEntityId(kind: EntityKind, value: number) {
    return `${kind}:${value}`
}

export const eventIdSchema = createEntityIdSchema('event')
export const deadlineIdSchema = createEntityIdSchema('deadline')
export const noteIdSchema = createEntityIdSchema('note')

export function parseEventId(value: string) {
    return parseEntityId('event', eventIdSchema.parse(value))
}

export function parseDeadlineId(value: string) {
    return parseEntityId('deadline', deadlineIdSchema.parse(value))
}

export function parseNoteId(value: string) {
    return parseEntityId('note', noteIdSchema.parse(value))
}

export function formatEventId(value: number) {
    return formatEntityId('event', value)
}

export function formatDeadlineId(value: number) {
    return formatEntityId('deadline', value)
}

export function formatNoteId(value: number) {
    return formatEntityId('note', value)
}
