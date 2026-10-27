import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { getEventEntity } from '../../services/events.js'
import { toToolResponse } from '../util/helpers.js'
import { eventEntitySchema } from '../util/objects.js'
import { serializeEventEntity } from '../util/serializers.js'

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
