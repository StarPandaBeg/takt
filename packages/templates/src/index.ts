import { defaultConfig } from '@takt/ui'
import { defineProject } from './project.js'
import { calendarBlankScreen } from './screens/blank.js'
import { calendarSplashScreen } from './screens/splash.js'

export { defineProject, type Project, type ProjectSettings } from './project.js'
export { defineScene, type Scene } from './scene.js'

export const project = defineProject(
    {
        settings: {
            screen: {
                width: 800,
                height: 480,
            },
        },
        scenes: {
            blank: calendarBlankScreen,
            splash: calendarSplashScreen,
        },
    },
    {
        ...defaultConfig,
        typography: {
            ...defaultConfig.typography,
            default: {
                ...defaultConfig.typography.default,
                fontFamily: 'Inter',
            },
            h1: {
                ...defaultConfig.typography.h1,
                fontFamily: 'Inter',
            },
            h2: {
                ...defaultConfig.typography.h2,
                fontFamily: 'Inter',
            },
            h3: {
                ...defaultConfig.typography.h3,
                fontFamily: 'Inter',
            },
        },
    },
)
