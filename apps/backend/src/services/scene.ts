import { project } from '@takt/templates'
import type { JSXChild } from '@takt/ui'
import { createScreenRevisionHash } from './screen-revision.js'
import { getSettings } from './settings.js'
import { defineSceneContext, sources } from './sources.js'

const WELCOME_SCENE_NAME = 'welcome' as const

const mainSceneContext = defineSceneContext({
    notes: sources.notes,
    today: sources.today,
    events: sources.events,
    deadlines: sources.deadlines,
})
const splashScreenContext = defineSceneContext({})
const welcomeScreenContext = defineSceneContext({})

const contexts = {
    main: mainSceneContext,
    splash: splashScreenContext,
    welcome: welcomeScreenContext,
} satisfies Record<keyof typeof project.scenes, { key(): Promise<string> }>

const generators = {
    main: async () =>
        project.scenes.main.generate(await mainSceneContext.context()),
    splash: () => Promise.resolve(project.scenes.splash.generate()),
    welcome: () => Promise.resolve(project.scenes.welcome.generate()),
} satisfies Record<keyof typeof project.scenes, () => Promise<JSXChild>>

type ProjectSceneName = keyof typeof project.scenes
type SceneName = Exclude<ProjectSceneName, typeof WELCOME_SCENE_NAME>

export const getSceneNames = (): SceneName[] => {
    return (Object.keys(project.scenes) as ProjectSceneName[]).filter(
        (name): name is SceneName => name !== WELCOME_SCENE_NAME,
    )
}

export const getSceneHash = async (name: SceneName) => {
    const effectiveName = await getEffectiveSceneName(name)
    return createScreenRevisionHash([
        ['scene', effectiveName],
        ['context', await contexts[effectiveName].key()],
    ])
}

export const generateScene = async (name: SceneName) => {
    return await generators[await getEffectiveSceneName(name)]()
}

async function getEffectiveSceneName(
    requestedName: SceneName,
): Promise<ProjectSceneName> {
    return (await getSettings()).tutorial === 0
        ? WELCOME_SCENE_NAME
        : requestedName
}
