import cors from '@fastify/cors'
import { createRenderer } from '@takt/renderer'
import { exportPng } from '@takt/renderer/exporters'
import {
    project,
    type Deadline,
    type Note,
    type ProjectContext,
    type Scene,
} from '@takt/templates'
import Fastify, { type FastifyInstance } from 'fastify'
import { DateTime } from 'luxon'
import { createNodeEnvironment } from './render-environment.js'
import { notesRoutes } from './routes/notes.js'

const events = [
    {
        start: DateTime.fromISO('2026-10-24T17:00:34.123'),
        text: 'Событие 1',
    },
    {
        start: DateTime.fromISO('2026-10-24T17:20:34.123'),
        text: 'Событие 2',
    },
    {
        start: DateTime.fromISO('2026-10-24T17:00:34.123'),
        end: DateTime.fromISO('2026-10-24T17:30:34.123'),
        text: 'Событие 3',
    },
    {
        start: DateTime.fromISO('2025-10-24T17:50:34.123'),
        end: DateTime.fromISO('2027-10-24T17:55:34.123'),
        text: 'Событие 4',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 5',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 6',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 7',
    },
    {
        start: DateTime.fromISO('2026-10-25T17:50:34.123'),
        end: DateTime.fromISO('2026-10-25T17:55:34.123'),
        text: 'Событие 8',
    },
]

const deadlines: Deadline[] = [
    {
        date: DateTime.fromISO('2026-10-19T15:50:34.123'),
        text: 'Решить со встречей ВИШ',
        important: true,
    },
    {
        date: DateTime.fromISO('2026-10-19T15:50:34.123'),
        text: 'Решить со встречей ВИШ',
    },
]

const notes: Note[] = [
    { text: 'Перенести пароли' },
    { text: 'Заказать рамку' },
    { text: 'Обновить сервер', done: true },
    { text: 'Купить продукты' },
    { text: 'Закончить календарь' },
    { text: 'Проверить бэкапы' },
    { text: 'Позвонить другу' },
    { text: 'Разобрать задачи' },
]

export interface AppOptions {
    readonly logger?: boolean
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
    const app = Fastify({ logger: options.logger ?? true })
    app.register(cors, {
        origin: '*',
    })

    app.register(notesRoutes, { prefix: '/api/notes' })

    const environment = createNodeEnvironment()
    const render = createRenderer(environment)

    app.get('/screen/:screen', async (_request, reply) => {
        const { screen } = _request.params as { screen: string }
        const scenes: Record<string, Scene<ProjectContext>> = project.scenes
        const projectScene = scenes[screen]

        if (!projectScene) {
            return reply.code(404).send('Not Found')
        }

        const today = DateTime.now()

        const content = projectScene.generate({
            today,
            events,
            deadlines,
            notes,
        })
        await environment.preloadImages(content)

        const frame = render({
            content,
            viewport: project.settings.screen,
        })
        const png = await exportPng(frame)
        const body = Buffer.from(png.buffer, png.byteOffset, png.byteLength)

        return reply
            .header('Cache-Control', 'no-store')
            .type('image/png')
            .send(body)
    })

    return app
}
