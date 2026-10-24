import { Column, Group, H1, Line, Rect, Row, Text } from '@takt/ui/components'
import { defineProject } from './project.js'
import { defineScene } from './scene.js'

export { defineProject, type Project, type ProjectSettings } from './project.js'
export { defineScene, type Scene } from './scene.js'

export const calendarBlankScreen = defineScene(() => {
    return (
        <>
            <Line
                x={500}
                y={30}
                dx={-200}
                dy={100}
                strokeWidth={3}
                butt
                strokeColor="gray_50"
            />
            <Row
                x={0}
                y={0}
                align="start"
                justify="end"
                width={800}
                height={480}
                padding={[10, 5]}
                gap={5}
            >
                <Rect width={50} height={50} fill fillColor="black" />
                <Rect
                    x={60}
                    width={50}
                    height={50}
                    fill
                    fillColor="black"
                    borderRadius={10}
                />
                <Rect x={120} width={50} height={50} fill fillColor="gray_50" />
                <Rect x={180} width={30} height={30} fill fillColor="gray_25" />
                {/* <Rect x={240} width={50} height={50} fill fillColor="white" /> */}
            </Row>
            <Column x={300} y={20} align="center" gap={10}>
                <Rect width={50} height={50} fill fillColor="black" />
                <Rect x={60} width={50} height={50} fill fillColor="gray_75" />
                <Rect x={120} width={30} height={30} fill fillColor="gray_50" />
                <Rect x={180} width={50} height={50} fill fillColor="gray_25" />
                {/* <Rect x={240} width={50} height={50} fill fillColor="white" /> */}
            </Column>
            <Group x={30} y={90}>
                <H1 fontFamily="Inter">
                    АБВГДЕËЖЗИËКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ 0123456789!"№;%:?*()-=_+.,
                </H1>
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
