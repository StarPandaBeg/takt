import { setConfig, type DeepPartial, type DefaultsConfig } from '@takt/ui'
import type { Scene } from './scene.js'

export interface ProjectSettings {
    readonly screen: {
        readonly width: number
        readonly height: number
    }
}

export interface Project<
    TSceneContext,
    TSettings extends ProjectSettings = ProjectSettings,
    TScenes extends Record<string, Scene<TSceneContext>> = Record<
        string,
        Scene<TSceneContext>
    >,
> {
    readonly settings: TSettings
    readonly scenes: TScenes
}

export function defineProject<TSceneContext>(
    config?: DeepPartial<DefaultsConfig>,
) {
    return <
        const TSettings extends ProjectSettings,
        const TScenes extends Record<string, Scene<TSceneContext>>,
    >(
        project: Project<TSceneContext, TSettings, TScenes>,
    ): Project<TSceneContext, TSettings, TScenes> => {
        if (config) setConfig(config)

        return project
    }
}
