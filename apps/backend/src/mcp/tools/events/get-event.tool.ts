import { toToolResponse } from '#src/mcp/util/helpers.js'
import { eventIdSchema, parseEventId } from '#src/mcp/util/ids.js'
import { eventEntitySchema } from '#src/mcp/util/objects.js'
import { serializeMcpEventEntity } from '#src/mcp/util/serializers.js'
import { getEventEntity } from '#src/services/events.js'
import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

export const getEventInputSchema = z.object({
    id: eventIdSchema,
})

export const getEventOutputSchema = eventEntitySchema.nullable()

export const getEvent: ToolCallback<typeof getEventInputSchema> = async ({
    id,
}) => {
    const event = await getEventEntity(parseEventId(id))
    return toToolResponse(
        event === undefined ? null : serializeMcpEventEntity(event),
    )
}
