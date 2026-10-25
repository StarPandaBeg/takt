import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import { project } from '@takt/templates'
import type { FastifyPluginAsync } from 'fastify'
import * as z from 'zod'
import { createNodeEnvironment } from '../render-environment.js'
import { generateScene, getSceneNames } from '../services/scene.js'

const nameSchema = z.object({
    name: z.enum(getSceneNames()),
})

export const screenRoutes: FastifyPluginAsync = async (fastify) => {
    const environment = createNodeEnvironment()
    const render = createRenderer(environment)

    fastify.get('/:name/png', async (req, res) => {
        const parsed = nameSchema.safeParse(req.params)
        if (!parsed.success) return res.code(404).send('Not Found')

        const { name } = parsed.data
        const scene = await generateScene(name)
        await environment.preloadImages(scene)
        const frame = render({
            content: scene,
            viewport: project.settings.screen,
        })
        const png = await exportPng(frame)

        return res
            .header('Cache-Control', 'no-store')
            .type('image/png')
            .send(png)
    })

    return Promise.resolve()
}
