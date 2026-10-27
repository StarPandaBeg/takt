export function toToolResponse<T>(response: T) {
    return {
        content: [{ type: 'text' as const, text: JSON.stringify(response) }],
        structuredContent: response,
    }
}
