import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'

import { registerTools } from './tools/index.js'

const mcpHandler = createMcpHandler(() => {
    const server = new McpServer({
        name: 'takt',
        version: '1.0.0',
        description:
            'Takt is a personal calendar and notes management service.',
    })

    registerTools(server)

    return server
})

export const handleMcp = toNodeHandler(mcpHandler)
