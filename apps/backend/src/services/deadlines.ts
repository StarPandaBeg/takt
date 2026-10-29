import type {
    Deadline,
    DeadlineCompletion,
    DeadlineRecurrenceException,
} from '#src/database/schema.js'
import type { DeadlineFilters } from '#src/repository/deadlines.js'
import type { Deadline as TemplateDeadline } from '@takt/templates'
import { DateTime } from 'luxon'
import * as z from 'zod'
import {
    getRecurrenceOccurrences,
    getRecurrenceOccurrencesBetween,
    isRecurrenceOccurrence,
    parseRecurrence,
    serializeRecurrence,
    type Recurrence,
} from './recurrence.js'

export type DeadlineOccurrenceException =
    | { readonly recurrenceId: Date; readonly status: 'cancelled' }
    | {
          readonly recurrenceId: Date
          readonly status: 'rescheduled'
          readonly due: Date
      }
    | {
          readonly recurrenceId: Date
          readonly status: 'updated'
          readonly title: string
          readonly description: string | null
          readonly due: Date
          readonly dueIsDate: boolean
          readonly timezone: string
      }

export const deadlineVisibilitySchema = z.object({
    show: z.discriminatedUnion('type', [
        z.object({ type: z.literal('always') }),
        z.object({
            type: z.literal('before'),
            days: z.number().int().min(0).max(3650),
        }),
    ]),
    hide: z.enum(['on_due', 'on_complete']),
})
export type DeadlineVisibility = z.infer<typeof deadlineVisibilitySchema>

export interface DeadlineCompletionEntity {
    readonly recurrenceId: Date | null
    readonly completedAt: Date
}

export type DeadlineEntity = Omit<
    Deadline,
    | 'recurrenceRule'
    | 'completed'
    | 'visibilityShow'
    | 'visibilityDays'
    | 'visibilityHide'
> & {
    readonly recurrence: Recurrence | null
    readonly visibility: DeadlineVisibility
    readonly completedAt: Date | null
    readonly completions: DeadlineCompletionEntity[]
    readonly exceptions: DeadlineOccurrenceException[]
}

export interface ResolvedDeadline {
    readonly id: number
    readonly title: string
    readonly description: string | null
    readonly due: Date
    readonly dueIsDate: boolean
    readonly timezone: string
    readonly completed: boolean
    readonly completedAt: Date | null
    readonly visibility: DeadlineVisibility
    readonly recurrenceId: Date | null
}

export type DeadlineChanges = Partial<{
    readonly title: string
    readonly description: string | null
    readonly due: Date
    readonly dueIsDate: boolean
    readonly timezone: string
    readonly recurrence: Recurrence | null
    readonly visibility: DeadlineVisibility
}>

export type DeadlineMutationScope = 'series' | 'occurrence' | 'this_and_future'

export function serializeDeadlineRecurrence<
    T extends {
        recurrence?: Recurrence | null | undefined
        visibility?: DeadlineVisibility | undefined
    },
>({ recurrence, visibility, ...deadline }: T) {
    return {
        ...deadline,
        ...(recurrence === undefined
            ? {}
            : {
                  recurrenceRule:
                      recurrence === null
                          ? null
                          : serializeRecurrence(recurrence),
              }),
        ...(visibility === undefined
            ? {}
            : {
                  visibilityShow: visibility.show.type,
                  visibilityDays:
                      visibility.show.type === 'before'
                          ? visibility.show.days
                          : 0,
                  visibilityHide: visibility.hide,
              }),
    }
}

function resolveVisibility(deadline: Deadline): DeadlineVisibility {
    return deadlineVisibilitySchema.parse({
        show:
            deadline.visibilityShow === 'before'
                ? { type: 'before', days: deadline.visibilityDays ?? 0 }
                : { type: 'always' },
        hide: deadline.visibilityHide ?? 'on_due',
    })
}

function resolveException(
    exception: DeadlineRecurrenceException,
    deadline: Deadline,
): DeadlineOccurrenceException {
    if (exception.replacementDue === null) {
        return {
            recurrenceId: exception.recurrenceId,
            status: 'cancelled',
        }
    }
    if (exception.replacementTitle === null) {
        return {
            recurrenceId: exception.recurrenceId,
            status: 'rescheduled',
            due: exception.replacementDue,
        }
    }
    return {
        recurrenceId: exception.recurrenceId,
        status: 'updated',
        title: exception.replacementTitle,
        description: exception.replacementDescription,
        due: exception.replacementDue,
        dueIsDate: exception.replacementDueIsDate ?? deadline.dueIsDate,
        timezone: exception.replacementTimezone ?? deadline.timezone,
    }
}

function toDeadlineEntity(
    deadline: Deadline,
    exceptions: readonly DeadlineRecurrenceException[],
    completions: readonly DeadlineCompletion[],
): DeadlineEntity {
    const { recurrenceRule } = deadline
    const completionEntities = completions.map(
        ({ recurrenceId, completedAt }) => ({ recurrenceId, completedAt }),
    )
    return {
        id: deadline.id,
        title: deadline.title,
        description: deadline.description,
        due: deadline.due,
        dueIsDate: deadline.dueIsDate,
        timezone: deadline.timezone,
        cancelledAt: deadline.cancelledAt,
        createdAt: deadline.createdAt,
        updatedAt: deadline.updatedAt,
        recurrence:
            recurrenceRule === null ? null : parseRecurrence(recurrenceRule),
        visibility: resolveVisibility(deadline),
        completedAt:
            completionEntities.find(({ recurrenceId }) => recurrenceId === null)
                ?.completedAt ?? null,
        completions: completionEntities,
        exceptions: exceptions.map((exception) =>
            resolveException(exception, deadline),
        ),
    }
}

export async function getDeadlineEntity(
    id: number,
): Promise<DeadlineEntity | undefined> {
    const [
        deadlinesRepository,
        deadlineExceptionsRepository,
        deadlineCompletionsRepository,
    ] =
        await Promise.all([
            import('#src/repository/deadlines.js'),
            import('#src/repository/deadline-recurrence-exceptions.js'),
            import('#src/repository/deadline-completions.js'),
        ])
    const deadline = await deadlinesRepository.get(id)
    if (deadline === undefined) return undefined
    const exceptions = await deadlineExceptionsRepository.getForDeadlineIds([
        id,
    ])
    const completions = await deadlineCompletionsRepository.getForDeadlineIds([
        id,
    ])
    return toDeadlineEntity(deadline, exceptions, completions)
}

export async function getDeadlineEntities(
    filters: DeadlineFilters,
): Promise<DeadlineEntity[]> {
    const [
        deadlinesRepository,
        deadlineExceptionsRepository,
        deadlineCompletionsRepository,
    ] =
        await Promise.all([
            import('#src/repository/deadlines.js'),
            import('#src/repository/deadline-recurrence-exceptions.js'),
            import('#src/repository/deadline-completions.js'),
        ])
    const deadlines = await deadlinesRepository.getFiltered({
        ...filters,
        limit: undefined,
        withCompleted: true,
    })
    const exceptions = await deadlineExceptionsRepository.getForDeadlineIds(
        deadlines.map(({ id }) => id),
    )
    const grouped = Map.groupBy(exceptions, (exception) => exception.deadlineId)
    const completions =
        await deadlineCompletionsRepository.getForDeadlineIds(
            deadlines.map(({ id }) => id),
        )
    const groupedCompletions = Map.groupBy(
        completions,
        (completion) => completion.deadlineId,
    )
    const entities = deadlines.map((deadline) =>
        toDeadlineEntity(
            deadline,
            grouped.get(deadline.id) ?? [],
            groupedCompletions.get(deadline.id) ?? [],
        ),
    )
    const selected = filters.withCompleted
        ? entities
        : entities.filter(({ completedAt }) => completedAt === null)
    return filters.limit === undefined
        ? selected
        : selected.slice(0, filters.limit)
}

function resolveDeadlineOccurrences(
    deadlines: readonly Deadline[],
    exceptions: readonly DeadlineRecurrenceException[],
    completions: readonly DeadlineCompletion[],
    from: DateTime,
    limit: number,
    withCompleted: boolean,
    nearestPerMaster = false,
): ResolvedDeadline[] {
    const exceptionsByDeadline = Map.groupBy(
        exceptions,
        (exception) => exception.deadlineId,
    )
    const completionsByDeadline = Map.groupBy(
        completions,
        (completion) => completion.deadlineId,
    )
    const occurrences = deadlines.flatMap<ResolvedDeadline>((deadline) => {
        const deadlineCompletions =
            completionsByDeadline.get(deadline.id) ?? []
        const masterCompletion = deadlineCompletions.find(
            ({ recurrenceId }) => recurrenceId === null,
        )
        const completionFor = (recurrenceId: Date | null) =>
            masterCompletion ??
            (recurrenceId === null
                ? undefined
                : deadlineCompletions.find(
                      (completion) =>
                          completion.recurrenceId?.getTime() ===
                          recurrenceId.getTime(),
                  ))
        const base = {
            id: deadline.id,
            title: deadline.title,
            description: deadline.description,
            dueIsDate: deadline.dueIsDate,
            timezone: deadline.timezone,
            visibility: resolveVisibility(deadline),
        }
        if (deadline.recurrenceRule === null) {
            const completion = completionFor(null)
            return deadline.due >= from.toJSDate() &&
                (withCompleted || completion === undefined)
                ? [
                      {
                          ...base,
                          due: deadline.due,
                          completed: completion !== undefined,
                          completedAt: completion?.completedAt ?? null,
                          recurrenceId: null,
                      },
                  ]
                : []
        }

        const deadlineExceptions = exceptionsByDeadline.get(deadline.id) ?? []
        const recurrenceIds = new Set(
            deadlineExceptions.map(({ recurrenceId }) =>
                recurrenceId.getTime(),
            ),
        )
        const start = DateTime.fromJSDate(deadline.due).setZone(
            deadline.timezone,
        )
        const regular = getRecurrenceOccurrences(
            start,
            parseRecurrence(deadline.recurrenceRule),
            from.setZone(deadline.timezone),
            limit + deadlineExceptions.length,
        )
            .filter((due) => !recurrenceIds.has(due.toMillis()))
            .flatMap((due) => {
                const recurrenceId = due.toJSDate()
                const completion = completionFor(recurrenceId)
                return withCompleted || completion === undefined
                    ? [
                          {
                              ...base,
                              due: recurrenceId,
                              completed: completion !== undefined,
                              completedAt: completion?.completedAt ?? null,
                              recurrenceId,
                          },
                      ]
                    : []
            })
        const replacements = deadlineExceptions.flatMap((exception) => {
            if (
                exception.replacementDue === null ||
                exception.replacementDue < from.toJSDate()
            ) {
                return []
            }
            const full = exception.replacementTitle !== null
            const completion = completionFor(exception.recurrenceId)
            const replacement: ResolvedDeadline = {
                ...base,
                title: exception.replacementTitle ?? deadline.title,
                description: full
                    ? exception.replacementDescription
                    : deadline.description,
                due: exception.replacementDue,
                dueIsDate: exception.replacementDueIsDate ?? deadline.dueIsDate,
                timezone: exception.replacementTimezone ?? deadline.timezone,
                completed: completion !== undefined,
                completedAt: completion?.completedAt ?? null,
                recurrenceId: exception.recurrenceId,
            }
            return withCompleted || !replacement.completed ? [replacement] : []
        })
        return [...regular, ...replacements]
    })

    const sorted = occurrences.sort(
        (left, right) => left.due.getTime() - right.due.getTime(),
    )
    const selected = nearestPerMaster
        ? [...Map.groupBy(sorted, ({ id }) => id).values()].map(
              ([nearest]) => nearest!,
          )
        : sorted
    return selected.slice(0, limit)
}

export async function getResolvedDeadlines(options: {
    readonly from: DateTime
    readonly limit?: number | undefined
    readonly withCompleted?: boolean | undefined
}): Promise<ResolvedDeadline[]> {
    if (!options.from.isValid) throw new RangeError('Invalid deadline start')
    const limit = options.limit ?? 128
    if (!Number.isInteger(limit) || limit <= 0 || limit > 8192) {
        throw new RangeError('Deadline limit must be an integer from 1 to 8192')
    }
    const [
        deadlinesRepository,
        deadlineExceptionsRepository,
        deadlineCompletionsRepository,
    ] =
        await Promise.all([
            import('#src/repository/deadlines.js'),
            import('#src/repository/deadline-recurrence-exceptions.js'),
            import('#src/repository/deadline-completions.js'),
        ])
    const masters = await deadlinesRepository.getScheduleCandidates(
        options.from.toJSDate(),
        options.withCompleted ?? false,
    )
    const exceptions = await deadlineExceptionsRepository.getForDeadlineIds(
        masters.map(({ id }) => id),
    )
    const completions = await deadlineCompletionsRepository.getForDeadlineIds(
        masters.map(({ id }) => id),
    )
    return resolveDeadlineOccurrences(
        masters,
        exceptions,
        completions,
        options.from,
        limit,
        options.withCompleted ?? false,
    )
}

export function convertDeadline(
    deadline: Pick<Deadline, 'title' | 'due' | 'dueIsDate' | 'visibilityShow' | 'visibilityDays'>,
    now: DateTime,
): TemplateDeadline {
    const date = DateTime.fromJSDate(deadline.due).setZone(now.zone)
    return {
        text: deadline.title,
        date,
        dateOnly: deadline.dueIsDate,
        showRule: deadline.visibilityShow,
        showDays: deadline.visibilityDays,
        important: date.toMillis() <= now.plus({ days: 3 }).toMillis(),

    }
}

export function getUpcomingDeadlineOccurrences(
    deadlines: readonly Deadline[],
    exceptions: readonly DeadlineRecurrenceException[],
    from: DateTime,
    limit: number,
    completions: readonly DeadlineCompletion[] = [],
): Deadline[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Deadline occurrence limit must be non-negative')
    }
    return resolveDeadlineOccurrences(
        deadlines,
        exceptions,
        completions,
        from,
        limit,
        false,
    ).map((resolved) => {
        const master = deadlines.find(({ id }) => id === resolved.id)!
        return { ...master, ...resolved }
    })
}

/** Resolves recurrence and exceptions, then keeps only the nearest occurrence
 * of each master for the calendar screen. */
export function getNearestDeadlineOccurrencesForScreen(
    deadlines: readonly Deadline[],
    exceptions: readonly DeadlineRecurrenceException[],
    from: DateTime,
    limit: number,
    completions: readonly DeadlineCompletion[] = [],
): Deadline[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Deadline occurrence limit must be non-negative')
    }
    return resolveDeadlineOccurrences(
        deadlines,
        exceptions,
        completions,
        from,
        limit,
        false,
        true,
    ).map((resolved) => {
        const master = deadlines.find(({ id }) => id === resolved.id)!
        return { ...master, ...resolved }
    })
}

const MAX_VISIBLE_OCCURRENCE_CANDIDATES = 8192

/** Applies recurrence, exceptions, completions, and the deadline visibility
 * policy for the calendar screen. */
export function getVisibleDeadlineOccurrencesForScreen(
    deadlines: readonly Deadline[],
    exceptions: readonly DeadlineRecurrenceException[],
    completions: readonly DeadlineCompletion[],
    now: DateTime,
    limit: number,
): Deadline[] {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('Deadline occurrence limit must be non-negative')
    }
    const exceptionsByDeadline = Map.groupBy(
        exceptions,
        (exception) => exception.deadlineId,
    )
    const completionsByDeadline = Map.groupBy(
        completions,
        (completion) => completion.deadlineId,
    )

    const visible = deadlines.flatMap((deadline) => {
        const deadlineExceptions =
            exceptionsByDeadline.get(deadline.id) ?? []
        const earliest = deadlineExceptions.reduce(
            (value, exception) =>
                exception.replacementDue !== null &&
                exception.replacementDue < value
                    ? exception.replacementDue
                    : value,
            deadline.due,
        )
        const resolved = resolveDeadlineOccurrences(
            [deadline],
            deadlineExceptions,
            completionsByDeadline.get(deadline.id) ?? [],
            DateTime.fromJSDate(earliest).setZone(deadline.timezone),
            MAX_VISIBLE_OCCURRENCE_CANDIDATES,
            true,
        ).filter((occurrence) => {
            if (occurrence.completed) return false

            const due = DateTime.fromJSDate(occurrence.due).setZone(
                occurrence.timezone,
            )
            const today = now.setZone(occurrence.timezone).startOf('day')
            const showFrom =
                occurrence.visibility.show.type === 'always'
                    ? undefined
                    : due
                          .startOf('day')
                          .minus({ days: occurrence.visibility.show.days })
            if (showFrom !== undefined && today < showFrom) return false
            return occurrence.visibility.hide === 'on_due'
                ? today <= due.startOf('day')
                : true
        })

        const sorted = resolved.sort(
            (left, right) => left.due.getTime() - right.due.getTime(),
        )
        if (resolveVisibility(deadline).hide === 'on_due') {
            return sorted.slice(0, 1)
        }

        const today = now.setZone(deadline.timezone).startOf('day')
        const overdue = sorted.filter(
            ({ due }) =>
                DateTime.fromJSDate(due)
                    .setZone(deadline.timezone)
                    .startOf('day') < today,
        )
        const currentOrFuture = sorted.find(
            ({ due }) =>
                DateTime.fromJSDate(due)
                    .setZone(deadline.timezone)
                    .startOf('day') >= today,
        )
        return currentOrFuture === undefined
            ? overdue
            : [...overdue, currentOrFuture]
    })

    return visible
        .sort((left, right) => left.due.getTime() - right.due.getTime())
        .slice(0, limit)
        .map((resolved) => {
            const master = deadlines.find(({ id }) => id === resolved.id)!
            return { ...master, ...resolved }
        })
}

function getRecurringDeadline(deadline: Deadline, recurrenceId: Date) {
    if (deadline.recurrenceRule === null) {
        throw new RangeError('Deadline is not recurring')
    }
    const start = DateTime.fromJSDate(deadline.due).setZone(deadline.timezone)
    const occurrence = DateTime.fromJSDate(recurrenceId).setZone(
        deadline.timezone,
    )
    const recurrence = parseRecurrence(deadline.recurrenceRule)
    if (!isRecurrenceOccurrence(start, recurrence, occurrence)) {
        throw new RangeError('recurrenceId is not an occurrence of this series')
    }
    const firstOccurrence = getRecurrenceOccurrences(
        start,
        recurrence,
        start,
        1,
    )[0]
    return {
        start,
        occurrence,
        recurrence,
        isFirst: firstOccurrence?.toMillis() === occurrence.toMillis(),
    }
}

function getRecurrenceSplit(
    recurring: ReturnType<typeof getRecurringDeadline>,
): { readonly previous: Recurrence; readonly previousCount: number } {
    const throughSelected = getRecurrenceOccurrencesBetween(
        recurring.start,
        recurring.recurrence,
        recurring.start,
        recurring.occurrence.plus({ milliseconds: 1 }),
    )
    const previousCount = throughSelected.length - 1
    const previousOccurrence = throughSelected.at(-2)
    if (previousOccurrence === undefined) {
        throw new RangeError('Cannot truncate before the first occurrence')
    }
    return {
        previous:
            recurring.recurrence.count === undefined
                ? {
                      ...recurring.recurrence,
                      until: previousOccurrence.toJSDate(),
                  }
                : {
                      ...recurring.recurrence,
                      count: previousCount,
                      until: undefined,
                  },
        previousCount,
    }
}

export async function updateDeadline(options: {
    readonly id: number
    readonly scope: DeadlineMutationScope
    readonly recurrenceId?: Date | undefined
    readonly changes: DeadlineChanges
}): Promise<number> {
    const [deadlinesRepository, deadlineExceptionsRepository] =
        await Promise.all([
            import('#src/repository/deadlines.js'),
            import('#src/repository/deadline-recurrence-exceptions.js'),
        ])
    const deadline = await deadlinesRepository.get(options.id)
    if (deadline === undefined) throw new RangeError('Deadline not found')

    if (options.scope === 'series') {
        await deadlinesRepository.edit(
            deadline.id,
            serializeDeadlineRecurrence(options.changes),
        )
        return deadline.id
    }
    if (options.recurrenceId === undefined) {
        throw new RangeError(
            'recurrenceId is required for occurrence and this_and_future',
        )
    }
    const recurring = getRecurringDeadline(deadline, options.recurrenceId)

    if (options.scope === 'occurrence') {
        if (
            options.changes.recurrence !== undefined ||
            options.changes.visibility !== undefined
        ) {
            throw new RangeError(
                'recurrence and visibility cannot be changed for a single occurrence',
            )
        }
        const entity = await getDeadlineEntity(deadline.id)
        const found = entity?.exceptions.find(
            (exception) =>
                exception.recurrenceId.getTime() ===
                options.recurrenceId!.getTime(),
        )
        const existing = found?.status === 'updated' ? found : undefined
        const effectiveDue =
            found?.status === 'updated' || found?.status === 'rescheduled'
                ? found.due
                : options.recurrenceId
        await deadlineExceptionsRepository.set(
            deadline.id,
            options.recurrenceId,
            options.changes.due ?? effectiveDue,
            {
                title:
                    options.changes.title ?? existing?.title ?? deadline.title,
                description:
                    options.changes.description !== undefined
                        ? options.changes.description
                        : existing === undefined
                          ? deadline.description
                          : existing.description,
                dueIsDate:
                    options.changes.dueIsDate ??
                    existing?.dueIsDate ??
                    deadline.dueIsDate,
                timezone:
                    options.changes.timezone ??
                    existing?.timezone ??
                    deadline.timezone,
                completed: false,
            },
        )
        return deadline.id
    }

    if (recurring.isFirst) {
        return await updateDeadline({
            id: deadline.id,
            scope: 'series',
            changes: options.changes,
        })
    }
    const { previous, previousCount } = getRecurrenceSplit(recurring)
    const futureRecurrence: Recurrence = {
        ...recurring.recurrence,
        ...(recurring.recurrence.count === undefined
            ? {}
            : { count: recurring.recurrence.count - previousCount }),
    }
    const future = serializeDeadlineRecurrence({
        title: options.changes.title ?? deadline.title,
        description:
            options.changes.description !== undefined
                ? options.changes.description
                : deadline.description,
        due: options.changes.due ?? options.recurrenceId,
        dueIsDate: options.changes.dueIsDate ?? deadline.dueIsDate,
        timezone: options.changes.timezone ?? deadline.timezone,
        completed: false,
        visibility: options.changes.visibility ?? resolveVisibility(deadline),
        recurrence:
            options.changes.recurrence !== undefined
                ? options.changes.recurrence
                : futureRecurrence,
    })
    return await deadlinesRepository.split(
        deadline.id,
        options.recurrenceId,
        { recurrenceRule: serializeRecurrence(previous) },
        future,
    )
}

export async function cancelDeadline(options: {
    readonly id: number
    readonly scope: DeadlineMutationScope
    readonly recurrenceId?: Date | undefined
}): Promise<number> {
    const [deadlinesRepository, deadlineExceptionsRepository] =
        await Promise.all([
            import('#src/repository/deadlines.js'),
            import('#src/repository/deadline-recurrence-exceptions.js'),
        ])
    const deadline = await deadlinesRepository.get(options.id)
    if (deadline === undefined) throw new RangeError('Deadline not found')
    if (deadline.cancelledAt !== null) return deadline.id

    if (options.scope === 'series') {
        await deadlinesRepository.cancel(deadline.id, new Date())
        return deadline.id
    }
    if (options.recurrenceId === undefined) {
        throw new RangeError(
            'recurrenceId is required for occurrence and this_and_future',
        )
    }
    const recurring = getRecurringDeadline(deadline, options.recurrenceId)
    if (options.scope === 'occurrence') {
        await deadlineExceptionsRepository.set(
            deadline.id,
            options.recurrenceId,
            null,
        )
        return deadline.id
    }
    if (recurring.isFirst) {
        await deadlinesRepository.cancel(deadline.id, new Date())
        return deadline.id
    }
    await deadlinesRepository.truncate(
        deadline.id,
        options.recurrenceId,
        serializeRecurrence(getRecurrenceSplit(recurring).previous),
    )
    return deadline.id
}

export async function setDeadlineCompletion(options: {
    readonly id: number
    readonly recurrenceId?: Date | undefined
    readonly completed: boolean
    readonly completedAt?: Date | undefined
}): Promise<number> {
    const [deadlinesRepository, deadlineCompletionsRepository] =
        await Promise.all([
            import('#src/repository/deadlines.js'),
            import('#src/repository/deadline-completions.js'),
        ])
    const deadline = await deadlinesRepository.get(options.id)
    if (deadline === undefined) throw new RangeError('Deadline not found')

    let recurrenceId: Date | null = null
    if (deadline.recurrenceRule === null) {
        if (options.recurrenceId !== undefined) {
            throw new RangeError(
                'recurrenceId must not be provided for a one-time deadline',
            )
        }
    } else {
        if (options.recurrenceId === undefined) {
            throw new RangeError(
                'recurrenceId is required for a recurring deadline',
            )
        }
        getRecurringDeadline(deadline, options.recurrenceId)
        recurrenceId = options.recurrenceId
    }

    if (options.completed) {
        await deadlineCompletionsRepository.set(
            deadline.id,
            recurrenceId,
            options.completedAt ?? new Date(),
        )
    } else {
        await deadlineCompletionsRepository.remove(deadline.id, recurrenceId)
    }
    return deadline.id
}
