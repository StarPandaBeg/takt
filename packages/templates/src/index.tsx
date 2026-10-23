import { DrawColor } from '@takt/ui'
import { Rect, Text } from '@takt/ui/components'
import { defineProject } from './project.js'
import { defineScene } from './scene.js'

export { defineProject, type Project, type ProjectSettings } from './project.js'
export { defineScene, type Scene } from './scene.js'

export const calendarBlankScreen = defineScene(() => {
    return (
        <>
            <Rect x={50} y={30} width={300} height={200} fill />
            <Rect
                x={80}
                y={40}
                width={100}
                height={100}
                fill
                fillColor={DrawColor.WHITE}
            />
            <Text fontFamily="Times New Roman" fontWeight={600}>
                АБВГ, руду, Привет, мир!
            </Text>
        </>
    )
})

export const project = defineProject({
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
