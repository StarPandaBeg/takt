// @ts-nocheck

import type { McpServer } from '@modelcontextprotocol/server'
import { registerDeadlineTools } from './deadlines/index.js'
import { registerEventTools } from './events/index.js'
import { registerNoteTools } from './notes/index.js'

export function registerTools(server: McpServer) {
    const original = server.registerTool.bind(server)

    server.registerTool = ((name, opts, callback) => {
        const wrapped: typeof callback = async (...args) => {
            const started = performance.now()

            console.log(`[MCP] → ${name}`, args[0])

            try {
                const result = await callback(...args)

                console.log(
                    `[MCP] ← ${name} (${Math.round(performance.now() - started)}ms)`,
                    result,
                )

                return result
            } catch (error) {
                console.error(
                    `[MCP] ✕ ${name} (${Math.round(performance.now() - started)}ms)`,
                    error,
                )

                throw error
            }
        }
        return original(name, opts, wrapped)
    }) as typeof server.registerTool

    registerDeadlineTools(server)
    registerEventTools(server)
    registerNoteTools(server)
}
