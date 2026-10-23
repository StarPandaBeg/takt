import type { Scene } from './scene.js'

export interface ProjectSettings {
    readonly screen: {
        readonly width: number
        readonly height: number
    }
}

export interface Project<
    TSettings extends ProjectSettings = ProjectSettings,
    TScenes extends Record<string, Scene<never>> = Record<string, Scene<never>>,
> {
    readonly settings: TSettings
    readonly scenes: TScenes
}

export function defineProject<
    const TSettings extends ProjectSettings,
    const TScenes extends Record<string, Scene<never>>,
>(project: Project<TSettings, TScenes>): Project<TSettings, TScenes> {
    return project
}
