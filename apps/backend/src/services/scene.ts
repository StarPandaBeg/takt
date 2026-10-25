import { project } from '@takt/templates'
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
}
type SceneName = keyof typeof contexts

export const getSceneNames = (): SceneName[] => {
    return Object.keys(project.scenes) as SceneName[]
}

export const getSceneHash = async (name: SceneName) => {
    return await contexts[name].key()
}

export const generateScene = async (name: SceneName) => {
    const context = await contexts[name].context()
    const scene = project.scenes[name]
    // @ts-expect-error Context typization missing
    return scene.generate(context)
}
