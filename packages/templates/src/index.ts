import { type DeepPartial, type DefaultsConfig } from '@takt/ui'
import { defineProject } from './project.js'
import { calendarBlankScreen } from './screens/blank.js'
import { calendarSplashScreen } from './screens/splash.js'

export { defineProject, type Project, type ProjectSettings } from './project.js'
export { defineScene, type Scene } from './scene.js'

export { type Deadline } from './components/deadline-column.js'
export { type Event } from './components/event-list.js'
export { type Note } from './components/notes.js'

const config: DeepPartial<DefaultsConfig> = {
    typography: {
        default: {
            fontFamily: 'Inter',
        },
        h1: {
            fontFamily: 'Inter',
        },
        h2: {
            fontFamily: 'Inter',
        },
        h3: {
            fontFamily: 'Inter',
        },
    },
}

export const project = defineProject(config)({
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
})
