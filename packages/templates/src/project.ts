import { setConfig, type DeepPartial, type DefaultsConfig } from '@takt/ui'
import type { Scene } from './scene.js'

type SceneRegistry = Record<string, Scene<never>>

export interface ProjectFontAsset {
    readonly family: string
    readonly source: string
}

export interface ProjectSettings {
    readonly screen: {
        readonly width: number
        readonly height: number
    }
    readonly fonts?: readonly ProjectFontAsset[]
}

export interface Project<
    TSettings extends ProjectSettings = ProjectSettings,
    TScenes extends SceneRegistry = SceneRegistry,
> {
    readonly settings: TSettings
    readonly scenes: TScenes
}

export function defineProject(config?: DeepPartial<DefaultsConfig>) {
    return <
        const TSettings extends ProjectSettings,
        const TScenes extends SceneRegistry,
    >(
        project: Project<TSettings, TScenes>,
    ): Project<TSettings, TScenes> => {
        if (config) setConfig(config)

        return project
    }
}
