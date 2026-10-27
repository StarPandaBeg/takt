import { registerEventTools } from '#/mcp/tools/events/index.js'
import type { McpServer } from '@modelcontextprotocol/server'

export function registerTools(server: McpServer) {
    registerEventTools(server)
}
