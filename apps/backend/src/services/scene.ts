import { project } from '@takt/templates'
import type { JSXChild } from '@takt/ui'
import { defineSceneContext, sources } from './sources.js'

const mainSceneContext = defineSceneContext({
    notes: sources.notes,
    today: sources.today,
    events: sources.events,
    deadlines: sources.deadlines,
})
const splashScreenContext = defineSceneContext({})

const contexts = {
    main: mainSceneContext,
    splash: splashScreenContext,
} satisfies Record<keyof typeof project.scenes, { key(): Promise<string> }>

const generators = {
    main: async () =>
        project.scenes.main.generate(await mainSceneContext.context()),
    splash: () => Promise.resolve(project.scenes.splash.generate()),
} satisfies Record<keyof typeof project.scenes, () => Promise<JSXChild>>

type SceneName = keyof typeof project.scenes

export const getSceneNames = (): SceneName[] => {
    return Object.keys(project.scenes) as SceneName[]
}

export const getSceneHash = async (name: SceneName) => {
    return await contexts[name].key()
}

export const generateScene = async (name: SceneName) => {
    return await generators[name]()
}
