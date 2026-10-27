import type { McpServer } from '@modelcontextprotocol/server'
import { registerEventTools } from './events/index.js'
import { registerNoteTools } from './notes/index.js'

export function registerTools(server: McpServer) {
    registerEventTools(server)
    registerNoteTools(server)
}
