import type { ToolCallback } from '@modelcontextprotocol/server'
import * as z from 'zod'

import { toToolResponse } from '#src/mcp/util/helpers.js'
import { deadlineEntitySchema } from '#src/mcp/util/objects.js'
import { serializeDeadlineEntity } from '#src/mcp/util/serializers.js'
import { getDeadlineEntity } from '#src/services/deadlines.js'

export const getDeadlineInputSchema = z.object({
    id: z.int().positive(),
})

export const getDeadlineOutputSchema = deadlineEntitySchema.nullable()

export const getDeadline: ToolCallback<typeof getDeadlineInputSchema> = async ({
    id,
}) => {
    const deadline = await getDeadlineEntity(id)
    return toToolResponse(
        deadline === undefined ? null : serializeDeadlineEntity(deadline),
    )
}
