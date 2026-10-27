import { toToolResponse } from '#src/mcp/util/helpers.js'
import { eventEntitySchema } from '#src/mcp/util/objects.js'
import { serializeEventEntity } from '#src/mcp/util/serializers.js'
import { getEventEntity } from '#src/services/events.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const getEventInputSchema = z.object({
    id: z.int().positive().describe('ID of the event master'),
})

export const getEventOutputSchema = eventEntitySchema.nullable()

export const getEvent: ToolCallback<typeof getEventInputSchema> = async ({
    id,
}) => {
    const event = await getEventEntity(id)
    return toToolResponse(
        event === undefined ? null : serializeEventEntity(event),
    )
}
