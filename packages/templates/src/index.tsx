import { Group, Rect, Text } from '@takt/ui/components'
import { defineProject } from './project.js'
import { defineScene } from './scene.js'

export { defineProject, type Project, type ProjectSettings } from './project.js'
export { defineScene, type Scene } from './scene.js'

export const calendarBlankScreen = defineScene(() => {
    return (
        <>
            <Group x={30} y={20}>
                <Rect width={50} height={50} fill fillColor="black" />
                <Rect x={60} width={50} height={50} fill fillColor="gray_75" />
                <Rect x={120} width={50} height={50} fill fillColor="gray_50" />
                <Rect x={180} width={50} height={50} fill fillColor="gray_25" />
                <Rect x={240} width={50} height={50} fill fillColor="white" />
            </Group>
            <Group x={30} y={90}>
                <Text fontFamily="Inter">
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </Text>
                <Text y={30} fontFamily="Inter">
                    абвгдеёжзиклмнопрстуфхцчшщъыьэюя
                </Text>
                <Text y={60} fontFamily="Inter" fontWeight={600}>
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </Text>
                <Text y={90} fontFamily="Inter" fontWeight={600}>
                    абвгдеёжзиклмнопрстуфхцчшщъыьэюя
                </Text>
                <Text y={120} fontFamily="Inter" italic>
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </Text>
                <Text y={150} fontFamily="Inter" italic>
                    абвгдеёжзиклмнопрстуфхцчшщъыьэюя
                </Text>
                <Text y={180} fontFamily="Inter" underline>
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </Text>
                <Text y={210} fontFamily="Inter" underline>
                    абвгдеёжзиклмнопрстуфхцчшщъыьэюя
                </Text>
                <Text y={240} fontFamily="Inter" fontSize={20}>
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </Text>
                <Text y={270} fontFamily="Inter" fontSize={20}>
                    абвгдеёжзиклмнопрстуфхцчшщъыьэюя
                </Text>
                <Text y={300} fontFamily="Inter" fontSize={24}>
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </Text>
                <Text y={330} fontFamily="Inter" fontSize={24}>
                    абвгдеёжзиклмнопрстуфхцчшщъыьэюя
                </Text>
            </Group>
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
