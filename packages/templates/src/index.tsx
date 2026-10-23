import { createProject, makeScene } from '@takt/ui'
import { Rect, Text } from '@takt/ui/components'

export const calendarBlankScreen = makeScene(() => {
    return (
        <>
            <Rect x={50} y={30} width={300} height={200} />
            <Text>123</Text>
        </>
    )
})

export const project = createProject({
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
