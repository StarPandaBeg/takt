import type {
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
    Note,
    ResolvedDeadline,
    ResolvedEvent,
    ScreenChange,
    ScreenInfo,
    SetDeadlineCompletionPayload,
    UpdateDeadlinePayload,
    UpdateEventPayload,
    UpdateNotePayload,
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
        (import.meta.env.VITE_AUTH_TOKEN as string | undefined) ||
        ''
    )
}

export function setAuthToken(token: string): void {
    localStorage.setItem('takt_auth_token', token)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

    // GET /health не требует Bearer токена, остальные эндпоинты требуют
    if (!path.startsWith('/health')) {
        const token = getAuthToken()
        if (token) {
            headers.set('Authorization', `Bearer ${token}`)
        }
    }

    const response = await fetch(path, {
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
        return undefined as T
    }

    return (await response.json()) as T
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
    // --- Notes ---
    notes: {
        list: (query: { limit?: number; withDone?: boolean } = {}) =>
            request<Note[]>(
                `/api/notes${buildQuery({
                    limit: query.limit,
                    withDone: query.withDone,
                })}`,
            ),

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

        getPngUrl: (name: 'main' | 'splash') => `/screens/${name}/png`,

        getPngBlob: async (name: 'main' | 'splash'): Promise<Blob> => {
            const token = getAuthToken()
            const headers = new Headers({
                Accept: 'image/png',
            })
            if (token) {
                headers.set('Authorization', `Bearer ${token}`)
            }
            const response = await fetch(`/screens/${name}/png`, {
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
                    const response = await fetch('/screens/events', {
                        headers,
                        signal: controller.signal,
                    })

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
