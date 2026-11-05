import type {
    ApplicationSettings,
    CancelDeadlinePayload,
    CancelEventPayload,
    CreateDeadlinePayload,
    CreateEventPayload,
    CreateNotePayload,
    DeadlineEntity,
    DeadlineListQuery,
    DeadlineOccurrenceListQuery,
    EventEntity,
    EventOccurrenceListQuery,
    EventSearchQuery,
    ListNotesQuery,
    Note,
    PaginatedNotes,
    ResolvedDeadline,
    ResolvedEvent,
    ScreenChange,
    ScreenInfo,
    SetDeadlineCompletionPayload,
    UpdateDeadlinePayload,
    UpdateEventPayload,
    UpdateNotePayload,
    UpdateSettingsPayload,
} from '../types/api'

export class ApiClientError extends Error {
    constructor(
        message: string,
        public status: number,
        public data?: unknown,
    ) {
        super(message)
        this.name = 'ApiClientError'
    }
}

export function getAuthToken(): string {
    return (
        localStorage.getItem('takt_auth_token') ||
        import.meta.env.VITE_AUTH_TOKEN ||
        ''
    )
}

export function setAuthToken(token: string): void {
    localStorage.setItem('takt_auth_token', token)
}

const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? '')
    .trim()
    .replace(/\/+$/, '')

function backendPath(path: string): string {
    return `${backendUrl}${path}`
}

const inFlightGetRequests = new Map<string, Promise<unknown>>()
let requestGeneration = 0

async function executeRequestWithHeaders<T>(
    path: string,
    options: RequestInit,
): Promise<{ data: T; headers: Headers }> {
    const headers = new Headers(options.headers)

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json')
    }

    if (
        options.body &&
        typeof options.body === 'string' &&
        !headers.has('Content-Type')
    ) {
        headers.set('Content-Type', 'application/json')
    }

    if (!path.startsWith('/health')) {
        const token = getAuthToken()
        if (token) {
            headers.set('Authorization', `Bearer ${token}`)
        }
    }

    const response = await fetch(backendPath(path), {
        ...options,
        headers,
    })

    if (!response.ok) {
        let errorData: unknown
        let errorMessage = `Ошибка HTTP ${response.status}: ${response.statusText}`
        try {
            const body: unknown = await response.json()
            errorData = body
            if (typeof body === 'object' && body !== null) {
                const record = body as Record<string, unknown>
                if (typeof record.message === 'string') {
                    errorMessage = record.message
                } else if (typeof record.error === 'string') {
                    errorMessage = record.error
                }
            }
        } catch {
            // Тело не JSON
        }
        throw new ApiClientError(errorMessage, response.status, errorData)
    }

    if (response.status === 204) {
        return { data: undefined as T, headers: response.headers }
    }

    const data = (await response.json()) as T
    return { data, headers: response.headers }
}

async function executeRequest<T>(
    path: string,
    options: RequestInit,
): Promise<T> {
    const { data } = await executeRequestWithHeaders<T>(path, options)
    return data
}

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase()
    if (method !== 'GET' || options.signal !== undefined) {
        requestGeneration += 1
        return executeRequest<T>(path, options).finally(() => {
            requestGeneration += 1
        })
    }

    const key = `${requestGeneration}\n${getAuthToken()}\n${path}`
    const existing = inFlightGetRequests.get(key) as Promise<T> | undefined
    if (existing !== undefined) return existing

    const pending = executeRequest<T>(path, options)
    const tracked = pending.finally(() => {
        if (inFlightGetRequests.get(key) === tracked) {
            inFlightGetRequests.delete(key)
        }
    })
    inFlightGetRequests.set(key, tracked)
    return tracked
}

function buildQuery(
    params: Record<string, string | number | boolean | undefined>,
): string {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            searchParams.set(key, String(value))
        }
    }
    const queryString = searchParams.toString()
    return queryString ? `?${queryString}` : ''
}

export const api = {
    settings: {
        get: () => request<ApplicationSettings>('/api/settings'),
        update: (payload: UpdateSettingsPayload) =>
            request<ApplicationSettings>('/api/settings', {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }),
    },

    // --- Notes ---
    notes: {
        list: (query: ListNotesQuery = {}) =>
            request<Note[]>(
                `/api/notes${buildQuery({
                    limit: query.limit,
                    withDone: query.withDone,
                    onlyDone: query.onlyDone,
                    page: query.page,
                    offset: query.offset,
                    afterId: query.afterId,
                })}`,
            ),

        listWithPagination: async (
            query: ListNotesQuery = {},
        ): Promise<PaginatedNotes> => {
            const path = `/api/notes${buildQuery({
                limit: query.limit,
                withDone: query.withDone,
                onlyDone: query.onlyDone,
                page: query.page,
                offset: query.offset,
                afterId: query.afterId,
            })}`
            const { data, headers } = await executeRequestWithHeaders<Note[]>(
                path,
                {},
            )
            const countHeader = headers.get('x-total-count')
            const total =
                countHeader !== null ? parseInt(countHeader, 10) : data.length
            return {
                notes: data,
                total,
            }
        },

        get: (id: number) => request<Note | null>(`/api/notes/${id}`),

        create: (payload: CreateNotePayload) =>
            request<Note>('/api/notes', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),

        update: (id: number, payload: UpdateNotePayload) =>
            request<Note>(`/api/notes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            }),

        markDone: (id: number) =>
            request<void>(`/api/notes/${id}/markDone`, {
                method: 'POST',
                keepalive: true,
            }),

        markUndone: (id: number) =>
            request<void>(`/api/notes/${id}/markUndone`, {
                method: 'POST',
                keepalive: true,
            }),
    },

    // --- Events ---
    events: {
        listOccurrences: (query: EventOccurrenceListQuery) =>
            request<ResolvedEvent[]>(
                `/api/events/occurrences${buildQuery({
                    from: query.from,
                    to: query.to,
                    limit: query.limit,
                })}`,
            ),

        search: (query: EventSearchQuery = {}) =>
            request<EventEntity[]>(
                `/api/events/search${buildQuery({
                    from: query.from,
                    to: query.to,
                    query: query.query,
                    limit: query.limit,
                })}`,
            ),

        get: (id: number) => request<EventEntity | null>(`/api/events/${id}`),

        create: (payload: CreateEventPayload) =>
            request<EventEntity>('/api/events', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),

        update: (id: number, payload: UpdateEventPayload) =>
            request<EventEntity>(`/api/events/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            }),

        cancel: (id: number, payload: CancelEventPayload) =>
            request<{ id: number }>(`/api/events/${id}/cancel`, {
                method: 'POST',
                body: JSON.stringify(payload),
            }),

        delete: (id: number) =>
            request<void>(`/api/events/${id}`, {
                method: 'DELETE',
            }),
    },

    // --- Deadlines ---
    deadlines: {
        listOccurrences: (query: DeadlineOccurrenceListQuery) =>
            request<ResolvedDeadline[]>(
                `/api/deadlines/occurrences${buildQuery({
                    from: query.from,
                    to: query.to,
                    limit: query.limit,
                    withCompleted: query.withCompleted,
                })}`,
            ),

        list: (query: DeadlineListQuery = {}) =>
            request<DeadlineEntity[]>(
                `/api/deadlines${buildQuery({
                    from: query.from,
                    to: query.to,
                    query: query.query,
                    limit: query.limit,
                    withCompleted: query.withCompleted,
                })}`,
            ),

        get: (id: number) =>
            request<DeadlineEntity | null>(`/api/deadlines/${id}`),

        create: (payload: CreateDeadlinePayload) =>
            request<DeadlineEntity>('/api/deadlines', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),

        update: (id: number, payload: UpdateDeadlinePayload) =>
            request<DeadlineEntity>(`/api/deadlines/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            }),

        setCompletion: (id: number, payload: SetDeadlineCompletionPayload) =>
            request<{ id: number }>(`/api/deadlines/${id}/completion`, {
                method: 'PUT',
                body: JSON.stringify(payload),
                keepalive: true,
            }),

        cancel: (id: number, payload: CancelDeadlinePayload) =>
            request<{ id: number }>(`/api/deadlines/${id}/cancel`, {
                method: 'POST',
                body: JSON.stringify(payload),
            }),

        delete: (id: number) =>
            request<void>(`/api/deadlines/${id}`, {
                method: 'DELETE',
            }),
    },

    // --- Screens & System ---
    health: {
        check: () => request<{ status: string }>('/health'),
    },

    screens: {
        getInfo: (name: 'main' | 'splash') =>
            request<ScreenInfo>(`/screens/${name}`),

        getPngUrl: (name: 'main' | 'splash') =>
            backendPath(`/screens/${name}/png`),

        getPngBlob: async (name: 'main' | 'splash'): Promise<Blob> => {
            const token = getAuthToken()
            const headers = new Headers({
                Accept: 'image/png',
            })
            if (token) {
                headers.set('Authorization', `Bearer ${token}`)
            }
            const response = await fetch(backendPath(`/screens/${name}/png`), {
                headers,
            })
            if (!response.ok) {
                throw new ApiClientError(
                    `Ошибка загрузки экрана: HTTP ${response.status}`,
                    response.status,
                )
            }
            return response.blob()
        },

        subscribe: (
            onScreenChange: (change: ScreenChange) => void,
            onError?: (error: Event) => void,
        ): (() => void) => {
            const controller = new AbortController()
            let isAborted = false
            let retryTimer: ReturnType<typeof setTimeout> | null = null

            async function connect() {
                if (isAborted) return

                const token = getAuthToken()
                const headers: Record<string, string> = {
                    Accept: 'text/event-stream',
                }
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`
                }

                try {
                    const response = await fetch(
                        backendPath('/screens/events'),
                        {
                            headers,
                            signal: controller.signal,
                        },
                    )

                    if (!response.ok) {
                        throw new Error(`SSE HTTP ${response.status}`)
                    }

                    if (!response.body) {
                        throw new Error('SSE empty body')
                    }

                    const reader = response.body.getReader()
                    const decoder = new TextDecoder()
                    let buffer = ''

                    while (!isAborted) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        const parts = buffer.split('\n\n')
                        buffer = parts.pop() ?? ''

                        for (const block of parts) {
                            if (!block.trim() || block.startsWith(':')) continue

                            let eventType = 'message'
                            let data = ''

                            for (const line of block.split('\n')) {
                                if (line.startsWith('event:')) {
                                    eventType = line.slice(6).trim()
                                } else if (line.startsWith('data:')) {
                                    data = line.slice(5).trim()
                                }
                            }

                            if (eventType === 'screen' && data) {
                                try {
                                    const parsed = JSON.parse(
                                        data,
                                    ) as ScreenChange
                                    onScreenChange(parsed)
                                } catch (e) {
                                    console.error(
                                        'Failed to parse screen event:',
                                        e,
                                    )
                                }
                            }
                        }
                    }
                } catch {
                    if (isAborted) return
                    if (onError) {
                        onError(new Event('error'))
                    }
                }

                if (!isAborted) {
                    retryTimer = setTimeout(() => {
                        void connect()
                    }, 3000)
                }
            }

            void connect()

            return () => {
                isAborted = true
                controller.abort()
                if (retryTimer) {
                    clearTimeout(retryTimer)
                }
            }
        },
    },
}
