export function toToolResponse<T>(response: T) {
    return {
        content: [],
        structuredContent: response,
    }
}
