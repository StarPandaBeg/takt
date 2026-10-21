import { createProject, makeScene } from '@takt/ui'
import { Text } from '@takt/ui/components'

const calendarBlankScreen = makeScene(() => {
    return (
        <>
            <Text>Hello, World!</Text>
        </>
    )
})

const project = createProject({
    settings: {
        screen: {
            width: 800,
            height: 480,
        },
    },
    scenes: {
        blank: calendarBlankScreen,
    },
})

console.log(project)
