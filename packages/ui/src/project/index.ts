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
> {
    settings: TSettings
    scenes: Record<string, Scene<TContext>>
}

export function createProject<TContext>(
    project: Project<TContext>,
): Project<TContext> {
    return project
}

export * from './scene.js'
