import type { Scene } from './scene.js'

export interface ProjectSettings {
    screen: {
        width: number
        height: number
    }
}

export interface Project<
    TContext = unknown,
    TSettings extends ProjectSettings = ProjectSettings,
    TScenes extends Record<string, Scene<TContext>> = Record<
        string,
        Scene<TContext>
    >,
> {
    settings: TSettings
    scenes: TScenes
}

export function createProject<
    TContext,
    const TScenes extends Record<string, Scene<TContext>>,
    TSettings extends ProjectSettings = ProjectSettings,
>(
    project: Project<TContext, TSettings, TScenes>,
): Project<TContext, TSettings, TScenes> {
    return project
}

export * from './scene.js'
