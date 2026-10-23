import { createProject, DrawColor, makeScene } from '@takt/ui'
import { Rect, Text } from '@takt/ui/components'

export const calendarBlankScreen = makeScene(() => {
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
