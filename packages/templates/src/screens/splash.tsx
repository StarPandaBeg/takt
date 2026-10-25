import { Column, Image } from '@takt/ui/components'
import { defineScene } from '../scene.js'

export const calendarSplashScreen = defineScene<void>(() => {
    return (
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
            <Column
                x={0}
                y={0}
                width={800}
                height={480}
                justify="center"
                align="center"
            >
                <Image
                    src={
                        new URL('../../assets/panda.png', import.meta.url).href
                    }
                    width={380}
                    height={380}
                    fit="contain"
                    dithering="ordered"
                    smoothing
                    threshold={128}
                    invert
                />
            </Column>
        </>
    )
})
