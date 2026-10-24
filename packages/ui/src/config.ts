import type { TextFormat } from './components/text.js'

export interface DefaultsConfig {
    typography: {
        default: Required<TextFormat>
        h1: Required<TextFormat>
        h2: Required<TextFormat>
        h3: Required<TextFormat>
    }
}

const defaultTypography: Required<TextFormat> = {
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 400,
    italic: false,
    lineHeight: 1.2,
    metrics: 'font',
    underline: false,
}

export let defaultConfig: Readonly<DefaultsConfig> = {
    typography: {
        default: defaultTypography,
        h1: {
            ...defaultTypography,
            fontSize: 28,
            fontWeight: 600,
        },
        h2: {
            ...defaultTypography,
            fontSize: 24,
            fontWeight: 500,
        },
        h3: {
            ...defaultTypography,
            fontSize: 20,
            fontWeight: 500,
        },
    },
}

export const setConfig = (cfg: DefaultsConfig) => {
    defaultConfig = cfg
}
