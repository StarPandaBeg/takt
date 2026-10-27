import type { McpServer } from '@modelcontextprotocol/server'
import { registerDeadlineTools } from './deadlines/index.js'
import { registerEventTools } from './events/index.js'
import { registerNoteTools } from './notes/index.js'

export function registerTools(server: McpServer) {
    registerDeadlineTools(server)
    registerEventTools(server)
    registerNoteTools(server)
}
