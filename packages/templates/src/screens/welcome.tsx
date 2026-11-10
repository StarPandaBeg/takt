import { Column, H1, Image, Row, Text } from '@takt/ui/components'
import { defineScene } from '../scene.js'

/**
 * Screen shown by every device until the browser tutorial is completed.
 * The final layout intentionally belongs here and can be developed without
 * changing the backend override logic.
 */
export const calendarWelcomeScreen = defineScene<void>(() => (
    <>
        <Image
            src={new URL('../../assets/leaves.jpg', import.meta.url).href}
            width={800}
            height={480}
            fit="cover"
            dithering="ordered"
            threshold={128}
            smoothing
        />
        <Row width={800} justify="center" y={200}>
            <Image
                src={new URL('../../assets/welcome.png', import.meta.url).href}
                width={180}
                height={180}
                fit="cover"
                dithering="ordered"
                threshold={128}
                smoothing
            />
        </Row>
        <Column
            width={800}
            height={480}
            justify="start"
            align="start"
            gap={16}
            padding={16}
        >
            <H1>Все готово!</H1>
            <Column>
                <Row gap={4}>
                    <Text fontSize={20}>Перейдите на</Text>
                    <Text fontSize={20} fontWeight={600}>
                        https://takt.stpnd-private.ru
                    </Text>
                    <Text fontSize={20}>для</Text>
                </Row>
                <Text fontSize={20}>создания своего первого события!</Text>
            </Column>
        </Column>
    </>
))
