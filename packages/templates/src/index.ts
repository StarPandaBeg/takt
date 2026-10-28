import { type DeepPartial, type DefaultsConfig } from '@takt/ui'
import { defineProject } from './project.js'
import { calendarMainScreen } from './screens/main.js'
import { calendarSplashScreen } from './screens/splash.js'

export {
    defineProject,
    type Project,
    type ProjectFontAsset,
    type ProjectSettings,
} from './project.js'
export { defineScene, type Scene } from './scene.js'

export {
    selectDeadlinesForScreen,
    type Deadline,
} from './components/deadline-column.js'
export {
    getEventState,
    selectEventsForScreen,
    type Event,
    type EventState,
} from './components/event-list.js'
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
        fonts: [
            {
                family: 'Inter',
                source: new URL(
                    '../assets/fonts/Inter-Regular.ttf',
                    import.meta.url,
                ).href,
            },
            {
                family: 'Inter',
                source: new URL(
                    '../assets/fonts/Inter-Medium.ttf',
                    import.meta.url,
                ).href,
            },
            {
                family: 'Inter',
                source: new URL(
                    '../assets/fonts/Inter-SemiBold.ttf',
                    import.meta.url,
                ).href,
            },
        ],
    },
    scenes: {
        main: calendarMainScreen,
        splash: calendarSplashScreen,
    },
})
