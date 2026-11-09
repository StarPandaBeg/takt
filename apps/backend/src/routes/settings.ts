import {
    getSettings,
    isValidTimezone,
    updateSettings,
} from '#src/services/settings.js'
import type { FastifyPluginAsync } from 'fastify'
import * as z from 'zod'

const settingsPatchSchema = z
    .object({
        timezone: z
            .string()
            .trim()
            .min(1)
            .refine(isValidTimezone, {
                message: 'timezone must be a valid IANA time zone',
            })
            .optional(),
        tutorial: z.union([z.literal(0), z.literal(1)]).optional(),
    })
    .refine((changes) => Object.keys(changes).length > 0, {
        message: 'settings patch must contain at least one field',
    })

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', getSettings)

    fastify.patch('/', async (request, reply) => {
        const parsed = settingsPatchSchema.safeParse(request.body)
        if (!parsed.success) {
            return reply.code(400).send({
                message: 'Invalid application settings',
                issues: parsed.error.issues,
            })
        }
        return updateSettings(parsed.data)
    })

    return Promise.resolve()
}
